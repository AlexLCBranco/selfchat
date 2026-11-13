const test = require("node:test");
const assert = require("node:assert/strict");
const { indexedDB, IDBKeyRange } = require("fake-indexeddb");

global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
global.SelfChatStorageCore = require("../storage-core.js");

const values = new Map();
global.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
  clear: () => values.clear()
};

const storage = require("../storage.js");
const core = global.SelfChatStorageCore;
const fallback = { activeChatId: "unsorted", chats: [], messages: [], customStickers: [], trash: [], deletedChatIds: [], deletedMessageIds: [], drafts: {} };
const fixture = core.normalizeState({
  activeChatId: "topic",
  chats: [{ id: "topic", name: "Topic", emoji: "T", createdAt: "2026-11-01T10:00:00.000Z" }],
  messages: [
    { id: "m1", chatId: "topic", text: "keep me", createdAt: "2026-11-01T10:01:00.000Z" },
    { id: "m2", chatId: "topic", type: "image", imageId: "image-1", imageName: "one.png", createdAt: "2026-11-01T10:02:00.000Z" }
  ],
  customStickers: [],
  trash: [{ id: "message:old", entityType: "message", entityId: "old", deletedAt: "2026-11-02T10:00:00.000Z", payload: { message: { id: "old", chatId: "topic", text: "trashed" } } }],
  drafts: { topic: "draft" }
}, fallback);

let repository;

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = resolve;
  });
}

async function reset() {
  repository?.close();
  repository = null;
  values.clear();
  await deleteDatabase(storage.DB_NAME);
  await deleteDatabase(storage.LEGACY_DB_NAME);
}

function adapters(overrides = {}) {
  return {
    defaultState: fallback,
    loadLegacyState: () => structuredClone(fixture),
    getAllImages: async () => [{ id: "image-1", name: "one.png", blob: new Blob(["image"], { type: "image/png" }) }],
    getRecoverySnapshots: async () => [{ id: "old-snapshot", createdAt: "2026-11-01T11:00:00.000Z", state: structuredClone(fixture), messageCount: 2, chatCount: 2 }],
    ...overrides
  };
}

async function seedV092Database(state, backupImages = []) {
  const request = indexedDB.open(storage.LEGACY_DB_NAME, 2);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const [name, keyPath] of [["chats", "id"], ["messages", "id"], ["stickers", "id"], ["drafts", "chatId"], ["trash", "id"], ["meta", "key"], ["legacyBackups", "id"]]) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
    }
  };
  const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const names = ["chats", "messages", "stickers", "drafts", "trash", "meta", "legacyBackups"];
  const transaction = db.transaction(names, "readwrite");
  state.chats.forEach(record => transaction.objectStore("chats").put(record));
  state.messages.forEach(record => transaction.objectStore("messages").put(record));
  state.customStickers.forEach(record => transaction.objectStore("stickers").put(record));
  Object.entries(state.drafts).forEach(([chatId, text]) => transaction.objectStore("drafts").put({ chatId, text }));
  state.trash.forEach(record => transaction.objectStore("trash").put(record));
  transaction.objectStore("meta").put({ key: "activeSchema", value: 1 });
  transaction.objectStore("meta").put({ key: "activeChatId", value: state.activeChatId });
  transaction.objectStore("legacyBackups").put({ id: "legacy-before-indexeddb-v1", verified: true, images: backupImages, storage: {}, recoverySnapshots: [] });
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
  db.close();
}

test.beforeEach(reset);
test.after(reset);

test("migration from a v0.9.2 fixture preserves chats, messages, images, and Trash", async () => {
  repository = await storage.open(adapters());
  assert.deepEqual([...repository.db.objectStoreNames], ["attachments", "chats", "drafts", "messages", "meta", "snapshots", "stickers", "trash"]);
  const migrated = await repository.load();
  const attachments = await repository.getAllAttachments();
  assert.deepEqual(core.stateCounts({ ...migrated, attachments }), { chats: 2, messages: 2, images: 1, trash: 1 });
  assert.deepEqual(repository.metadata.migrationCounts, { chats: 2, messages: 2, images: 1, trash: 1 });
  assert.equal((await repository.listSnapshots()).length, 1);
});

test("migration reads the active v0.9.2 transactional projection and recovers an image from its verified safety backup", async () => {
  const backupImage = { id: "image-1", name: "one.png", blob: new Blob(["backup-image"], { type: "image/png" }) };
  await seedV092Database(fixture, [backupImage]);
  repository = await storage.open(adapters({
    loadLegacyState: () => core.normalizeState({}, fallback),
    getAllImages: async () => [{ id: "image-1", name: "corrupt.png", blob: new Blob([]) }]
  }));
  const migrated = await repository.load();
  assert.equal(migrated.messages.some(message => message.id === "m2"), true);
  assert.equal((await repository.getAttachment("image-1")).blob.size, backupImage.blob.size);
});

test("migration failure leaves the complete v0.9.2 state available and does not activate the new database", async () => {
  localStorage.setItem("selfchat-data-v1", JSON.stringify(fixture));
  await assert.rejects(
    storage.open(adapters({ verifyMigration: async () => { throw new Error("injected verification failure"); } })),
    error => {
      assert.equal(error.legacyState.messages.length, fixture.messages.length);
      assert.equal(error.legacyState.trash.length, fixture.trash.length);
      return /injected verification failure/.test(error.message);
    }
  );
  assert.equal(JSON.parse(localStorage.getItem("selfchat-data-v1")).messages.length, 2);
  const request = indexedDB.open(storage.DB_NAME);
  const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const active = await new Promise((resolve, reject) => {
    const get = db.transaction("meta", "readonly").objectStore("meta").get("activeSchema");
    get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error);
  });
  db.close();
  assert.equal(active, undefined);
});

test("backup export and import round trip preserves state and attachment data", () => {
  const exported = core.backupPayload(fixture, [{ id: "image-1", name: "one.png", data: "data:image/png;base64,aW1hZ2U=" }], "2026-11-13T12:00:00.000Z");
  const imported = core.parseBackup(JSON.parse(JSON.stringify(exported)), fallback);
  assert.deepEqual(imported.state, fixture);
  assert.deepEqual(imported.attachments, exported.attachments);
});

test("old v0.9.2 backup files still import", () => {
  const oldBackup = { ...fixture, schemaVersion: 2, images: [{ id: "image-1", name: "one.png", data: "data:image/png;base64,aW1hZ2U=" }] };
  const imported = core.parseBackup(oldBackup, fallback);
  assert.equal(imported.schemaVersion, 2);
  assert.equal(imported.state.messages.length, 2);
  assert.equal(imported.attachments[0].id, "image-1");
});

test("permanent delete removes live, Trash, snapshot, and attachment copies without erasing unrelated data", async () => {
  repository = await storage.open(adapters());
  const target = fixture.messages.find(message => message.id === "m2");
  const targets = {
    entityIds: new Set([target.id]), chatIds: new Set(), messageIds: new Set([target.id]), imageIds: new Set([target.imageId])
  };
  const current = core.normalizeState({ ...fixture, messages: fixture.messages.filter(message => message.id !== target.id), trash: [] }, fallback);
  await repository.purgeEveryCopy(targets, current);
  const after = await repository.load();
  const snapshots = await repository.listSnapshots();
  assert.equal(after.messages.some(message => message.id === target.id), false);
  assert.equal(snapshots.some(snapshot => snapshot.state.messages.some(message => message.id === target.id)), false);
  assert.equal((await repository.getAllAttachments()).some(record => record.id === target.imageId), false);
  assert.equal(after.messages.some(message => message.id === "m1"), true);
});

test("a newer local move wins over an older backup import", () => {
  const original = fixture.messages[0];
  const moved = { ...original, chatId: "unsorted", movedAt: "2026-11-13T12:00:00.000Z" };
  const olderBackup = core.normalizeState({ ...fixture, messages: [{ ...original, chatId: "topic" }] }, fallback);
  const current = core.normalizeState({ ...fixture, messages: [moved] }, fallback);
  const merged = core.mergeStates([current, olderBackup], current, fallback);
  assert.equal(merged.messages.find(message => message.id === original.id).chatId, "unsorted");
  assert.equal(merged.messages.find(message => message.id === original.id).movedAt, moved.movedAt);
});

test("message metadata and its attachment commit in one IndexedDB transaction", async () => {
  repository = await storage.open(adapters());
  const message = { id: "atomic", chatId: "topic", type: "image", imageId: "atomic-image", createdAt: "2026-11-13T12:00:00.000Z" };
  await repository.commit({
    messagesPut: [message],
    attachmentsPut: [{ id: "atomic-image", name: "atomic.png", blob: new Blob(["atomic"], { type: "image/png" }) }],
    activeChatId: "topic"
  }, { significant: true, snapshotState: fixture });
  assert.equal((await repository.load()).messages.some(item => item.id === message.id), true);
  assert.equal((await repository.getAttachment("atomic-image")).blob.size, 6);
});

test("ordinary commits write changed records and create no more than one recovery point per day", async () => {
  repository = await storage.open(adapters({ getRecoverySnapshots: async () => [] }));
  await repository.commit({ messagesPut: [{ id: "first", chatId: "topic", text: "first", createdAt: "2026-11-13T12:00:00.000Z" }] }, { significant: true, snapshotState: fixture });
  await repository.commit({ messagesPut: [{ id: "second", chatId: "topic", text: "second", createdAt: "2026-11-13T12:01:00.000Z" }] }, { significant: true, snapshotState: fixture });
  const after = await repository.load();
  assert.equal(after.chats.some(chat => chat.id === "topic"), true);
  assert.equal(after.messages.some(message => message.id === "first"), true);
  assert.equal(after.messages.some(message => message.id === "second"), true);
  assert.equal((await repository.listSnapshots()).length, 1);
});
