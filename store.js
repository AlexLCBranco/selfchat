"use strict";
// Disk-backed SelfChat store: an append-only, hash-chained log plus content-addressed
// attachment files. The server process is the only writer. A change is acknowledged
// only after its log line has been written and flushed to disk.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const core = require("./store-core");

const FORMAT = "selfchat-disk-log";
const FORMAT_VERSION = 1;
const MANIFEST = "selfchat-data.json";
const LOG = "log.jsonl";
const ATTACHMENTS = "attachments";
const LOCK = ".lock";
const GENESIS_HASH = "0".repeat(64);
const HELD_LOCKS = new Set();
const UNSORTED = { id: "unsorted", name: "Unsorted", emoji: "📥", createdAt: "2026-01-01T00:00:03.000Z", permanent: true };
const DEFAULT_CHATS = [
  { id: "nba", name: "NBA", emoji: "🏀", createdAt: "2026-01-01T00:00:02.000Z" },
  { id: "ai", name: "Claude / Codex", emoji: "🤖", createdAt: "2026-01-01T00:00:01.000Z" },
  { id: "soccer", name: "Soccer", emoji: "⚽", createdAt: "2026-01-01T00:00:00.000Z" }
];

class StoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    Object.assign(this, details);
  }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function recordBody(record) {
  return {
    seq: record.seq,
    at: record.at,
    ops: record.ops,
    ...(record.origin ? { origin: record.origin } : {}),
    ...(record.label ? { label: record.label } : {})
  };
}

function recordHash(prev, record) {
  return sha256(`${prev}|${JSON.stringify(recordBody(record))}`);
}

function fsyncPath(target) {
  // Flush a file (or, where the platform allows, a directory) to disk.
  let fd;
  try {
    fd = fs.openSync(target, "r+");
    fs.fsyncSync(fd);
  } catch (error) {
    if (!["EISDIR", "EPERM", "EACCES"].includes(error.code)) throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function writeFileDurably(target, data, flag = "wx") {
  const fd = fs.openSync(target, flag);
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function localDay(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

class DataStore {
  constructor({ dataDir, createDefaults = true, now = () => new Date() } = {}) {
    if (!dataDir) throw new Error("dataDir is required");
    this.dataDir = path.resolve(dataDir);
    this.createDefaults = createDefaults;
    this.now = now;
    this.records = [];
    this.index = core.createIndex();
    this.lastHash = GENESIS_HASH;
    this.fd = null;
    this.lockHeld = false;
    this.listeners = new Set();
    this.status = null;
  }

  get seq() {
    return this.records.length;
  }

  paths() {
    return {
      manifest: path.join(this.dataDir, MANIFEST),
      log: path.join(this.dataDir, LOG),
      attachments: path.join(this.dataDir, ATTACHMENTS),
      lock: path.join(this.dataDir, LOCK)
    };
  }

  // Opens the data folder. Throws StoreError (never falls back to empty data) when the
  // folder exists but cannot be read or fails its integrity check.
  open() {
    const files = this.paths();
    let firstRun = false;
    let createdFolder = false;
    let stat = null;
    try {
      stat = fs.statSync(this.dataDir);
    } catch (error) {
      if (error.code !== "ENOENT") throw new StoreError("UNREADABLE", `The data folder cannot be read: ${error.message}`, { dataDir: this.dataDir });
    }
    if (stat && !stat.isDirectory()) throw new StoreError("UNREADABLE", "The data folder path exists but is not a folder.", { dataDir: this.dataDir });
    if (!stat) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (error) {
        throw new StoreError("UNREADABLE", `The data folder could not be created: ${error.message}`, { dataDir: this.dataDir });
      }
      createdFolder = true;
    }
    let entries;
    try {
      entries = fs.readdirSync(this.dataDir);
    } catch (error) {
      throw new StoreError("UNREADABLE", `The data folder cannot be read: ${error.message}`, { dataDir: this.dataDir });
    }
    const hasManifest = entries.includes(MANIFEST);
    if (!hasManifest) {
      const foreign = entries.filter(name => name !== LOCK);
      if (foreign.length) throw new StoreError("NOT_SELFCHAT", `The data folder is not empty and is not a SelfChat data folder (found ${foreign.slice(0, 3).join(", ")}).`, { dataDir: this.dataDir });
      firstRun = true;
    }

    this.acquireLock();
    try {
      if (firstRun) this.initialize(createdFolder && this.createDefaults);
      this.readManifest();
      const repair = this.loadLog();
      fs.mkdirSync(files.attachments, { recursive: true });
      this.fd = fs.openSync(files.log, "a");
      if (this.pendingGenesis) {
        this.pendingGenesis = false;
        this.append([UNSORTED, ...DEFAULT_CHATS].map(chat => ({ op: "put", store: "chats", value: chat })), { label: "first-run defaults" });
      }
      this.status = {
        ok: true,
        dataDir: this.dataDir,
        firstRun,
        createdFolder,
        defaultsCreated: firstRun && createdFolder && this.createDefaults,
        records: this.records.length,
        lastHash: this.lastHash,
        checkedAt: this.now().toISOString(),
        repair
      };
      return this.status;
    } catch (error) {
      this.releaseLock();
      throw error;
    }
  }

  acquireLock() {
    const { lock } = this.paths();
    if (HELD_LOCKS.has(lock)) throw new StoreError("LOCKED", "This data folder is already open in this SelfChat process.", { dataDir: this.dataDir, pid: process.pid });
    const body = JSON.stringify({ pid: process.pid, startedAt: this.now().toISOString() });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        writeFileDurably(lock, body, "wx");
        this.lockHeld = true;
        HELD_LOCKS.add(lock);
        return;
      } catch (error) {
        if (error.code !== "EEXIST") throw new StoreError("UNREADABLE", `The data folder lock could not be written: ${error.message}`, { dataDir: this.dataDir });
        let holder = null;
        try { holder = JSON.parse(fs.readFileSync(lock, "utf8")); } catch (_) {}
        if (holder && holder.pid !== process.pid && processAlive(holder.pid)) {
          throw new StoreError("LOCKED", `Another SelfChat process (pid ${holder.pid}) is using this data folder.`, { dataDir: this.dataDir, pid: holder.pid });
        }
        fs.rmSync(lock, { force: true });
      }
    }
    throw new StoreError("LOCKED", "The data folder lock could not be acquired.", { dataDir: this.dataDir });
  }

  releaseLock() {
    if (!this.lockHeld) return;
    try { fs.rmSync(this.paths().lock, { force: true }); } catch (_) {}
    HELD_LOCKS.delete(this.paths().lock);
    this.lockHeld = false;
  }

  initialize(withDefaults) {
    const files = this.paths();
    fs.mkdirSync(files.attachments, { recursive: true });
    writeFileDurably(files.log, "", "wx");
    const manifest = { format: FORMAT, version: FORMAT_VERSION, createdAt: this.now().toISOString() };
    writeFileDurably(files.manifest, JSON.stringify(manifest, null, 2), "wx");
    fsyncPath(this.dataDir);
    this.pendingGenesis = withDefaults;
  }

  readManifest() {
    const { manifest } = this.paths();
    let value;
    try {
      value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    } catch (error) {
      throw new StoreError("UNREADABLE", `The data folder manifest cannot be read: ${error.message}`, { dataDir: this.dataDir });
    }
    if (value?.format !== FORMAT || value.version !== FORMAT_VERSION) {
      throw new StoreError("UNREADABLE", "The data folder manifest has an unknown format.", { dataDir: this.dataDir });
    }
    this.manifest = value;
  }

  loadLog() {
    const { log } = this.paths();
    let buffer;
    try {
      buffer = fs.readFileSync(log);
    } catch (error) {
      throw new StoreError("UNREADABLE", `The message log cannot be read: ${error.message}`, { dataDir: this.dataDir });
    }
    let repair = null;
    const lastNewline = buffer.lastIndexOf(0x0a);
    const completeLength = lastNewline + 1;
    if (completeLength < buffer.length) {
      // A write was interrupted before its newline: that change was never acknowledged.
      // Keep the fragment beside the log, then cut the log back to its last complete line.
      const fragment = buffer.subarray(completeLength);
      const name = `interrupted-write-${this.now().toISOString().replace(/[:.]/g, "-")}.bin`;
      writeFileDurably(path.join(this.dataDir, name), fragment, "wx");
      const fd = fs.openSync(log, "r+");
      try {
        fs.ftruncateSync(fd, completeLength);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      repair = { bytes: fragment.length, savedAs: name };
      buffer = buffer.subarray(0, completeLength);
    }
    const text = buffer.toString("utf8");
    const lines = text ? text.slice(0, -1).split("\n") : [];
    let prev = GENESIS_HASH;
    lines.forEach((line, position) => {
      const lineNumber = position + 1;
      let record;
      try {
        record = JSON.parse(line);
      } catch (_) {
        throw new StoreError("INTEGRITY", `Log line ${lineNumber} is not valid JSON.`, { dataDir: this.dataDir, line: lineNumber });
      }
      if (record.seq !== lineNumber) throw new StoreError("INTEGRITY", `Log line ${lineNumber} has sequence ${record.seq}.`, { dataDir: this.dataDir, line: lineNumber });
      if (record.prev !== prev) throw new StoreError("INTEGRITY", `Log line ${lineNumber} does not follow the previous record (checksum chain broken).`, { dataDir: this.dataDir, line: lineNumber });
      if (record.hash !== recordHash(prev, record)) throw new StoreError("INTEGRITY", `Log line ${lineNumber} fails its checksum.`, { dataDir: this.dataDir, line: lineNumber });
      try {
        core.validateOps(record.ops);
      } catch (error) {
        throw new StoreError("INTEGRITY", `Log line ${lineNumber} contains an invalid change: ${error.message}`, { dataDir: this.dataDir, line: lineNumber });
      }
      record.ops.forEach(op => core.applyOpToIndex(this.index, op));
      this.records.push(record);
      prev = record.hash;
    });
    this.lastHash = prev;
    return repair;
  }

  ensureOpen() {
    if (this.fd === null) throw new StoreError("CLOSED", "The data store is not open.");
  }

  // The single write path. Validates, appends one line, flushes it, then applies it.
  append(ops, { origin = null, label = null, skipReferenceCheck = false } = {}) {
    this.ensureOpen();
    try {
      core.validateOps(ops);
    } catch (error) {
      throw new StoreError("INVALID", error.message);
    }
    if (!skipReferenceCheck) this.checkReferences(ops);
    const record = { seq: this.records.length + 1, at: this.now().toISOString(), ops: core.clone(ops) };
    if (origin) record.origin = String(origin).slice(0, 100);
    if (label) record.label = String(label).slice(0, 100);
    record.prev = this.lastHash;
    record.hash = recordHash(this.lastHash, record);
    const line = `${JSON.stringify(record)}\n`;
    const bytes = Buffer.from(line, "utf8");
    let written = 0;
    while (written < bytes.length) written += fs.writeSync(this.fd, bytes, written, bytes.length - written);
    fs.fsyncSync(this.fd);
    record.ops.forEach(op => core.applyOpToIndex(this.index, op));
    this.records.push(record);
    this.lastHash = record.hash;
    this.listeners.forEach(listener => { try { listener(record); } catch (_) {} });
    return record;
  }

  checkReferences(ops) {
    const pending = new Set(ops.filter(op => op.op === "attachment").map(op => op.value.id));
    ops.forEach(op => {
      if (op.op !== "put" || op.store === "trash") return;
      core.attachmentRefs(op.value).forEach(id => {
        if (!this.index.attachments.has(id) && !pending.has(id)) {
          throw new StoreError("MISSING_ATTACHMENT", `Attachment ${id} must be saved before the ${op.store.replace(/s$/, "")} that uses it.`);
        }
      });
    });
  }

  commit(ops, options = {}) {
    return this.append(ops, options);
  }

  // Writes the bytes, flushes them, re-reads and verifies the hash, then logs the record.
  addAttachment({ id, name = "", type = "", buffer, origin = null }) {
    this.ensureOpen();
    if (typeof id !== "string" || !id || id.length > 200) throw new StoreError("INVALID", "Attachment id is invalid.");
    if (!Buffer.isBuffer(buffer)) throw new StoreError("INVALID", "Attachment data is missing.");
    const hash = sha256(buffer);
    const existing = this.index.attachments.get(id);
    if (existing) {
      if (existing.hash !== hash) throw new StoreError("CONFLICT", `Attachment ${id} already exists with different content.`);
      return { record: null, attachment: existing, existing: true };
    }
    const dir = this.paths().attachments;
    const target = path.join(dir, hash);
    if (!fs.existsSync(target) || sha256(fs.readFileSync(target)) !== hash) {
      const temporary = path.join(dir, `${hash}.${process.pid}.${crypto.randomUUID()}.tmp`);
      writeFileDurably(temporary, buffer, "wx");
      fs.renameSync(temporary, target);
      fsyncPath(dir);
    }
    const verify = sha256(fs.readFileSync(target));
    if (verify !== hash) throw new StoreError("IO", `Attachment ${id} failed verification after writing.`);
    const attachment = { id, hash, name: String(name || "").slice(0, 300), type: String(type || "application/octet-stream").slice(0, 200), size: buffer.length, addedAt: this.now().toISOString() };
    const record = this.append([{ op: "attachment", value: attachment }], { origin });
    return { record, attachment, existing: false };
  }

  attachmentFile(id) {
    const attachment = this.index.attachments.get(id);
    if (!attachment) return null;
    return { attachment, file: path.join(this.paths().attachments, attachment.hash) };
  }

  readAttachment(id) {
    const found = this.attachmentFile(id);
    if (!found) return null;
    return { ...found, buffer: fs.readFileSync(found.file) };
  }

  state() {
    return core.indexToState(this.index);
  }

  stateAt(seq) {
    const index = core.createIndex();
    this.records.slice(0, Math.max(0, Math.min(seq, this.records.length))).forEach(record => record.ops.forEach(op => core.applyOpToIndex(index, op)));
    return core.indexToState(index);
  }

  counts(state = null) {
    if (state) return { chats: state.chats.length, messages: state.messages.length, attachments: Object.keys(state.attachments || {}).length, trash: state.trash.length };
    return { chats: this.index.chats.size, messages: this.index.messages.size, attachments: this.index.attachments.size, trash: this.index.trash.size };
  }

  // Recovery points derived from the log: the state just before each active day's first
  // change (one per day, newest 30 days) and the state just before each restore.
  recoveryPoints(maxDays = 30) {
    const boundaries = [];
    let previousDay = null;
    this.records.forEach(record => {
      if (record.label === "first-run defaults") return;
      const day = localDay(record.at);
      if (record.label === "restore") boundaries.push({ seq: record.seq - 1, createdAt: record.at, label: "Before restore", day });
      else if (day !== previousDay) boundaries.push({ seq: record.seq - 1, createdAt: record.at, label: "Daily recovery point", day });
      previousDay = day;
    });
    const daily = new Set();
    const selected = [];
    boundaries.slice().reverse().forEach(point => {
      if (point.label === "Daily recovery point") {
        if (daily.has(point.day) || daily.size >= maxDays) return;
        daily.add(point.day);
      }
      selected.push(point);
    });
    const wanted = new Map(selected.map(point => [point.seq, point]));
    const index = core.createIndex();
    const result = [];
    const capture = point => result.push({ id: String(point.seq), seq: point.seq, createdAt: point.createdAt, label: point.label, messageCount: index.messages.size, chatCount: index.chats.size });
    if (wanted.has(0)) capture(wanted.get(0));
    this.records.forEach(record => {
      record.ops.forEach(op => core.applyOpToIndex(index, op));
      if (wanted.has(record.seq)) capture(wanted.get(record.seq));
    });
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.seq - a.seq);
  }

  onRecord(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  recordsAfter(seq) {
    return this.records.slice(Math.max(0, seq));
  }

  close() {
    if (this.fd !== null) {
      try { fs.closeSync(this.fd); } catch (_) {}
      this.fd = null;
    }
    this.releaseLock();
  }
}

module.exports = { DataStore, StoreError, sha256, recordHash, GENESIS_HASH, FORMAT, MANIFEST, LOG, ATTACHMENTS, UNSORTED, DEFAULT_CHATS, localDay };
