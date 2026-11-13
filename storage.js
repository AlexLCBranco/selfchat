(function (root) {
  "use strict";

  const core = root.SelfChatStorageCore;
  const DB_NAME = "selfchat-local-v1";
  const DB_VERSION = 2;
  const BACKUP_ID = "legacy-before-indexeddb-v1";
  const STORES = ["operations", "chats", "messages", "stickers", "drafts", "attachmentRefs", "trash", "meta", "legacyBackups"];

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

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction;
        const ensureStore = (name, options) => db.objectStoreNames.contains(name) ? transaction.objectStore(name) : db.createObjectStore(name, options);
        const ensureIndex = (store, name, keyPath) => { if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false }); };
        const operations = ensureStore("operations", { keyPath: "id" });
        ensureIndex(operations, "entityId", "entityId");
        ensureIndex(operations, "createdAt", "createdAt");
        ensureStore("chats", { keyPath: "id" });
        const messages = ensureStore("messages", { keyPath: "id" });
        ensureIndex(messages, "chatId", "chatId");
        ensureIndex(messages, "createdAt", "createdAt");
        ensureStore("stickers", { keyPath: "id" });
        ensureStore("drafts", { keyPath: "chatId" });
        const refs = ensureStore("attachmentRefs", { keyPath: "id" });
        ensureIndex(refs, "imageId", "imageId");
        ensureIndex(refs, "entityId", "entityId");
        ensureStore("trash", { keyPath: "id" });
        ensureStore("meta", { keyPath: "key" });
        ensureStore("legacyBackups", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("SelfChat storage upgrade is blocked by another tab"));
    });
  }

  function getMeta(db, key) {
    const transaction = db.transaction("meta", "readonly");
    return requestResult(transaction.objectStore("meta").get(key));
  }

  function putAttachmentRef(stores, entityType, entity) {
    if (!entity?.imageId) return;
    stores.attachmentRefs.put({ id: `${entityType}:${entity.id}:${entity.imageId}`, entityType, entityId: entity.id, imageId: entity.imageId });
  }

  function applyOperation(stores, operation) {
    stores.operations.put(operation);
    const payload = operation.payload || {};
    if (operation.type === "chat.upsert") stores.chats.put(payload);
    if (["message.upsert", "message.edit", "message.move"].includes(operation.type)) {
      stores.messages.put(payload);
      putAttachmentRef(stores, "message", payload);
    }
    if (operation.type === "sticker.upsert") {
      stores.stickers.put(payload);
      putAttachmentRef(stores, "sticker", payload);
    }
    if (operation.type === "draft.set") {
      if (payload.text) stores.drafts.put({ chatId: payload.chatId, text: payload.text, updatedAt: operation.createdAt });
      else stores.drafts.delete(payload.chatId);
    }
    if (operation.type === "message.delete") {
      const message = payload.message;
      stores.messages.delete(operation.entityId);
      stores.trash.put({
        id: `message:${operation.entityId}`, entityType: "message", entityId: operation.entityId,
        deletedAt: operation.createdAt, operationId: operation.id,
        payload: message ? { message, originalChatId: payload.originalChatId || message.chatId } : { originalChatId: payload.originalChatId }
      });
    }
    if (operation.type === "chat.delete" && operation.entityId !== core.UNSORTED_CHAT.id) {
      stores.chats.delete(operation.entityId);
      (payload.messages || []).forEach(message => stores.messages.delete(message.id));
      stores.trash.put({
        id: `chat:${operation.entityId}`, entityType: "chat", entityId: operation.entityId,
        deletedAt: operation.createdAt, operationId: operation.id,
        payload: { chat: payload.chat, messages: payload.messages || [], draft: payload.draft || "" }
      });
    }
    if (operation.type === "message.restore") {
      if (payload.message) stores.messages.put({ ...payload.message, chatId: payload.targetChatId || payload.message.chatId });
      stores.trash.delete(`message:${operation.entityId}`);
    }
    if (operation.type === "chat.restore") {
      if (payload.chat) stores.chats.put(payload.chat);
      (payload.messages || []).forEach(message => {
        stores.messages.put(message);
        putAttachmentRef(stores, "message", message);
      });
      if (payload.draft) stores.drafts.put({ chatId: operation.entityId, text: payload.draft, updatedAt: operation.createdAt });
      stores.trash.delete(`chat:${operation.entityId}`);
    }
    if (operation.type === "message.purge") stores.trash.delete(`message:${operation.entityId}`);
    if (operation.type === "chat.purge") stores.trash.delete(`chat:${operation.entityId}`);
    if (operation.type === "trash.empty") stores.trash.clear();
    if (operation.type === "trash.import") {
      const item = payload.item;
      if (item?.id) stores.trash.put(item);
    }
  }

  async function loadState(db) {
    const transaction = db.transaction(["chats", "messages", "stickers", "drafts", "trash", "meta"], "readonly");
    const stores = Object.fromEntries(["chats", "messages", "stickers", "drafts", "trash", "meta"].map(name => [name, transaction.objectStore(name)]));
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
    });
  }

  async function createAndVerifyBackup(db, adapters) {
    const existing = await (async () => {
      const transaction = db.transaction("legacyBackups", "readonly");
      return requestResult(transaction.objectStore("legacyBackups").get(BACKUP_ID));
    })();
    if (existing?.verified) return existing;
    const images = await adapters.getAllImages();
    const snapshots = await adapters.getRecoverySnapshots();
    const record = {
      id: BACKUP_ID,
      createdAt: new Date().toISOString(),
      storage: {
        primary: localStorage.getItem(adapters.storageKey),
        recovery: localStorage.getItem(adapters.recoveryKey)
      },
      images,
      recoverySnapshots: snapshots,
      verified: false
    };
    let transaction = db.transaction("legacyBackups", "readwrite");
    transaction.objectStore("legacyBackups").put(record);
    await transactionDone(transaction);
    transaction = db.transaction("legacyBackups", "readonly");
    const stored = await requestResult(transaction.objectStore("legacyBackups").get(BACKUP_ID));
    await transactionDone(transaction);
    const valid = stored && stored.storage.primary === record.storage.primary && stored.storage.recovery === record.storage.recovery
      && stored.images.length === images.length && stored.recoverySnapshots.length === snapshots.length
      && stored.images.every((image, index) => image.id === images[index].id && image.blob?.size === images[index].blob?.size);
    if (!valid) throw new Error("Legacy safety backup verification failed");
    stored.verified = true;
    transaction = db.transaction("legacyBackups", "readwrite");
    transaction.objectStore("legacyBackups").put(stored);
    await transactionDone(transaction);
    return stored;
  }

  async function migrate(db, legacyState, adapters) {
    const backup = await createAndVerifyBackup(db, adapters);
    const attachmentIds = new Set(backup.images.map(image => image.id));
    const state = core.normalizeState(legacyState, adapters.defaultState);
    const validation = core.validateState(state, attachmentIds, { allowMissingAttachments: true });
    if (!validation.ok) throw new Error(`Legacy validation failed: ${validation.errors.join("; ")}`);
    const operations = core.migrationOperations(state);
    const transaction = db.transaction(STORES.filter(name => name !== "legacyBackups"), "readwrite");
    const stores = Object.fromEntries(STORES.filter(name => name !== "legacyBackups").map(name => [name, transaction.objectStore(name)]));
    ["operations", "chats", "messages", "stickers", "drafts", "attachmentRefs", "trash", "meta"].forEach(name => stores[name].clear());
    operations.forEach(operation => applyOperation(stores, operation));
    stores.meta.put({ key: "activeChatId", value: state.activeChatId });
    stores.meta.put({ key: "migrationStatus", value: "projected", updatedAt: new Date().toISOString() });
    await transactionDone(transaction);
    const projected = await loadState(db);
    const projectedValidation = core.validateState(projected, attachmentIds, { allowMissingAttachments: true });
    if (!projectedValidation.ok || projectedValidation.counts.chats !== validation.counts.chats || projectedValidation.counts.messages !== validation.counts.messages || projectedValidation.counts.stickers !== validation.counts.stickers) {
      throw new Error(`Migrated projection validation failed: ${projectedValidation.errors.join("; ")}`);
    }
    const opTransaction = db.transaction("operations", "readonly");
    const operationCount = await requestResult(opTransaction.objectStore("operations").count());
    if (operationCount !== operations.length) throw new Error("Migrated operation count did not match");
    const activation = db.transaction("meta", "readwrite");
    activation.objectStore("meta").put({ key: "activeSchema", value: 1, activatedAt: new Date().toISOString(), backupId: BACKUP_ID });
    activation.objectStore("meta").put({ key: "migrationStatus", value: "active", updatedAt: new Date().toISOString() });
    await transactionDone(activation);
    return projected;
  }

  async function open(adapters) {
    const db = await openDatabase();
    const active = await getMeta(db, "activeSchema");
    const initialState = active?.value === 1 ? await loadState(db) : await migrate(db, adapters.loadLegacyState(), adapters);

    return {
      db,
      initialState,
      async load() { return loadState(db); },
      async commit(operations, activeChatId) {
        const names = ["operations", "chats", "messages", "stickers", "drafts", "attachmentRefs", "trash", "meta"];
        const transaction = db.transaction(names, "readwrite");
        const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
        operations.forEach(operation => applyOperation(stores, operation));
        if (activeChatId) stores.meta.put({ key: "activeChatId", value: activeChatId });
        await transactionDone(transaction);
        return loadState(db);
      },
      async setActiveChat(activeChatId) {
        const transaction = db.transaction("meta", "readwrite");
        transaction.objectStore("meta").put({ key: "activeChatId", value: activeChatId });
        await transactionDone(transaction);
      },
      async replaceState(value, restoreOperation) {
        const nextState = core.normalizeState(value, adapters.defaultState);
        const names = ["operations", "chats", "messages", "stickers", "drafts", "attachmentRefs", "trash", "meta"];
        const transaction = db.transaction(names, "readwrite");
        const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
        ["chats", "messages", "stickers", "drafts", "attachmentRefs", "trash"].forEach(name => stores[name].clear());
        nextState.chats.forEach(chat => stores.chats.put(chat));
        nextState.messages.forEach(message => {
          stores.messages.put(message);
          putAttachmentRef(stores, "message", message);
        });
        nextState.customStickers.forEach(sticker => {
          stores.stickers.put(sticker);
          putAttachmentRef(stores, "sticker", sticker);
        });
        Object.entries(nextState.drafts).filter(([, text]) => text).forEach(([chatId, text]) => stores.drafts.put({ chatId, text, updatedAt: restoreOperation.createdAt }));
        nextState.trash.forEach(item => stores.trash.put(item));
        stores.meta.put({ key: "activeChatId", value: nextState.activeChatId });
        stores.operations.put(restoreOperation);
        await transactionDone(transaction);
        return loadState(db);
      },
      async purgeHistory(entityIds) {
        const ids = new Set(entityIds);
        const transaction = db.transaction(["operations", "attachmentRefs", "legacyBackups"], "readwrite");
        const operations = transaction.objectStore("operations");
        const refs = transaction.objectStore("attachmentRefs");
        operations.openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (ids.has(cursor.value.entityId)) cursor.delete();
          cursor.continue();
        };
        refs.openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (ids.has(cursor.value.entityId)) cursor.delete();
          cursor.continue();
        };
        transaction.objectStore("legacyBackups").clear();
        await transactionDone(transaction);
      },
      async getLegacyBackup() {
        const transaction = db.transaction("legacyBackups", "readonly");
        return requestResult(transaction.objectStore("legacyBackups").get(BACKUP_ID));
      },
      async operationCount() {
        const transaction = db.transaction("operations", "readonly");
        return requestResult(transaction.objectStore("operations").count());
      }
    };
  }

  root.SelfChatStorage = { open, DB_NAME, DB_VERSION, BACKUP_ID };
})(typeof globalThis !== "undefined" ? globalThis : this);
