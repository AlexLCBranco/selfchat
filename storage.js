(function (root) {
  "use strict";

  const core = root.SelfChatStorageCore;
  const syncCrypto = root.SelfChatSyncCrypto || (typeof require === "function" ? require("./sync-crypto.js") : null);
  const DB_NAME = "selfchat-unified-v1";
  const DB_VERSION = 2;
  const LEGACY_DB_NAME = "selfchat-local-v1";
  const MAX_DAILY_SNAPSHOTS = 30;
  const STORES = ["chats", "messages", "stickers", "drafts", "attachments", "trash", "snapshots", "meta"];
  const TRANSACTION_STORES = [...STORES, "operations"];

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was interrupted"));
    });
  }

  function openDatabase(name = DB_NAME, version = DB_VERSION) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => {
        if (name !== DB_NAME) return;
        const db = request.result;
        const ensureStore = (storeName, options) => db.objectStoreNames.contains(storeName)
          ? request.transaction.objectStore(storeName)
          : db.createObjectStore(storeName, options);
        const ensureIndex = (store, indexName, keyPath) => {
          if (!store.indexNames.contains(indexName)) store.createIndex(indexName, keyPath, { unique: false });
        };
        ensureStore("chats", { keyPath: "id" });
        const messages = ensureStore("messages", { keyPath: "id" });
        ensureIndex(messages, "chatId", "chatId");
        ensureIndex(messages, "createdAt", "createdAt");
        ensureStore("stickers", { keyPath: "id" });
        ensureStore("drafts", { keyPath: "chatId" });
        ensureStore("attachments", { keyPath: "id" });
        ensureStore("trash", { keyPath: "id" });
        const snapshots = ensureStore("snapshots", { keyPath: "id" });
        ensureIndex(snapshots, "createdAt", "createdAt");
        ensureStore("meta", { keyPath: "key" });
        const operations = ensureStore("operations", { keyPath: "id" });
        ensureIndex(operations, "logicalOrder", ["counter", "deviceId", "id"]);
        ensureIndex(operations, "deviceId", "deviceId");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("SelfChat storage upgrade is blocked by another tab"));
    });
  }

  async function databaseExists(name) {
    if (!indexedDB.databases) return true;
    const databases = await indexedDB.databases();
    return databases.some(database => database.name === name);
  }

  async function openExistingDatabase(name) {
    if (!(await databaseExists(name))) return null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.transaction.abort();
    }).catch(() => null);
  }

  async function getMeta(db, key) {
    const transaction = db.transaction("meta", "readonly");
    return requestResult(transaction.objectStore("meta").get(key));
  }

  async function getAllMeta(db) {
    const records = await requestResult(db.transaction("meta", "readonly").objectStore("meta").getAll());
    return Object.fromEntries(records.map(record => [record.key, record.value]));
  }

  async function loadState(db, fallback) {
    const names = ["chats", "messages", "stickers", "drafts", "trash", "meta"];
    const transaction = db.transaction(names, "readonly");
    const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
    const [chats, messages, stickers, drafts, trash, active] = await Promise.all([
      requestResult(stores.chats.getAll()), requestResult(stores.messages.getAll()), requestResult(stores.stickers.getAll()),
      requestResult(stores.drafts.getAll()), requestResult(stores.trash.getAll()), requestResult(stores.meta.get("activeChatId"))
    ]);
    return core.normalizeState({
      activeChatId: active?.value,
      chats,
      messages,
      customStickers: stickers,
      drafts: Object.fromEntries(drafts.map(draft => [draft.chatId, draft.text])),
      trash,
      deletedChatIds: trash.filter(item => item.entityType === "chat").map(item => item.entityId),
      deletedMessageIds: trash.filter(item => item.entityType === "message").map(item => item.entityId)
    }, fallback);
  }

  async function readV092Projection(fallback) {
    const db = await openExistingDatabase(LEGACY_DB_NAME);
    if (!db) return null;
    try {
      const required = ["chats", "messages", "stickers", "drafts", "trash", "meta"];
      if (!required.every(name => db.objectStoreNames.contains(name))) return null;
      const active = await getMeta(db, "activeSchema");
      if (active?.value !== 1) return null;
      const state = await loadState(db, fallback);
      let backupImages = [];
      if (db.objectStoreNames.contains("legacyBackups")) {
        const backups = await requestResult(db.transaction("legacyBackups", "readonly").objectStore("legacyBackups").getAll());
        backupImages = backups.filter(backup => backup?.verified).flatMap(backup => backup.images || []);
      }
      return { state, backupImages };
    } finally {
      db.close();
    }
  }

  function putState(stores, state) {
    state.chats.forEach(chat => stores.chats.put(chat));
    state.messages.forEach(message => stores.messages.put(message));
    state.customStickers.forEach(sticker => stores.stickers.put(sticker));
    Object.entries(state.drafts).filter(([, text]) => text).forEach(([chatId, text]) => stores.drafts.put({ chatId, text, updatedAt: new Date().toISOString() }));
    state.trash.forEach(item => stores.trash.put(item));
    stores.meta.put({ key: "activeChatId", value: state.activeChatId });
  }

  async function migrate(db, adapters) {
    const legacyLocal = core.normalizeState(adapters.loadLegacyState(), adapters.defaultState);
    const legacyIndexed = await readV092Projection(adapters.defaultState);
    const source = legacyIndexed ? core.mergeStates([legacyLocal, legacyIndexed.state], legacyIndexed.state, adapters.defaultState) : legacyLocal;
    const currentAttachments = await adapters.getAllImages();
    const attachmentMap = new Map((legacyIndexed?.backupImages || []).map(record => [record.id, record]));
    currentAttachments.forEach(record => {
      const backup = attachmentMap.get(record.id);
      if (!backup?.blob?.size || record?.blob?.size) attachmentMap.set(record.id, record);
    });
    const attachments = [...attachmentMap.values()];
    const legacySnapshots = await adapters.getRecoverySnapshots();
    const sourceValidation = core.validateState(source, new Set(attachments.map(record => record.id)), { allowMissingAttachments: true });
    if (!sourceValidation.ok) throw Object.assign(new Error(`v0.9.2 validation failed: ${sourceValidation.errors.join("; ")}`), { legacyState: source });
    const snapshots = core.newestSnapshotPerDay(legacySnapshots, MAX_DAILY_SNAPSHOTS);
    try {
      const transaction = db.transaction(STORES, "readwrite");
      const stores = Object.fromEntries(STORES.map(name => [name, transaction.objectStore(name)]));
      STORES.filter(name => name !== "meta").forEach(name => stores[name].clear());
      putState(stores, source);
      attachments.forEach(record => stores.attachments.put(record));
      snapshots.forEach(snapshot => stores.snapshots.put(snapshot));
      stores.meta.put({ key: "migrationStatus", value: "verifying" });
      await transactionDone(transaction);
      const [projected, projectedAttachments, projectedTrash] = await Promise.all([
        loadState(db, adapters.defaultState),
        requestResult(db.transaction("attachments", "readonly").objectStore("attachments").getAll()),
        requestResult(db.transaction("trash", "readonly").objectStore("trash").getAll())
      ]);
      const before = { ...core.stateCounts(source), images: attachments.length };
      const after = { ...core.stateCounts(projected), images: projectedAttachments.length, trash: projectedTrash.length };
      for (const key of ["chats", "messages", "images", "trash"]) {
        if (before[key] !== after[key]) throw new Error(`Migration count mismatch for ${key}: ${before[key]} before, ${after[key]} after`);
      }
      if (adapters.verifyMigration) await adapters.verifyMigration({ source, projected, attachments: projectedAttachments });
      const activation = db.transaction("meta", "readwrite");
      const meta = activation.objectStore("meta");
      meta.put({ key: "activeSchema", value: 1 });
      meta.put({ key: "migrationStatus", value: "active" });
      meta.put({ key: "migrationCounts", value: after });
      meta.put({ key: "migratedAt", value: new Date().toISOString() });
      await transactionDone(activation);
      return source;
    } catch (error) {
      error.legacyState = source;
      try {
        const transaction = db.transaction("meta", "readwrite");
        transaction.objectStore("meta").put({ key: "migrationStatus", value: "failed", error: error.message, updatedAt: new Date().toISOString() });
        await transactionDone(transaction);
      } catch (_) {}
      throw error;
    }
  }

  function applyDiff(stores, diff) {
    (diff.chatsPut || []).forEach(record => stores.chats.put(record));
    (diff.chatsDelete || []).forEach(id => stores.chats.delete(id));
    (diff.messagesPut || []).forEach(record => stores.messages.put(record));
    (diff.messagesDelete || []).forEach(id => stores.messages.delete(id));
    (diff.stickersPut || []).forEach(record => stores.stickers.put(record));
    (diff.stickersDelete || []).forEach(id => stores.stickers.delete(id));
    (diff.draftsPut || []).forEach(record => stores.drafts.put(record));
    (diff.draftsDelete || []).forEach(id => stores.drafts.delete(id));
    (diff.trashPut || []).forEach(record => stores.trash.put(record));
    (diff.trashDelete || []).forEach(id => stores.trash.delete(id));
    (diff.attachmentsPut || []).forEach(record => stores.attachments.put(record));
    (diff.attachmentsDelete || []).forEach(id => stores.attachments.delete(id));
    (diff.metaPut || []).forEach(record => stores.meta.put(record));
    (diff.metaDelete || []).forEach(key => stores.meta.delete(key));
    if (diff.activeChatId) stores.meta.put({ key: "activeChatId", value: diff.activeChatId });
  }

  function createDeviceId(adapters) {
    if (adapters.createDeviceId) return adapters.createDeviceId();
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function createSyncProfileId(adapters) {
    if (adapters.createSyncProfileId) return adapters.createSyncProfileId();
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  async function ensureSyncFoundation(db, state, adapters) {
    const transaction = db.transaction(["meta", "operations", "attachments"], "readwrite");
    const meta = transaction.objectStore("meta");
    const operations = transaction.objectStore("operations");
    const [existingIdentity, existingClock, globalHiddenChatIds, operationCount, attachments] = await Promise.all([
      requestResult(meta.get("deviceIdentity")),
      requestResult(meta.get("logicalClock")),
      requestResult(meta.get("globalHiddenChatIds")),
      requestResult(operations.count()),
      requestResult(transaction.objectStore("attachments").getAll())
    ]);
    const deviceIdentity = existingIdentity?.value || {
      id: createDeviceId(adapters),
      createdAt: new Date().toISOString()
    };
    let logicalClock = Number.isSafeInteger(existingClock?.value) ? existingClock.value : 0;
    if (!existingIdentity?.value) meta.put({ key: "deviceIdentity", value: deviceIdentity, updatedAt: deviceIdentity.createdAt });
    if (!operationCount) {
      const bootstrapDiff = core.bootstrapSyncDiff(state, attachments);
      if (globalHiddenChatIds) bootstrapDiff.metaPut = [globalHiddenChatIds];
      const bootstrap = core.syncOperationsForDiff(bootstrapDiff, {
        deviceId: deviceIdentity.id,
        startCounter: logicalClock,
        recordedAt: deviceIdentity.createdAt
      });
      bootstrap.operations.forEach(operation => operations.put(operation));
      logicalClock = bootstrap.counter;
    }
    meta.put({ key: "logicalClock", value: logicalClock, updatedAt: new Date().toISOString() });
    await transactionDone(transaction);
    return { deviceIdentity, logicalClock };
  }

  async function ensureSyncSecurityFoundation(db, deviceIdentity, adapters) {
    const current = await getAllMeta(db);
    if (current.syncProfile && current.deviceCredentials && current.authorizedDevices && current.syncTransport) {
      return;
    }
    if (!syncCrypto) throw new Error("SelfChat sync cryptography is unavailable");
    const createdAt = new Date().toISOString();
    const generated = adapters.createSyncSecurityFoundation
      ? await adapters.createSyncSecurityFoundation({ deviceIdentity, createdAt })
      : {
          profile: {
            version: 1,
            id: createSyncProfileId(adapters),
            createdAt,
            algorithm: "AES-GCM-256",
            keyMaterial: syncCrypto.generateProfileKey()
          },
          credentials: await syncCrypto.generateDeviceCredentials({ deviceId: deviceIdentity.id, createdAt })
        };
    const profile = current.syncProfile || generated.profile;
    const credentials = current.deviceCredentials || generated.credentials;
    if (!profile?.id || !profile?.keyMaterial || credentials?.deviceId !== deviceIdentity.id) {
      throw new Error("Invalid local synchronization security foundation");
    }
    const authorizedDevices = current.authorizedDevices || [{
      deviceId: deviceIdentity.id,
      signingPublicJwk: credentials.signing.publicJwk,
      agreementPublicJwk: credentials.agreement.publicJwk,
      authorizedAt: createdAt,
      authorizedBy: deviceIdentity.id
    }];
    const syncTransport = current.syncTransport || { configured: false, enabled: false };
    const transaction = db.transaction("meta", "readwrite");
    const meta = transaction.objectStore("meta");
    if (!current.syncProfile) meta.put({ key: "syncProfile", value: profile, updatedAt: createdAt });
    if (!current.deviceCredentials) meta.put({ key: "deviceCredentials", value: credentials, updatedAt: createdAt });
    if (!current.authorizedDevices) meta.put({ key: "authorizedDevices", value: authorizedDevices, updatedAt: createdAt });
    if (!current.syncTransport) meta.put({ key: "syncTransport", value: syncTransport, updatedAt: createdAt });
    await transactionDone(transaction);
  }

  async function pruneSnapshots(db) {
    const snapshots = await requestResult(db.transaction("snapshots", "readonly").objectStore("snapshots").getAll());
    const keep = new Set(core.newestSnapshotPerDay(snapshots, MAX_DAILY_SNAPSHOTS).map(snapshot => snapshot.id));
    const remove = snapshots.filter(snapshot => !keep.has(snapshot.id));
    if (!remove.length) return;
    const deletion = db.transaction("snapshots", "readwrite");
    remove.forEach(snapshot => deletion.objectStore("snapshots").delete(snapshot.id));
    await transactionDone(deletion);
  }

  async function purgeLegacyDatabase(targets, fallback) {
    const db = await openExistingDatabase(LEGACY_DB_NAME);
    if (!db) return;
    try {
      const available = name => db.objectStoreNames.contains(name);
      let backups = [];
      if (available("legacyBackups")) backups = await requestResult(db.transaction("legacyBackups", "readonly").objectStore("legacyBackups").getAll());
      const names = ["operations", "chats", "messages", "drafts", "attachmentRefs", "trash", "legacyBackups"].filter(available);
      if (!names.length) return;
      const transaction = db.transaction(names, "readwrite");
      const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
      targets.chatIds.forEach(id => { stores.chats?.delete(id); stores.drafts?.delete(id); });
      targets.messageIds.forEach(id => stores.messages?.delete(id));
      for (const name of ["operations", "attachmentRefs", "trash"]) {
        if (!stores[name]) continue;
        stores[name].openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (targets.entityIds.has(cursor.value.entityId)) cursor.delete();
          cursor.continue();
        };
      }
      backups.forEach(backup => {
        const next = { ...backup };
        const retainedStates = [];
        for (const field of ["primary", "recovery"]) {
          try {
            const parsed = JSON.parse(next.storage?.[field]);
            if (parsed) {
              const redacted = core.redactState(parsed, targets, fallback);
              retainedStates.push(redacted);
              next.storage[field] = JSON.stringify(redacted);
            }
          } catch (_) {}
        }
        next.recoverySnapshots = (next.recoverySnapshots || []).map(snapshot => ({ ...snapshot, state: core.redactState(snapshot.state, targets, fallback) }));
        retainedStates.push(...next.recoverySnapshots.map(snapshot => snapshot.state));
        const retainedImageIds = core.referencedAttachmentIds(retainedStates.shift() || {}, retainedStates);
        next.images = (next.images || []).filter(image => !targets.imageIds.has(image.id) || retainedImageIds.has(image.id));
        stores.legacyBackups.put(next);
      });
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  }

  async function open(adapters) {
    const db = await openDatabase();
    let initialState;
    try {
      const active = await getMeta(db, "activeSchema");
      initialState = active?.value === 1 ? await loadState(db, adapters.defaultState) : await migrate(db, adapters);
    } catch (error) {
      db.close();
      throw error;
    }
    const syncFoundation = await ensureSyncFoundation(db, initialState, adapters);
    await ensureSyncSecurityFoundation(db, syncFoundation.deviceIdentity, adapters);
    const metadata = await getAllMeta(db);
    let pendingCommit = Promise.resolve();
    async function runSerialized(work) {
      const previousCommit = pendingCommit;
      let releaseCommit;
      pendingCommit = new Promise(resolve => { releaseCommit = resolve; });
      await previousCommit;
      try {
        return await work();
      } finally {
        releaseCommit();
      }
    }
    async function persistSecurityMetadata(updates) {
      const transaction = db.transaction("meta", "readwrite");
      const meta = transaction.objectStore("meta");
      const updatedAt = new Date().toISOString();
      Object.entries(updates).forEach(([key, value]) => meta.put({ key, value, updatedAt }));
      await transactionDone(transaction);
      Object.assign(metadata, updates);
    }
    function materializeRemoteWinner(stores, operation) {
      if (operation.store === "attachments") return;
      const store = stores[operation.store];
      if (!store) throw new Error("Remote operation targets an unavailable store");
      if (operation.action === "delete") store.delete(operation.entityId);
      else store.put(operation.value);
    }
    async function applyRemotePayload(envelope, attachmentBundles = null) {
      const device = (metadata.authorizedDevices || []).find(item => item.deviceId === envelope?.header?.deviceId && !item.blockedAt);
      if (!device) throw new Error("Encrypted update is not from an authorized device");
      const cursors = { ...(metadata.syncReplayCursors || {}) };
      const opened = await syncCrypto.openOperationEnvelope(envelope, metadata.syncProfile, device, {
        minimumSequence: Number(cursors[device.deviceId]) || 0
      });
      const incoming = core.validateRemoteSyncOperations(opened.operations, device.deviceId);
      let attachmentRecords = [];
      if (attachmentBundles) {
        if (!Array.isArray(attachmentBundles)) throw new Error("Encrypted sync package attachments are invalid");
        const attachmentReferences = core.resolveSyncConflicts(incoming)
          .filter(operation => operation.store === "attachments" && operation.action === "put");
        const referencesById = new Map(attachmentReferences.map(operation => [operation.entityId, operation]));
        const bundleIds = new Set();
        for (const bundle of attachmentBundles) {
          const attachmentId = bundle?.manifest?.attachmentId;
          if (!attachmentId || bundleIds.has(attachmentId)) throw new Error("Encrypted sync package contains duplicate attachment bundles");
          bundleIds.add(attachmentId);
          const reference = referencesById.get(attachmentId);
          if (!reference) throw new Error("Encrypted sync package contains an attachment without an encrypted reference");
          attachmentRecords.push({
            operationId: reference.id,
            record: await syncCrypto.openEncryptedAttachmentBundle(bundle, metadata.syncProfile, device, reference.value)
          });
        }
        if (bundleIds.size !== referencesById.size || [...referencesById.keys()].some(id => !bundleIds.has(id))) {
          throw new Error("Encrypted sync package is missing attachment bytes");
        }
      }
      const existing = await requestResult(db.transaction("operations", "readonly").objectStore("operations").getAll());
      const existingById = new Map(existing.map(operation => [operation.id, operation]));
      const fresh = incoming.filter(operation => {
        const known = existingById.get(operation.id);
        if (known && syncCrypto.stableStringify(known) !== syncCrypto.stableStringify(operation)) {
          throw new Error("Encrypted update changes an existing immutable operation");
        }
        return !known;
      });
      const freshIds = new Set(fresh.map(operation => operation.id));
      const resolvedWinners = core.resolveSyncConflicts([...existing, ...fresh]);
      const winners = resolvedWinners.filter(operation => freshIds.has(operation.id));
      if (attachmentRecords.length) {
        const winningAttachments = new Map(resolvedWinners
          .filter(operation => operation.store === "attachments" && operation.action === "put")
          .map(operation => [operation.entityId, operation.id]));
        attachmentRecords = attachmentRecords
          .filter(item => winningAttachments.get(item.record.id) === item.operationId)
          .map(item => item.record);
      }
      const logicalClock = Math.max(Number(metadata.logicalClock) || 0, ...incoming.map(operation => operation.counter));
      cursors[device.deviceId] = opened.header.sequence;
      const transaction = db.transaction(TRANSACTION_STORES, "readwrite");
      const stores = Object.fromEntries(TRANSACTION_STORES.map(name => [name, transaction.objectStore(name)]));
      fresh.forEach(operation => stores.operations.add(operation));
      winners.forEach(operation => materializeRemoteWinner(stores, operation));
      attachmentRecords.forEach(record => stores.attachments.put(record));
      stores.meta.put({ key: "logicalClock", value: logicalClock, updatedAt: new Date().toISOString() });
      stores.meta.put({ key: "syncReplayCursors", value: cursors, updatedAt: new Date().toISOString() });
      await transactionDone(transaction);
      metadata.logicalClock = logicalClock;
      metadata.syncReplayCursors = cursors;
      const visibilityWinner = winners.find(operation => operation.store === "meta" && operation.entityId === "globalHiddenChatIds");
      if (visibilityWinner) metadata.globalHiddenChatIds = visibilityWinner.action === "put" ? visibilityWinner.value.value : undefined;
      return { received: incoming.length, stored: fresh.length, applied: winners.length, attachmentsStored: attachmentRecords.length, deviceId: device.deviceId, sequence: opened.header.sequence };
    }
    const repository = {
      db,
      initialState,
      metadata,
      async load() { return loadState(db, adapters.defaultState); },
      async commit(diff, { significant = true, snapshotState = null } = {}) {
        return runSerialized(async () => {
          const today = new Date().toISOString().slice(0, 10);
          const createDailySnapshot = significant && snapshotState && metadata.lastSnapshotDay !== today;
          const sync = core.syncOperationsForDiff(diff, {
            deviceId: metadata.deviceIdentity.id,
            startCounter: metadata.logicalClock || 0
          });
          const transaction = db.transaction(TRANSACTION_STORES, "readwrite");
          const stores = Object.fromEntries(TRANSACTION_STORES.map(name => [name, transaction.objectStore(name)]));
          if (createDailySnapshot) {
            const createdAt = new Date().toISOString();
            stores.snapshots.put({ id: `daily-${today}`, createdAt, label: "Daily recovery point", messageCount: snapshotState.messages.length, chatCount: snapshotState.chats.length, state: core.normalizeState(snapshotState, adapters.defaultState) });
            stores.meta.put({ key: "lastSnapshotDay", value: today });
          }
          applyDiff(stores, diff);
          sync.operations.forEach(operation => stores.operations.add(operation));
          if (sync.operations.length) stores.meta.put({ key: "logicalClock", value: sync.counter, updatedAt: new Date().toISOString() });
          await transactionDone(transaction);
          if (sync.operations.length) metadata.logicalClock = sync.counter;
          if (createDailySnapshot) {
            metadata.lastSnapshotDay = today;
            await pruneSnapshots(db);
          }
        });
      },
      async replaceState(value) {
        const next = core.normalizeState(value, adapters.defaultState);
        const current = await loadState(db, adapters.defaultState);
        const removed = (before, after, key = "id") => {
          const nextIds = new Set(after.map(record => record[key]));
          return before.map(record => record[key]).filter(id => !nextIds.has(id));
        };
        const diff = {
          chatsPut: next.chats,
          chatsDelete: removed(current.chats, next.chats),
          messagesPut: next.messages,
          messagesDelete: removed(current.messages, next.messages),
          stickersPut: next.customStickers,
          stickersDelete: removed(current.customStickers, next.customStickers),
          draftsPut: Object.entries(next.drafts).filter(([, text]) => text).map(([chatId, text]) => ({ chatId, text })),
          draftsDelete: Object.keys(current.drafts).filter(chatId => !next.drafts[chatId]),
          trashPut: next.trash,
          trashDelete: removed(current.trash, next.trash)
        };
        const sync = core.syncOperationsForDiff(diff, {
          deviceId: metadata.deviceIdentity.id,
          startCounter: metadata.logicalClock || 0
        });
        const names = ["chats", "messages", "stickers", "drafts", "trash", "meta", "operations"];
        const transaction = db.transaction(names, "readwrite");
        const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
        ["chats", "messages", "stickers", "drafts", "trash"].forEach(name => stores[name].clear());
        putState(stores, next);
        sync.operations.forEach(operation => stores.operations.add(operation));
        if (sync.operations.length) stores.meta.put({ key: "logicalClock", value: sync.counter, updatedAt: new Date().toISOString() });
        await transactionDone(transaction);
        if (sync.operations.length) metadata.logicalClock = sync.counter;
      },
      async getAttachment(id) { return requestResult(db.transaction("attachments", "readonly").objectStore("attachments").get(id)); },
      async getAllAttachments() { return requestResult(db.transaction("attachments", "readonly").objectStore("attachments").getAll()); },
      async listOperations() {
        const operations = await requestResult(db.transaction("operations", "readonly").objectStore("operations").getAll());
        return core.mergeSyncOperations(operations);
      },
      async createPairingInvitation(deviceLabel = "") {
        const invitation = await syncCrypto.createPairingInvitation(metadata.deviceCredentials, metadata.syncProfile, { deviceLabel });
        return { invitation, verificationCode: await syncCrypto.pairingVerificationCode(invitation) };
      },
      async createPairingRequest(invitation, deviceLabel = "") {
        if (!(await syncCrypto.verifyPairingInvitation(invitation))) throw new Error("Pairing invitation is invalid or expired");
        const verificationCode = await syncCrypto.pairingVerificationCode(invitation);
        const request = await syncCrypto.createEnrollmentRequest(metadata.deviceCredentials, {
          profileId: invitation.profileId,
          invitationHash: verificationCode,
          authorizerDeviceId: invitation.authorizerDeviceId,
          deviceLabel
        });
        await persistSecurityMetadata({ pendingPairing: { invitation, request, verificationCode, createdAt: new Date().toISOString() } });
        return { request, verificationCode };
      },
      async issuePairingGrant(request) {
        if (!(await syncCrypto.verifyEnrollmentRequest(request))) throw new Error("Pairing request proof is invalid");
        const requestTime = Date.parse(request.createdAt);
        if (!Number.isFinite(requestTime) || requestTime > Date.now() + 5 * 60 * 1000 || Date.now() - requestTime > 15 * 60 * 1000) {
          throw new Error("Pairing request is expired");
        }
        if (request.profileId !== metadata.syncProfile.id || request.authorizerDeviceId !== metadata.deviceIdentity.id) {
          throw new Error("Pairing request targets another profile or device");
        }
        const grant = await syncCrypto.issueEnrollmentGrant(request, metadata.deviceCredentials, metadata.syncProfile);
        const authorizedDevices = (metadata.authorizedDevices || []).filter(device => device.deviceId !== request.deviceId);
        authorizedDevices.push({
          deviceId: request.deviceId,
          label: request.deviceLabel || "Paired device",
          signingPublicJwk: request.signingPublicJwk,
          agreementPublicJwk: request.agreementPublicJwk,
          authorizedAt: new Date().toISOString(),
          authorizedBy: metadata.deviceIdentity.id
        });
        await persistSecurityMetadata({ authorizedDevices });
        return { grant, verificationCode: request.invitationHash || "" };
      },
      async acceptPairingGrant(grant) {
        const pending = metadata.pendingPairing;
        if (!pending?.invitation || !pending?.request) throw new Error("No pairing request is pending on this device");
        const trustedAuthorizer = {
          deviceId: pending.invitation.authorizerDeviceId,
          signingPublicJwk: pending.invitation.authorizerSigningPublicJwk
        };
        const keyMaterial = await syncCrypto.acceptEnrollmentGrant(grant, pending.request, metadata.deviceCredentials, trustedAuthorizer);
        const selfDevice = {
          deviceId: metadata.deviceIdentity.id,
          label: pending.request.deviceLabel || "This device",
          signingPublicJwk: metadata.deviceCredentials.signing.publicJwk,
          agreementPublicJwk: metadata.deviceCredentials.agreement.publicJwk,
          authorizedAt: new Date().toISOString(),
          authorizedBy: trustedAuthorizer.deviceId
        };
        const authorizer = {
          deviceId: trustedAuthorizer.deviceId,
          label: pending.invitation.deviceLabel || "Authorizing device",
          signingPublicJwk: trustedAuthorizer.signingPublicJwk,
          authorizedAt: pending.invitation.createdAt,
          authorizedBy: trustedAuthorizer.deviceId
        };
        const syncProfile = { version: 1, id: grant.profileId, createdAt: pending.invitation.createdAt, algorithm: "AES-GCM-256", keyMaterial };
        await persistSecurityMetadata({
          syncProfile,
          authorizedDevices: [authorizer, selfDevice],
          pendingPairing: null,
          syncReplayCursors: {},
          outboundEnvelopeSequence: 0
        });
        return { profileId: syncProfile.id, verificationCode: pending.verificationCode };
      },
      async blockAuthorizedDevice(deviceId) {
        if (deviceId === metadata.deviceIdentity.id) throw new Error("This device cannot block itself");
        const authorizedDevices = (metadata.authorizedDevices || []).map(device => device.deviceId === deviceId
          ? { ...device, blockedAt: new Date().toISOString() }
          : device);
        if (!authorizedDevices.some(device => device.deviceId === deviceId)) throw new Error("Authorized device was not found");
        await persistSecurityMetadata({ authorizedDevices });
        return authorizedDevices;
      },
      async createEncryptedUpdate() {
        return runSerialized(async () => {
          const operations = (await repository.listOperations()).filter(operation => operation.deviceId === metadata.deviceIdentity.id);
          if (!operations.length) throw new Error("This device has no operations to share");
          const sequence = (Number.isSafeInteger(metadata.outboundEnvelopeSequence) ? metadata.outboundEnvelopeSequence : 0) + 1;
          const envelope = await syncCrypto.createOperationEnvelope(operations, metadata.deviceCredentials, metadata.syncProfile, { sequence });
          await persistSecurityMetadata({ outboundEnvelopeSequence: sequence });
          return envelope;
        });
      },
      async createEncryptedPackage() {
        return runSerialized(async () => {
          const operations = (await repository.listOperations()).filter(operation => operation.deviceId === metadata.deviceIdentity.id);
          if (!operations.length) throw new Error("This device has no operations to share");
          const attachmentReferences = core.resolveSyncConflicts(operations)
            .filter(operation => operation.store === "attachments" && operation.action === "put");
          const attachments = await repository.getAllAttachments();
          const attachmentsById = new Map(attachments.map(record => [record.id, record]));
          const bundles = [];
          for (const reference of attachmentReferences) {
            const record = attachmentsById.get(reference.entityId);
            if (!record?.blob) throw new Error(`Attachment ${reference.entityId} is unavailable on this device`);
            if (Number(record.blob.size) !== Number(reference.value.size)) throw new Error(`Attachment ${reference.entityId} does not match its local sync reference`);
            bundles.push(await syncCrypto.createEncryptedAttachmentBundle(record, metadata.deviceCredentials, metadata.syncProfile));
          }
          const sequence = (Number.isSafeInteger(metadata.outboundEnvelopeSequence) ? metadata.outboundEnvelopeSequence : 0) + 1;
          const envelope = await syncCrypto.createOperationEnvelope(operations, metadata.deviceCredentials, metadata.syncProfile, { sequence });
          const syncPackage = {
            version: 1,
            type: "selfchat-encrypted-sync-package",
            createdAt: new Date().toISOString(),
            envelope,
            attachments: bundles
          };
          await persistSecurityMetadata({ outboundEnvelopeSequence: sequence });
          return syncPackage;
        });
      },
      async applyRemoteEnvelope(envelope) {
        return runSerialized(async () => {
          const result = await applyRemotePayload(envelope);
          const { attachmentsStored, ...legacyResult } = result;
          return legacyResult;
        });
      },
      async applyEncryptedPackage(syncPackage) {
        return runSerialized(async () => {
          if (syncPackage?.version !== 1 || syncPackage?.type !== "selfchat-encrypted-sync-package") throw new Error("Unsupported encrypted sync package");
          return applyRemotePayload(syncPackage.envelope, syncPackage.attachments);
        });
      },
      async listSnapshots() { return requestResult(db.transaction("snapshots", "readonly").objectStore("snapshots").getAll()); },
      async getMeta(key) { return (await getMeta(db, key))?.value; },
      async setMeta(key, value) {
        if (key === "globalHiddenChatIds") {
          await repository.commit({ metaPut: [{ key, value, updatedAt: new Date().toISOString() }] }, { significant: false });
          metadata[key] = value;
          return;
        }
        const transaction = db.transaction("meta", "readwrite");
        transaction.objectStore("meta").put({ key, value, updatedAt: new Date().toISOString() });
        await transactionDone(transaction);
        metadata[key] = value;
      },
      async purgeEveryCopy(targets, currentState) {
        const snapshots = await repository.listSnapshots();
        snapshots.forEach(snapshot => {
          (snapshot.state?.chats || []).forEach(chat => {
            if (targets.chatIds.has(chat.id) && chat.avatarImageId) targets.imageIds.add(chat.avatarImageId);
          });
          (snapshot.state?.trash || []).forEach(item => {
            if (targets.chatIds.has(item.entityId) && item.payload?.chat?.avatarImageId) targets.imageIds.add(item.payload.chat.avatarImageId);
          });
        });
        const redactedSnapshots = snapshots.map(snapshot => {
          const nextState = core.redactState(snapshot.state, targets, adapters.defaultState);
          return { ...snapshot, state: nextState, messageCount: nextState.messages.length, chatCount: nextState.chats.length };
        });
        const referenced = core.referencedAttachmentIds(currentState, redactedSnapshots.map(snapshot => snapshot.state));
        const names = ["chats", "messages", "drafts", "trash", "snapshots", "attachments", "operations"];
        const transaction = db.transaction(names, "readwrite");
        const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
        targets.chatIds.forEach(id => { stores.chats.delete(id); stores.drafts.delete(id); });
        targets.messageIds.forEach(id => stores.messages.delete(id));
        stores.trash.openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (targets.entityIds.has(cursor.value.entityId)) cursor.delete();
          cursor.continue();
        };
        redactedSnapshots.forEach(snapshot => stores.snapshots.put(snapshot));
        [...targets.imageIds].filter(id => !referenced.has(id)).forEach(id => stores.attachments.delete(id));
        stores.operations.openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) return;
          const operation = cursor.value;
          if (targets.entityIds.has(operation.entityId) || targets.imageIds.has(operation.entityId)) cursor.delete();
          cursor.continue();
        };
        await transactionDone(transaction);
        await purgeLegacyDatabase(targets, adapters.defaultState);
      },
      close() { db.close(); }
    };
    return repository;
  }

  const api = { open, DB_NAME, DB_VERSION, LEGACY_DB_NAME, MAX_DAILY_SNAPSHOTS };
  root.SelfChatStorage = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
