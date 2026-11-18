const test = require("node:test");
const assert = require("node:assert/strict");
const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
const { webcrypto } = require("node:crypto");

global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
global.SelfChatStorageCore = require("../storage-core.js");
global.SelfChatSyncCrypto = require("../sync-crypto.js");

const values = new Map();
global.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
  clear: () => values.clear()
};

const storage = require("../storage.js");
const core = global.SelfChatStorageCore;
const syncCrypto = global.SelfChatSyncCrypto;
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
    createSyncSecurityFoundation: async ({ deviceIdentity, createdAt }) => ({
      profile: { version: 1, id: "profile-test", createdAt, algorithm: "AES-GCM-256", keyMaterial: "test-key-material" },
      credentials: {
        version: 1,
        deviceId: deviceIdentity.id,
        createdAt,
        signing: { publicJwk: { kty: "EC", x: "sign-x", y: "sign-y" }, privateJwk: { kty: "EC", d: "sign-private" } },
        agreement: { publicJwk: { kty: "EC", x: "agree-x", y: "agree-y" }, privateJwk: { kty: "EC", d: "agree-private" } }
      }
    }),
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

async function seedUnifiedV1Database(state) {
  const request = indexedDB.open(storage.DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const [name, keyPath] of [["chats", "id"], ["messages", "id"], ["stickers", "id"], ["drafts", "chatId"], ["attachments", "id"], ["trash", "id"], ["snapshots", "id"], ["meta", "key"]]) {
      db.createObjectStore(name, { keyPath });
    }
  };
  const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const transaction = db.transaction(["chats", "messages", "stickers", "drafts", "attachments", "trash", "meta"], "readwrite");
  state.chats.forEach(record => transaction.objectStore("chats").put(record));
  state.messages.forEach(record => transaction.objectStore("messages").put(record));
  state.customStickers.forEach(record => transaction.objectStore("stickers").put(record));
  Object.entries(state.drafts).forEach(([chatId, text]) => transaction.objectStore("drafts").put({ chatId, text }));
  state.trash.forEach(record => transaction.objectStore("trash").put(record));
  transaction.objectStore("attachments").put({ id: "image-1", name: "one.png", blob: new Blob(["image"], { type: "image/png" }) });
  transaction.objectStore("meta").put({ key: "activeSchema", value: 1 });
  transaction.objectStore("meta").put({ key: "activeChatId", value: state.activeChatId });
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
  db.close();
}

test.beforeEach(reset);
test.after(reset);

test("migration from a v0.9.2 fixture preserves chats, messages, images, and Trash", async () => {
  repository = await storage.open(adapters());
  assert.deepEqual([...repository.db.objectStoreNames], ["attachments", "chats", "drafts", "messages", "meta", "operations", "snapshots", "stickers", "trash"]);
  const migrated = await repository.load();
  const attachments = await repository.getAllAttachments();
  assert.deepEqual(core.stateCounts({ ...migrated, attachments }), { chats: 2, messages: 2, images: 1, trash: 1 });
  assert.deepEqual(repository.metadata.migrationCounts, { chats: 2, messages: 2, images: 1, trash: 1 });
  assert.equal((await repository.listSnapshots()).length, 1);
});

test("schema upgrade preserves an existing unified v1 profile and adds sync history", async () => {
  await seedUnifiedV1Database(fixture);
  repository = await storage.open(adapters({ createDeviceId: () => "upgrade-device" }));
  const upgraded = await repository.load();
  assert.deepEqual(core.stateCounts({ ...upgraded, attachments: await repository.getAllAttachments() }), { chats: 2, messages: 2, images: 1, trash: 1 });
  assert.equal(repository.metadata.deviceIdentity.id, "upgrade-device");
  assert.equal((await repository.listOperations()).some(operation => operation.entityId === "m1"), true);
});

test("global visibility metadata persists without changing chat records", async () => {
  repository = await storage.open(adapters());
  const before = await repository.load();
  await repository.setMeta("globalHiddenChatIds", ["topic"]);
  assert.deepEqual(await repository.getMeta("globalHiddenChatIds"), ["topic"]);
  assert.deepEqual((await repository.load()).chats, before.chats);
  repository.close();
  repository = await storage.open(adapters());
  assert.deepEqual(repository.metadata.globalHiddenChatIds, ["topic"]);
  assert.equal((await repository.listOperations()).some(operation => operation.store === "meta" && operation.entityId === "globalHiddenChatIds"), true);
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
  assert.equal(exported.schemaVersion, 4);
});

test("custom chat avatar survives a backup round trip", () => {
  const withAvatar = core.normalizeState({
    ...fixture,
    chats: fixture.chats.map(chat => chat.id === "topic" ? { ...chat, avatarImageId: "avatar-1", updatedAt: "2026-11-14T12:00:00.000Z" } : chat)
  }, fallback);
  const exported = core.backupPayload(withAvatar, [{ id: "avatar-1", name: "topic.webp", type: "image/webp", data: "data:image/webp;base64,YXZhdGFy" }]);
  const imported = core.parseBackup(JSON.parse(JSON.stringify(exported)), fallback);
  assert.equal(imported.state.chats.find(chat => chat.id === "topic").avatarImageId, "avatar-1");
  assert.equal(imported.attachments[0].id, "avatar-1");
});

test("chat pin state survives a backup round trip", () => {
  const pinned = core.normalizeState({
    ...fixture,
    chats: fixture.chats.map(chat => chat.id === "topic" ? {
      ...chat,
      pinnedAt: "2026-11-14T12:00:00.000Z",
      updatedAt: "2026-11-14T12:00:00.000Z"
    } : chat)
  }, fallback);
  const exported = core.backupPayload(pinned, []);
  const imported = core.parseBackup(JSON.parse(JSON.stringify(exported)), fallback);
  assert.equal(imported.state.chats.find(chat => chat.id === "topic").pinnedAt, "2026-11-14T12:00:00.000Z");
});

test("chat-specific notes survive a backup round trip", () => {
  const withNotes = core.normalizeState({
    ...fixture,
    chats: fixture.chats.map(chat => chat.id === "topic" ? {
      ...chat,
      note: "Project context\n- Keep this local",
      noteUpdatedAt: "2026-11-14T13:00:00.000Z",
      updatedAt: "2026-11-14T13:00:00.000Z"
    } : chat)
  }, fallback);
  const imported = core.parseBackup(JSON.parse(JSON.stringify(core.backupPayload(withNotes, []))), fallback);
  assert.equal(imported.state.chats.find(chat => chat.id === "topic").note, "Project context\n- Keep this local");
  assert.equal(imported.state.chats.find(chat => chat.id === "topic").noteUpdatedAt, "2026-11-14T13:00:00.000Z");
});

test("message star and pin metadata survive a backup round trip", () => {
  const marked = core.normalizeState({
    ...fixture,
    messages: fixture.messages.map(message => ({
      ...message,
      starredAt: "2026-11-14T12:00:00.000Z",
      pinnedAt: "2026-11-14T12:01:00.000Z",
      updatedAt: "2026-11-14T12:01:00.000Z"
    }))
  }, fallback);
  const imported = core.parseBackup(JSON.parse(JSON.stringify(core.backupPayload(marked, []))), fallback);
  assert.equal(imported.state.messages[0].starredAt, "2026-11-14T12:00:00.000Z");
  assert.equal(imported.state.messages[0].pinnedAt, "2026-11-14T12:01:00.000Z");
});

test("file attachment survives a backup round trip", () => {
  const fileMessage = {
    id: "file-message", chatId: "topic", type: "file", attachmentId: "file-1",
    fileName: "notes.pdf", fileType: "application/pdf", fileSize: 4,
    createdAt: "2026-11-13T12:00:00.000Z"
  };
  const withFile = core.normalizeState({ ...fixture, messages: [...fixture.messages, fileMessage] }, fallback);
  const exported = core.backupPayload(withFile, [{
    id: "file-1", name: "notes.pdf", type: "application/pdf", data: "data:application/pdf;base64,dGVzdA=="
  }]);
  const imported = core.parseBackup(JSON.parse(JSON.stringify(exported)), fallback);
  assert.deepEqual(imported.state.messages.find(message => message.id === fileMessage.id), fileMessage);
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

test("sync foundation creates one durable device identity and bootstraps existing data", async () => {
  repository = await storage.open(adapters({ createDeviceId: () => "device-a" }));
  const firstIdentity = repository.metadata.deviceIdentity;
  const firstOperations = await repository.listOperations();
  assert.equal(firstIdentity.id, "device-a");
  assert.equal(firstOperations.some(operation => operation.store === "messages" && operation.entityId === "m1"), true);
  assert.equal(new Set(firstOperations.map(operation => operation.id)).size, firstOperations.length);
  const firstClock = repository.metadata.logicalClock;

  repository.close();
  repository = await storage.open(adapters({ createDeviceId: () => "replacement-device" }));
  assert.deepEqual(repository.metadata.deviceIdentity, firstIdentity);
  assert.equal(repository.metadata.logicalClock, firstClock);
  assert.equal((await repository.listOperations()).length, firstOperations.length);
});

test("sync security foundation persists one encrypted profile identity while transport stays disabled", async () => {
  repository = await storage.open(adapters({ createDeviceId: () => "device-secure" }));
  assert.equal(repository.metadata.syncProfile.id, "profile-test");
  assert.equal(repository.metadata.deviceCredentials.deviceId, "device-secure");
  assert.deepEqual(repository.metadata.authorizedDevices.map(device => device.deviceId), ["device-secure"]);
  assert.deepEqual(repository.metadata.syncTransport, { configured: false, enabled: false });
  const firstCredentials = structuredClone(repository.metadata.deviceCredentials);
  repository.close();
  repository = await storage.open(adapters({ createDeviceId: () => "replacement-device" }));
  assert.deepEqual(repository.metadata.deviceCredentials, firstCredentials);
  assert.equal(repository.metadata.syncTransport.enabled, false);
});

test("entity data and its logical operation commit atomically with monotonic ordering", async () => {
  repository = await storage.open(adapters({ createDeviceId: () => "device-a" }));
  const before = await repository.listOperations();
  await repository.commit({
    messagesPut: [{ id: "logical", chatId: "topic", text: "ordered", createdAt: "2026-11-18T12:00:00.000Z" }]
  }, { significant: false });
  const operation = (await repository.listOperations()).find(item => item.entityId === "logical");
  assert.equal((await repository.load()).messages.some(message => message.id === "logical"), true);
  assert.equal(operation.deviceId, "device-a");
  assert.equal(operation.action, "put");
  assert.equal(operation.counter, Math.max(...before.map(item => item.counter)) + 1);
  assert.equal(repository.metadata.logicalClock, operation.counter);
});

test("concurrent local commits receive distinct monotonic operation IDs", async () => {
  repository = await storage.open(adapters({ createDeviceId: () => "device-a" }));
  await Promise.all([
    repository.commit({ messagesPut: [{ id: "parallel-1", chatId: "topic", text: "one" }] }, { significant: false }),
    repository.commit({ messagesPut: [{ id: "parallel-2", chatId: "topic", text: "two" }] }, { significant: false })
  ]);
  const operations = (await repository.listOperations()).filter(operation => operation.entityId.startsWith("parallel-"));
  assert.equal(operations.length, 2);
  assert.equal(new Set(operations.map(operation => operation.id)).size, 2);
  assert.equal(Math.abs(operations[0].counter - operations[1].counter), 1);
});

test("permanent deletion also removes matching local sync history", async () => {
  repository = await storage.open(adapters({ createDeviceId: () => "device-a" }));
  assert.equal((await repository.listOperations()).some(operation => operation.entityId === "m2"), true);
  const target = fixture.messages.find(message => message.id === "m2");
  const targets = {
    entityIds: new Set([target.id]), chatIds: new Set(), messageIds: new Set([target.id]), imageIds: new Set([target.imageId])
  };
  const current = core.normalizeState({ ...fixture, messages: fixture.messages.filter(message => message.id !== target.id), trash: [] }, fallback);
  await repository.purgeEveryCopy(targets, current);
  assert.equal((await repository.listOperations()).some(operation => operation.entityId === target.id || operation.entityId === target.imageId), false);
});

test("pairing joins an invited profile and persists both trusted device identities", async () => {
  repository = await storage.open(adapters({
    createDeviceId: () => "joining-device",
    createSyncSecurityFoundation: async ({ deviceIdentity, createdAt }) => ({
      profile: { version: 1, id: "temporary-profile", createdAt, algorithm: "AES-GCM-256", keyMaterial: syncCrypto.generateProfileKey(webcrypto) },
      credentials: await syncCrypto.generateDeviceCredentials({ deviceId: deviceIdentity.id, createdAt, crypto: webcrypto })
    })
  }));
  const authorizer = await syncCrypto.generateDeviceCredentials({ deviceId: "authorizer-device", crypto: webcrypto });
  const invitedProfile = { id: "invited-profile", keyMaterial: syncCrypto.generateProfileKey(webcrypto) };
  const invitation = await syncCrypto.createPairingInvitation(authorizer, invitedProfile, { deviceLabel: "Main PC", crypto: webcrypto });
  const { request, verificationCode } = await repository.createPairingRequest(invitation, "Laptop");
  const grant = await syncCrypto.issueEnrollmentGrant(request, authorizer, invitedProfile, { crypto: webcrypto });
  const result = await repository.acceptPairingGrant(grant);
  assert.equal(result.profileId, "invited-profile");
  assert.equal(result.verificationCode, verificationCode);
  assert.deepEqual(repository.metadata.authorizedDevices.map(device => device.deviceId), ["authorizer-device", "joining-device"]);
  assert.equal(repository.metadata.syncProfile.keyMaterial, invitedProfile.keyMaterial);
});

test("authorized encrypted updates apply atomically and durable replay cursors reject retries", async () => {
  repository = await storage.open(adapters({
    createDeviceId: () => "local-device",
    createSyncSecurityFoundation: async ({ deviceIdentity, createdAt }) => ({
      profile: { version: 1, id: "shared-profile", createdAt, algorithm: "AES-GCM-256", keyMaterial: syncCrypto.generateProfileKey(webcrypto) },
      credentials: await syncCrypto.generateDeviceCredentials({ deviceId: deviceIdentity.id, createdAt, crypto: webcrypto })
    })
  }));
  const remote = await syncCrypto.generateDeviceCredentials({ deviceId: "remote-device", crypto: webcrypto });
  await repository.setMeta("authorizedDevices", [...repository.metadata.authorizedDevices, {
    deviceId: remote.deviceId,
    signingPublicJwk: remote.signing.publicJwk,
    agreementPublicJwk: remote.agreement.publicJwk,
    authorizedAt: new Date().toISOString(),
    authorizedBy: "local-device"
  }]);
  const operation = { id: "remote-device:100", deviceId: "remote-device", counter: 100, store: "chats", entityType: "chat", entityId: "remote-chat", action: "put", recordedAt: new Date().toISOString(), value: { id: "remote-chat", name: "Remote", emoji: "R", createdAt: new Date().toISOString() } };
  const envelope = await syncCrypto.createOperationEnvelope([operation], remote, repository.metadata.syncProfile, { sequence: 1, crypto: webcrypto });
  assert.deepEqual(await repository.applyRemoteEnvelope(envelope), { received: 1, stored: 1, applied: 1, deviceId: "remote-device", sequence: 1 });
  assert.equal((await repository.load()).chats.some(chat => chat.id === "remote-chat"), true);
  assert.equal(repository.metadata.logicalClock, 100);
  await assert.rejects(repository.applyRemoteEnvelope(envelope), /stale or replayed/);
  assert.equal((await repository.listOperations()).filter(item => item.id === operation.id).length, 1);
  const deletion = { id: "remote-device:101", deviceId: "remote-device", counter: 101, store: "chats", entityType: "chat", entityId: "remote-chat", action: "delete", recordedAt: new Date().toISOString() };
  const deletionEnvelope = await syncCrypto.createOperationEnvelope([deletion], remote, repository.metadata.syncProfile, { sequence: 2, crypto: webcrypto });
  assert.equal((await repository.applyRemoteEnvelope(deletionEnvelope)).applied, 1);
  assert.equal((await repository.load()).chats.some(chat => chat.id === "remote-chat"), false);
  await repository.blockAuthorizedDevice("remote-device");
  const blockedEnvelope = await syncCrypto.createOperationEnvelope([{ ...operation, id: "remote-device:102", counter: 102, entityId: "blocked-chat", value: { ...operation.value, id: "blocked-chat" } }], remote, repository.metadata.syncProfile, { sequence: 3, crypto: webcrypto });
  await assert.rejects(repository.applyRemoteEnvelope(blockedEnvelope), /not from an authorized device/);
  assert.equal((await repository.load()).chats.some(chat => chat.id === "blocked-chat"), false);
});
