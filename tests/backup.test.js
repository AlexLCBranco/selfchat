const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { DataStore } = require("../store");
const { runBackup, pruneBackups, listBackups, verifyBackupFile, BackupScheduler } = require("../backup");
const { importBackup, parseBackup } = require("../transfer");
const { fixtureBackup } = require("./fixtures");
const { tempDir, removeDir, message } = require("./helpers");

function setup(t) {
  const root = tempDir("backup");
  t.after(() => removeDir(root));
  const store = new DataStore({ dataDir: path.join(root, "data"), createDefaults: false });
  store.open();
  t.after(() => store.close());
  importBackup(store, fixtureBackup());
  return { store, backupDir: path.join(root, "backups") };
}

function snapshot(dir) {
  return Object.fromEntries(fs.readdirSync(dir).map(name => {
    const file = path.join(dir, name);
    return [name, { bytes: fs.readFileSync(file), mtime: fs.statSync(file).mtimeMs }];
  }));
}

test("a backup run never modifies an existing backup file", t => {
  const { store, backupDir } = setup(t);
  const now = new Date();
  fs.mkdirSync(backupDir, { recursive: true });
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const stamp = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
  // Same name the next run would choose, plus an unrelated file the owner keeps there.
  fs.writeFileSync(path.join(backupDir, `SelfChat backup ${day} ${stamp}.json`), "older backup bytes");
  fs.writeFileSync(path.join(backupDir, "my notes.txt"), "not a backup");
  const before = snapshot(backupDir);
  const results = [runBackup(store, backupDir, now), runBackup(store, backupDir, now)];
  store.commit([{ op: "put", store: "messages", value: message("later") }]);
  results.push(runBackup(store, backupDir, now));
  const after = snapshot(backupDir);
  for (const [name, original] of Object.entries(before)) {
    assert.ok(after[name], `${name} still exists`);
    assert.ok(after[name].bytes.equals(original.bytes), `${name} bytes unchanged`);
    assert.equal(after[name].mtime, original.mtime, `${name} not rewritten`);
  }
  assert.equal(new Set(results.map(result => result.file)).size, 3, "every run writes a new file");
  results.forEach(result => assert.equal(result.verified, true, result.error));
});

test("a backup is re-read and its counts match the live data", t => {
  const { store, backupDir } = setup(t);
  const result = runBackup(store, backupDir);
  assert.equal(result.verified, true);
  assert.deepEqual(result.counts, store.counts());
  const parsed = parseBackup(JSON.parse(fs.readFileSync(result.file, "utf8")));
  assert.equal(parsed.messages.length, 6);
});

test("verification reports a backup whose contents do not match", t => {
  const { store, backupDir } = setup(t);
  const result = runBackup(store, backupDir);
  const tampered = JSON.parse(fs.readFileSync(result.file, "utf8"));
  tampered.messages.pop();
  const copy = path.join(backupDir, "tampered.json");
  fs.writeFileSync(copy, JSON.stringify(tampered));
  const { problems } = verifyBackupFile(copy, store, store.counts());
  assert.match(problems.join(";"), /messages: file has 5, live data has 6/);
});

test("a dated backup restores into an empty store with every item", t => {
  const { store, backupDir } = setup(t);
  const result = runBackup(store, backupDir);
  const root = tempDir("restore");
  t.after(() => removeDir(root));
  const target = new DataStore({ dataDir: path.join(root, "data"), createDefaults: false });
  target.open();
  t.after(() => target.close());
  const report = importBackup(target, JSON.parse(fs.readFileSync(result.file, "utf8")));
  assert.equal(report.verification.ok, true);
  assert.deepEqual(target.counts(), store.counts());
});

test("retention keeps the newest 5 from today and one per day for 30 days", t => {
  const root = tempDir("prune");
  t.after(() => removeDir(root));
  const now = new Date(2026, 10, 24, 18, 0, 0);
  const name = (date, time) => `SelfChat backup ${date} ${time}.json`;
  const files = [
    ...["09-00-00", "10-00-00", "11-00-00", "12-00-00", "13-00-00", "14-00-00", "15-00-00"].map(time => name("2026-11-24", time)),
    name("2026-11-23", "08-00-00"), name("2026-11-23", "20-00-00"),
    name("2026-10-26", "10-00-00"),
    name("2026-10-20", "10-00-00")
  ];
  files.forEach(file => fs.writeFileSync(path.join(root, file), "{}"));
  fs.writeFileSync(path.join(root, "unrelated.json"), "{}");
  const removed = pruneBackups(root, now).sort();
  assert.deepEqual(removed, [name("2026-10-20", "10-00-00"), name("2026-11-23", "08-00-00"), name("2026-11-24", "09-00-00"), name("2026-11-24", "10-00-00")].sort());
  assert.ok(fs.existsSync(path.join(root, "unrelated.json")));
  assert.equal(listBackups(root).length, 7);
});

test("backups run at start and then at most hourly while there are changes", t => {
  const { store, backupDir } = setup(t);
  let clock = new Date(2026, 10, 24, 10, 0, 0);
  const scheduler = new BackupScheduler({ store, getDir: () => backupDir, now: () => clock, checkMs: 1e9 }).start();
  t.after(() => scheduler.stop());
  assert.equal(listBackups(backupDir).length, 1);
  clock = new Date(2026, 10, 24, 10, 30, 0);
  store.commit([{ op: "put", store: "messages", value: message("a") }]);
  scheduler.tick();
  assert.equal(listBackups(backupDir).length, 1, "not before an hour has passed");
  clock = new Date(2026, 10, 24, 11, 1, 0);
  scheduler.tick();
  assert.equal(listBackups(backupDir).length, 2);
  clock = new Date(2026, 10, 24, 12, 30, 0);
  scheduler.tick();
  assert.equal(listBackups(backupDir).length, 2, "no backup when nothing changed");
});
