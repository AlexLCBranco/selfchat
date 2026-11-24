const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { DataStore } = require("../store");
const core = require("../store-core");
const { tempDir, removeDir, message } = require("./helpers");

function freshStore(t, options = {}) {
  const root = tempDir("store");
  t.after(() => removeDir(root));
  const dataDir = path.join(root, "data");
  const store = new DataStore({ dataDir, ...options });
  store.open();
  t.after(() => store.close());
  return { store, dataDir, root };
}

function reopen(dataDir) {
  const store = new DataStore({ dataDir });
  store.open();
  return store;
}

test("a verified first run creates the folder with the built-in chats and says so", t => {
  const { store } = freshStore(t);
  assert.equal(store.status.firstRun, true);
  assert.equal(store.status.defaultsCreated, true);
  assert.deepEqual(store.state().chats.map(chat => chat.id).sort(), ["ai", "nba", "soccer", "unsorted"]);
});

test("an existing empty folder is initialized without the default chats", t => {
  const root = tempDir("store-empty");
  t.after(() => removeDir(root));
  const store = new DataStore({ dataDir: root });
  store.open();
  t.after(() => store.close());
  assert.equal(store.status.firstRun, true);
  assert.equal(store.status.defaultsCreated, false);
  assert.equal(store.state().chats.length, 0);
});

test("committed changes are on disk and survive reopening with an intact checksum chain", t => {
  const { store, dataDir } = freshStore(t);
  store.commit([{ op: "put", store: "messages", value: message("m1") }]);
  store.commit([{ op: "put", store: "messages", value: message("m2") }, { op: "draft", chatId: "nba", text: "draft" }]);
  const lastHash = store.lastHash;
  store.close();
  const again = reopen(dataDir);
  t.after(() => again.close());
  assert.equal(again.status.firstRun, false);
  assert.equal(again.seq, 3);
  assert.equal(again.lastHash, lastHash);
  assert.deepEqual(again.state().messages.map(item => item.id), ["m1", "m2"]);
  assert.equal(again.state().drafts.nba, "draft");
});

test("the log is append-only: earlier bytes never change", t => {
  const { store, dataDir } = freshStore(t);
  store.commit([{ op: "put", store: "messages", value: message("m1") }]);
  const before = fs.readFileSync(path.join(dataDir, "log.jsonl"));
  store.commit([{ op: "delete", store: "messages", id: "m1" }]);
  const after = fs.readFileSync(path.join(dataDir, "log.jsonl"));
  assert.ok(after.subarray(0, before.length).equals(before));
  assert.equal(store.state().messages.length, 0);
  assert.equal(store.stateAt(2).messages.length, 1, "the deleted message is still recoverable from the log");
});

test("a corrupted log line fails the integrity check instead of loading partial or empty data", t => {
  const { store, dataDir } = freshStore(t);
  store.commit([{ op: "put", store: "messages", value: message("m1", "nba", "original") }]);
  store.close();
  const file = path.join(dataDir, "log.jsonl");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("original", "tampered"));
  assert.throws(() => reopen(dataDir), error => error.code === "INTEGRITY" && /checksum/.test(error.message) && error.dataDir === dataDir);
});

test("a deleted line breaks the chain and is reported", t => {
  const { store, dataDir } = freshStore(t);
  store.commit([{ op: "put", store: "messages", value: message("m1") }]);
  store.commit([{ op: "put", store: "messages", value: message("m2") }]);
  store.close();
  const file = path.join(dataDir, "log.jsonl");
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.splice(1, 1);
  fs.writeFileSync(file, lines.join("\n"));
  assert.throws(() => reopen(dataDir), error => error.code === "INTEGRITY");
});

test("unreadable data folders are errors, never an empty store", t => {
  const root = tempDir("store-bad");
  t.after(() => removeDir(root));
  const notAFolder = path.join(root, "file-not-folder");
  fs.writeFileSync(notAFolder, "x");
  assert.throws(() => new DataStore({ dataDir: notAFolder }).open(), error => error.code === "UNREADABLE");

  const foreign = path.join(root, "foreign");
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, "notes.txt"), "mine");
  assert.throws(() => new DataStore({ dataDir: foreign }).open(), error => error.code === "NOT_SELFCHAT");

  const missingLog = path.join(root, "missing-log");
  const store = new DataStore({ dataDir: missingLog });
  store.open();
  store.close();
  fs.rmSync(path.join(missingLog, "log.jsonl"));
  assert.throws(() => new DataStore({ dataDir: missingLog }).open(), error => error.code === "UNREADABLE");
});

test("an interrupted (unacknowledged) final write is set aside and every complete record is kept", t => {
  const { store, dataDir } = freshStore(t);
  store.commit([{ op: "put", store: "messages", value: message("m1") }]);
  store.close();
  fs.appendFileSync(path.join(dataDir, "log.jsonl"), '{"seq":3,"at":"2026-11-24T00:00:00.000Z","ops":[{"op":"put","sto');
  const again = reopen(dataDir);
  t.after(() => again.close());
  assert.equal(again.seq, 2);
  assert.ok(again.status.repair);
  assert.ok(fs.existsSync(path.join(dataDir, again.status.repair.savedAs)));
  again.commit([{ op: "put", store: "messages", value: message("m3") }]);
  assert.deepEqual(again.state().messages.map(item => item.id), ["m1", "m3"]);
});

test("only one process may write a data folder", t => {
  const { dataDir } = freshStore(t);
  assert.throws(() => new DataStore({ dataDir }).open(), error => error.code === "LOCKED");
});

test("a stale lock left by a killed process does not block reopening", t => {
  const { store, dataDir } = freshStore(t);
  store.close();
  fs.writeFileSync(path.join(dataDir, ".lock"), JSON.stringify({ pid: 999999, startedAt: "2026-01-01T00:00:00.000Z" }));
  const again = reopen(dataDir);
  again.close();
});

test("attachments are verified files named by content hash and must exist before a message uses them", t => {
  const { store, dataDir } = freshStore(t);
  const image = { id: "m-img", chatId: "nba", type: "image", imageId: "img-1", createdAt: new Date().toISOString() };
  assert.throws(() => store.commit([{ op: "put", store: "messages", value: image }]), error => error.code === "MISSING_ATTACHMENT");
  const { attachment } = store.addAttachment({ id: "img-1", name: "a.png", type: "image/png", buffer: Buffer.from("png-bytes") });
  assert.equal(fs.readFileSync(path.join(dataDir, "attachments", attachment.hash), "utf8"), "png-bytes");
  store.commit([{ op: "put", store: "messages", value: image }]);
  assert.equal(store.addAttachment({ id: "img-1", buffer: Buffer.from("png-bytes") }).existing, true);
  assert.throws(() => store.addAttachment({ id: "img-1", buffer: Buffer.from("other") }), error => error.code === "CONFLICT");
});

test("invalid operations are rejected and nothing is written", t => {
  const { store } = freshStore(t);
  const seq = store.seq;
  assert.throws(() => store.commit([{ op: "put", store: "messages", value: { id: "x" } }]), error => error.code === "INVALID");
  assert.throws(() => store.commit([{ op: "delete", store: "chats", id: "unsorted" }]), error => error.code === "INVALID");
  assert.throws(() => store.commit([]), error => error.code === "INVALID");
  assert.equal(store.seq, seq);
});

test("a delete is never derived from a difference: undeclared removals are refused", () => {
  const before = { chats: [{ id: "nba", name: "NBA" }], messages: [message("m1"), message("m2")], customStickers: [], trash: [], drafts: {} };
  const after = { ...before, messages: [message("m2")] };
  assert.throws(() => core.operationsForChange(before, after), error => error.code === "UNDECLARED_DELETE");
  const ops = core.operationsForChange(before, after, { messages: ["m1"] });
  assert.deepEqual(ops, [{ op: "delete", store: "messages", id: "m1" }]);
});

test("browser-side and server-side replay produce the same state", () => {
  const ops = [
    { op: "put", store: "chats", value: { id: "nba", name: "NBA" } },
    { op: "put", store: "messages", value: message("m1") },
    { op: "put", store: "messages", value: { ...message("m1"), text: "edited" } },
    { op: "put", store: "trash", value: { id: "message:m2", entityType: "message", entityId: "m2", payload: {} } },
    { op: "tombstone", kind: "message", id: "m2", present: true },
    { op: "draft", chatId: "nba", text: "hi" },
    { op: "meta", key: "globalHiddenChatIds", value: ["nba"] }
  ];
  const index = core.createIndex();
  ops.forEach(op => core.applyOpToIndex(index, op));
  const server = core.indexToState(index);
  const browser = core.applyOpsToState({ chats: [], messages: [], customStickers: [], trash: [], deletedChatIds: [], deletedMessageIds: [], drafts: {} }, ops);
  for (const key of ["chats", "messages", "trash", "deletedMessageIds", "drafts", "meta"]) assert.deepEqual(browser[key], server[key], key);
});

test("recovery points come from the log: one per active day and one before each restore", t => {
  let clock = new Date("2026-11-20T10:00:00");
  const { store } = freshStore(t, { now: () => clock });
  store.commit([{ op: "put", store: "messages", value: message("m1") }]);
  clock = new Date("2026-11-21T10:00:00");
  store.commit([{ op: "put", store: "messages", value: message("m2") }]);
  store.commit([{ op: "put", store: "messages", value: message("m3") }]);
  clock = new Date("2026-11-21T11:00:00");
  store.commit([{ op: "delete", store: "messages", id: "m3" }], { label: "restore" });
  const points = store.recoveryPoints();
  assert.deepEqual(points.map(point => [point.label, point.messageCount]), [["Before restore", 3], ["Daily recovery point", 1], ["Daily recovery point", 0]]);
  assert.equal(store.stateAt(Number(points[0].id)).messages.length, 3);
});
