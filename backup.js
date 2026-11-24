"use strict";
// Dated automatic backups. A backup file is created once and never modified.
// After writing, the file is re-read and compared with the live data.

const fs = require("fs");
const path = require("path");
const { backupPayload, parseBackup, backupCounts, decodeDataUrl } = require("./transfer");
const { sha256 } = require("./store");

const NAME_PATTERN = /^SelfChat backup (\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-(\d{2})(?: \((\d+)\))?\.json$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function localStamp(date) {
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  };
}

function listBackups(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return names.map(name => {
    const match = NAME_PATTERN.exec(name);
    if (!match) return null;
    const [, day, hours, minutes, seconds, copy] = match;
    return { name, file: path.join(dir, name), day, sortKey: `${day} ${hours}-${minutes}-${seconds} ${String(Number(copy || 1)).padStart(4, "0")}`, at: new Date(`${day}T${hours}:${minutes}:${seconds}`).toISOString() };
  }).filter(Boolean).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function latestBackup(dir) {
  const [latest] = listBackups(dir);
  if (!latest) return null;
  let seq = null;
  try {
    const fd = fs.openSync(latest.file, "r");
    const head = Buffer.alloc(4096);
    const length = fs.readSync(fd, head, 0, head.length, 0);
    fs.closeSync(fd);
    const match = /"selfchatLog"\s*:\s*\{\s*"seq"\s*:\s*(\d+)/.exec(head.subarray(0, length).toString("utf8"));
    if (match) seq = Number(match[1]);
  } catch (_) {}
  return { ...latest, seq };
}

function writeNew(dir, baseName, data) {
  for (let copy = 1; copy < 1000; copy += 1) {
    const name = copy === 1 ? `${baseName}.json` : `${baseName} (${copy}).json`;
    const file = path.join(dir, name);
    let fd;
    try {
      fd = fs.openSync(file, "wx");
    } catch (error) {
      if (error.code === "EEXIST") continue;
      throw error;
    }
    try {
      fs.writeSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return file;
  }
  throw new Error("Could not find a free backup file name");
}

function verifyBackupFile(file, store, expected) {
  const parsed = parseBackup(JSON.parse(fs.readFileSync(file, "utf8")));
  const counts = backupCounts(parsed);
  const problems = Object.keys(expected).filter(key => counts[key] !== expected[key]).map(key => `${key}: file has ${counts[key]}, live data has ${expected[key]}`);
  const live = store.state().attachments;
  parsed.attachments.forEach(attachment => {
    const known = live[attachment.id];
    if (!known) return;
    if (sha256(decodeDataUrl(attachment.data).buffer) !== known.hash) problems.push(`attachment ${attachment.id} content differs`);
  });
  return { counts, problems };
}

function runBackup(store, dir, now = new Date()) {
  const startedAt = now.toISOString();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const payload = backupPayload(store, startedAt);
    const expected = { chats: payload.chats.length, messages: payload.messages.length, attachments: payload.attachments.length, trash: payload.trash.length };
    const { selfchatLog, ...rest } = payload;
    const ordered = { schemaVersion: rest.schemaVersion, exportedAt: rest.exportedAt, selfchatLog, ...rest };
    const stamp = localStamp(now);
    const file = writeNew(dir, `SelfChat backup ${stamp.day} ${stamp.time}`, JSON.stringify(ordered));
    const { counts, problems } = verifyBackupFile(file, store, expected);
    return { at: startedAt, file, seq: selfchatLog.seq, counts, verified: problems.length === 0, error: problems.length ? `Backup verification failed: ${problems.join("; ")}` : null };
  } catch (error) {
    return { at: startedAt, file: null, seq: null, counts: null, verified: false, error: `Backup failed: ${error.message}` };
  }
}

// Keeps the newest `keepToday` backups from today and the newest backup of each of the
// previous `days` days. Only files named by SelfChat are ever considered.
function pruneBackups(dir, now = new Date(), { keepToday = 5, days = 30 } = {}) {
  const today = localStamp(now).day;
  const oldest = new Date(now);
  oldest.setDate(oldest.getDate() - days);
  const oldestDay = localStamp(oldest).day;
  const keptPerDay = new Map();
  const removed = [];
  listBackups(dir).forEach(backup => {
    const kept = keptPerDay.get(backup.day) || 0;
    const limit = backup.day === today ? keepToday : backup.day > oldestDay ? 1 : 0;
    if (backup.day > today) return;
    if (kept < limit) {
      keptPerDay.set(backup.day, kept + 1);
      return;
    }
    fs.rmSync(backup.file, { force: true });
    removed.push(backup.name);
  });
  return removed;
}

class BackupScheduler {
  constructor({ store, getDir, intervalMs = 60 * 60 * 1000, checkMs = 60 * 1000, now = () => new Date(), log = () => {} }) {
    Object.assign(this, { store, getDir, intervalMs, checkMs, now, log });
    this.last = null;
    this.timer = null;
    this.running = false;
  }

  start() {
    const dir = this.getDir();
    const latest = (() => { try { return latestBackup(dir); } catch (_) { return null; } })();
    if (latest) this.last = { at: latest.at, file: latest.file, seq: latest.seq, verified: null, error: null, fromDisk: true };
    if (!latest || latest.seq !== this.store.seq) this.run("startup");
    this.timer = setInterval(() => this.tick(), this.checkMs);
    this.timer.unref?.();
    return this;
  }

  tick() {
    if (!this.last || this.last.seq === this.store.seq) return;
    if (this.now() - new Date(this.last.at) < this.intervalMs) return;
    this.run("hourly");
  }

  run(reason = "manual") {
    if (this.running) return this.last;
    this.running = true;
    try {
      const dir = this.getDir();
      const result = runBackup(this.store, dir, this.now());
      result.reason = reason;
      if (result.verified) {
        try { result.pruned = pruneBackups(dir, this.now()); } catch (error) { result.pruneError = error.message; }
      }
      this.last = result;
      this.log(result.error ? result.error : `Backup written: ${result.file}`);
      return result;
    } finally {
      this.running = false;
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { runBackup, pruneBackups, listBackups, latestBackup, verifyBackupFile, BackupScheduler, NAME_PATTERN };
