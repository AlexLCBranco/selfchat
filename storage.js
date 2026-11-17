(function (root) {
  "use strict";

  const core = root.SelfChatStorageCore;
  const DB_NAME = "selfchat-unified-v1";
  const DB_VERSION = 1;
  const LEGACY_DB_NAME = "selfchat-local-v1";
  const MAX_DAILY_SNAPSHOTS = 30;
  const STORES = ["chats", "messages", "stickers", "drafts", "attachments", "trash", "snapshots", "meta"];

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
    if (diff.activeChatId) stores.meta.put({ key: "activeChatId", value: diff.activeChatId });
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
    const metadata = await getAllMeta(db);
    const repository = {
      db,
      initialState,
      metadata,
      async load() { return loadState(db, adapters.defaultState); },
      async commit(diff, { significant = true, snapshotState = null } = {}) {
        const today = new Date().toISOString().slice(0, 10);
        const createDailySnapshot = significant && snapshotState && metadata.lastSnapshotDay !== today;
        const transaction = db.transaction(STORES, "readwrite");
        const stores = Object.fromEntries(STORES.map(name => [name, transaction.objectStore(name)]));
        if (createDailySnapshot) {
          const createdAt = new Date().toISOString();
          stores.snapshots.put({ id: `daily-${today}`, createdAt, label: "Daily recovery point", messageCount: snapshotState.messages.length, chatCount: snapshotState.chats.length, state: core.normalizeState(snapshotState, adapters.defaultState) });
          stores.meta.put({ key: "lastSnapshotDay", value: today });
        }
        applyDiff(stores, diff);
        await transactionDone(transaction);
        if (createDailySnapshot) {
          metadata.lastSnapshotDay = today;
          await pruneSnapshots(db);
        }
      },
      async replaceState(value) {
        const next = core.normalizeState(value, adapters.defaultState);
        const names = ["chats", "messages", "stickers", "drafts", "trash", "meta"];
        const transaction = db.transaction(names, "readwrite");
        const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
        ["chats", "messages", "stickers", "drafts", "trash"].forEach(name => stores[name].clear());
        putState(stores, next);
        await transactionDone(transaction);
      },
      async getAttachment(id) { return requestResult(db.transaction("attachments", "readonly").objectStore("attachments").get(id)); },
      async getAllAttachments() { return requestResult(db.transaction("attachments", "readonly").objectStore("attachments").getAll()); },
      async listSnapshots() { return requestResult(db.transaction("snapshots", "readonly").objectStore("snapshots").getAll()); },
      async getMeta(key) { return (await getMeta(db, key))?.value; },
      async setMeta(key, value) {
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
        const names = ["chats", "messages", "drafts", "trash", "snapshots", "attachments"];
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
