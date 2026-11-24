const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { DataStore } = require("../store");
const { importBackup } = require("../transfer");
const { fixtureBackup } = require("./fixtures");
const { ROOT, tempDir, removeDir, startServer, stopServer, request } = require("./helpers");

function emptyStore(t) {
  const root = tempDir("import");
  t.after(() => removeDir(root));
  const store = new DataStore({ dataDir: path.join(root, "data"), createDefaults: false });
  store.open();
  t.after(() => store.close());
  return { store, root };
}

test("importing a current-format backup with attachments gives matching counts", t => {
  const { store } = emptyStore(t);
  const backup = fixtureBackup();
  const report = importBackup(store, backup);
  assert.deepEqual(report.backup, { chats: 3, messages: 6, attachments: 5, trash: 2 });
  assert.deepEqual(report.storeAfter, report.backup);
  assert.equal(report.verification.ok, true);
  assert.deepEqual(report.skipped, []);
  assert.deepEqual(report.warnings, []);
  const state = store.state();
  assert.equal(state.drafts.nba, "unsent draft");
  assert.deepEqual(state.messages.find(item => item.id === "msg-2"), backup.messages.find(item => item.id === "msg-2"));
  assert.equal(store.readAttachment("att-file").buffer.toString(), "hello notes");
  assert.ok(state.deletedMessageIds.includes("msg-trashed"));
});

test("a second import of the same backup changes nothing", t => {
  const { store } = emptyStore(t);
  importBackup(store, fixtureBackup());
  const seq = store.seq;
  const before = JSON.stringify(store.state());
  const second = importBackup(store, fixtureBackup());
  assert.equal(second.operations, 0);
  assert.equal(store.seq, seq, "no log record is appended");
  assert.equal(JSON.stringify(store.state()), before);
  assert.equal(second.verification.ok, true);
  assert.deepEqual(second.added, { chats: 0, messages: 0, attachments: 0, trash: 0, customStickers: 0 });
});

test("import merges by stable id and never deletes existing data", t => {
  const { store } = emptyStore(t);
  store.commit([{ op: "put", store: "chats", value: { id: "mine", name: "Mine", createdAt: new Date().toISOString() } },
    { op: "put", store: "messages", value: { id: "newer", chatId: "mine", text: "written after the backup", createdAt: new Date().toISOString() } },
    { op: "put", store: "messages", value: { id: "msg-1", chatId: "nba", text: "newer edit", createdAt: "2026-11-20T12:02:00.000Z", editedAt: "2026-11-23T00:00:00.000Z" } }]);
  const report = importBackup(store, fixtureBackup());
  const state = store.state();
  assert.ok(state.messages.some(item => item.id === "newer"));
  assert.ok(state.chats.some(item => item.id === "mine"));
  assert.equal(state.messages.find(item => item.id === "msg-1").text, "newer edit", "the newer local version wins");
  assert.equal(report.verification.ok, true);
});

test("a dry run reports counts without writing", t => {
  const { store } = emptyStore(t);
  const seq = store.seq;
  const report = importBackup(store, fixtureBackup(), { dryRun: true });
  assert.equal(report.added.messages, 6);
  assert.equal(store.seq, seq);
  assert.equal(store.counts().messages, 0);
});

test("the import command prints matching counts for the owner", t => {
  const root = tempDir("import-cli");
  t.after(() => removeDir(root));
  const file = path.join(root, "backup.json");
  fs.writeFileSync(file, JSON.stringify(fixtureBackup()));
  const dataDir = path.join(root, "data");
  const run = () => execFileSync(process.execPath, [path.join(ROOT, "import-backup.js"), file, "--data", dataDir], { encoding: "utf8" });
  const first = run();
  assert.match(first, /messages\s+6\s+6\s+6\/6/);
  assert.match(first, /attachments\s+5\s+5\s+5\/5/);
  assert.match(first, /trash items\s+2\s+2\s+2\/2/);
  assert.match(first, /RESULT: MATCH/);
  const second = run();
  assert.match(second, /Added: 0 chats, 0 messages, 0 attachments, 0 trash items/);
  assert.match(second, /RESULT: MATCH/);
});

test("importing through the running app reports counts and then serves the data", async t => {
  const root = tempDir("import-server");
  const server = await startServer({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
  t.after(async () => { await stopServer(server); removeDir(root); });
  const response = await request(server, "POST", "/api/import", fixtureBackup());
  assert.equal(response.status, 200);
  assert.equal(response.json.report.verification.ok, true);
  const state = (await request(server, "GET", "/api/state")).json.state;
  assert.ok(state.messages.some(item => item.id === "msg-img"));
  const image = await request(server, "GET", "/api/attachments/att-image");
  assert.equal(image.status, 200);
  assert.equal(image.headers["content-type"], "image/png");
  const bad = await request(server, "POST", "/api/import", { hello: "world" });
  assert.equal(bad.status, 400);
});
