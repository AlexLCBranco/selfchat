"use strict";
// Export and import in the existing SelfChat JSON backup format (schemaVersion 4, with
// attachments as data URLs). Import merges by stable ID and never deletes.

const core = require("./store-core");
const { sha256 } = require("./store");

const SUPPORTED_SCHEMAS = [undefined, 1, 2, 3, 4];

function newerEntityTime(record) {
  return record?.updatedAt || record?.createdAt || "";
}

function messageVersionTime(message) {
  return [message?.movedAt, message?.editedAt, message?.updatedAt, message?.createdAt, ""].filter(Boolean).sort().at(-1) || "";
}

function backupPayload(store, exportedAt = new Date().toISOString()) {
  const state = store.state();
  const attachments = Object.values(state.attachments).map(attachment => {
    const found = store.readAttachment(attachment.id);
    return {
      id: attachment.id,
      name: attachment.name || "Attachment",
      type: attachment.type || "application/octet-stream",
      data: `data:${attachment.type || "application/octet-stream"};base64,${found.buffer.toString("base64")}`
    };
  });
  return {
    schemaVersion: 4,
    exportedAt,
    activeChatId: state.chats.find(chat => chat.id !== "unsorted")?.id || state.chats[0]?.id || "unsorted",
    chats: state.chats,
    messages: state.messages,
    customStickers: state.customStickers,
    trash: state.trash,
    deletedChatIds: state.deletedChatIds,
    deletedMessageIds: state.deletedMessageIds,
    drafts: state.drafts,
    attachments,
    selfchatLog: { seq: store.seq, hash: store.lastHash }
  };
}

function decodeDataUrl(value) {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(value || "");
  if (!match) throw new Error("Attachment data is not a data URL");
  const buffer = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { type: match[1] || "application/octet-stream", buffer };
}

function parseBackup(value) {
  if (!value || typeof value !== "object" || !SUPPORTED_SCHEMAS.includes(value.schemaVersion) || !Array.isArray(value.chats) || !Array.isArray(value.messages)) {
    throw Object.assign(new Error("This is not a SelfChat backup (missing chats/messages or unknown schemaVersion)."), { status: 400 });
  }
  const list = key => Array.isArray(value[key]) ? value[key] : [];
  return {
    schemaVersion: value.schemaVersion || 1,
    chats: list("chats"),
    messages: list("messages"),
    customStickers: list("customStickers"),
    trash: list("trash"),
    deletedChatIds: list("deletedChatIds").filter(id => typeof id === "string"),
    deletedMessageIds: list("deletedMessageIds").filter(id => typeof id === "string"),
    drafts: value.drafts && typeof value.drafts === "object" && !Array.isArray(value.drafts) ? value.drafts : {},
    attachments: Array.isArray(value.attachments) ? value.attachments : list("images")
  };
}

function backupCounts(parsed) {
  return { chats: parsed.chats.length, messages: parsed.messages.length, attachments: parsed.attachments.length, trash: parsed.trash.length };
}

function trashMessageIds(trash) {
  const ids = new Set();
  trash.forEach(item => {
    if (item?.entityType === "message") ids.add(item.entityId);
    (item?.payload?.messages || []).forEach(message => { if (message?.id) ids.add(message.id); });
  });
  return ids;
}

// Plans and applies an import. Returns a report with the counts the owner compares.
function importBackup(store, raw, { dryRun = false, origin = "import" } = {}) {
  const parsed = parseBackup(raw);
  const before = store.state();
  const report = {
    backup: backupCounts(parsed),
    storeBefore: store.counts(),
    added: { chats: 0, messages: 0, attachments: 0, trash: 0, customStickers: 0 },
    updated: { chats: 0, messages: 0, customStickers: 0, trash: 0 },
    unchanged: { chats: 0, messages: 0, attachments: 0, trash: 0, customStickers: 0 },
    skipped: [],
    warnings: []
  };

  // Attachments first, so every record that references one can be verified.
  const attachmentPlan = [];
  parsed.attachments.forEach((attachment, position) => {
    if (!attachment || typeof attachment.id !== "string" || !attachment.id) {
      report.skipped.push(`attachment #${position + 1}: missing id`);
      return;
    }
    let decoded;
    try { decoded = decodeDataUrl(attachment.data); } catch (error) {
      report.skipped.push(`attachment ${attachment.id}: ${error.message}`);
      return;
    }
    const existing = before.attachments[attachment.id];
    if (existing) {
      if (existing.hash !== sha256(decoded.buffer)) report.warnings.push(`attachment ${attachment.id}: a different file with this id already exists; kept the existing one`);
      report.unchanged.attachments += 1;
      return;
    }
    attachmentPlan.push({ id: attachment.id, name: attachment.name || "Attachment", type: attachment.type || decoded.type, buffer: decoded.buffer });
    report.added.attachments += 1;
  });

  const ops = [];
  const currentTrashMessageIds = trashMessageIds(before.trash);
  const currentTombstones = new Set(before.deletedMessageIds);
  const plan = (store_, records, compareTime, extraSkip = () => null) => {
    const existing = new Map(before[store_].map(item => [item.id, item]));
    const seen = new Set();
    records.forEach((record, position) => {
      if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id) {
        report.skipped.push(`${store_} #${position + 1}: missing id`);
        return;
      }
      if (seen.has(record.id)) {
        report.skipped.push(`${store_} ${record.id}: duplicate id inside the backup`);
        return;
      }
      seen.add(record.id);
      const op = { op: "put", store: store_, value: record };
      try { core.validateOp(op); } catch (error) {
        report.skipped.push(`${store_} ${record.id}: ${error.message}`);
        return;
      }
      const reason = extraSkip(record);
      if (reason) {
        report.skipped.push(`${store_} ${record.id}: ${reason}`);
        return;
      }
      const current = existing.get(record.id);
      if (!current) {
        ops.push(op);
        report.added[store_] += 1;
      } else if (JSON.stringify(current) !== JSON.stringify(record) && compareTime(record) > compareTime(current)) {
        ops.push(op);
        report.updated[store_] += 1;
      } else {
        report.unchanged[store_] += 1;
      }
    });
  };
  plan("chats", parsed.chats, newerEntityTime);
  plan("messages", parsed.messages, messageVersionTime, message => {
    // Same rule as the old app's merge: a message deleted here after the backup stays in Trash.
    if (!before.messages.some(item => item.id === message.id) && currentTrashMessageIds.has(message.id) && currentTombstones.has(message.id)) return "already in this store's Trash";
    return null;
  });
  plan("customStickers", parsed.customStickers, () => "");
  plan("trash", parsed.trash, item => item.deletedAt || "");
  const tombstoneOps = (ids, kind, existing) => ids.filter(id => !existing.includes(id)).map(id => ({ op: "tombstone", kind, id, present: true }));
  ops.push(...tombstoneOps(parsed.deletedChatIds, "chat", before.deletedChatIds));
  ops.push(...tombstoneOps(parsed.deletedMessageIds, "message", before.deletedMessageIds));
  Object.entries(parsed.drafts).forEach(([chatId, text]) => {
    if (typeof text === "string" && text && !before.drafts[chatId]) ops.push({ op: "draft", chatId, text });
  });

  const availableAttachments = new Set([...Object.keys(before.attachments), ...attachmentPlan.map(item => item.id)]);
  ops.forEach(op => {
    if (op.op !== "put" || op.store === "trash") return;
    core.attachmentRefs(op.value).forEach(id => {
      if (!availableAttachments.has(id)) report.warnings.push(`${op.store} ${op.value.id} references attachment ${id}, which is not in the backup or the store`);
    });
  });

  report.operations = ops.length;
  if (dryRun) {
    report.dryRun = true;
    report.storeAfter = null;
    return report;
  }
  attachmentPlan.forEach(item => store.addAttachment({ ...item, origin }));
  if (ops.length) store.append(ops, { origin, label: "import", skipReferenceCheck: true });
  report.storeAfter = store.counts();
  report.verification = verifyImport(store, parsed);
  return report;
}

// After import, every item in the backup must be accounted for in the store.
function verifyImport(store, parsed) {
  const state = store.state();
  const chats = new Set(state.chats.map(item => item.id));
  const messages = new Set(state.messages.map(item => item.id));
  const inTrash = trashMessageIds(state.trash);
  const trash = new Set(state.trash.map(item => item.id));
  const attachments = new Set(Object.keys(state.attachments));
  const idOf = item => (item && typeof item.id === "string" ? item.id : null);
  const missing = {
    chats: parsed.chats.map(idOf).filter(id => id && !chats.has(id) && !state.deletedChatIds.includes(id)),
    messages: parsed.messages.map(idOf).filter(id => id && !messages.has(id) && !inTrash.has(id)),
    attachments: parsed.attachments.map(idOf).filter(id => id && !attachments.has(id)),
    trash: parsed.trash.map(idOf).filter(id => id && !trash.has(id))
  };
  const found = {
    chats: parsed.chats.length - missing.chats.length,
    messages: parsed.messages.length - missing.messages.length,
    attachments: parsed.attachments.length - missing.attachments.length,
    trash: parsed.trash.length - missing.trash.length
  };
  const ok = Object.values(missing).every(list => list.length === 0);
  return { ok, found, missing };
}

function formatReport(report) {
  const rows = ["chats", "messages", "attachments", "trash"];
  const lines = [];
  lines.push(`${"".padEnd(13)}${"in backup".padStart(11)}${"in store".padStart(11)}${"found".padStart(9)}`);
  rows.forEach(key => {
    const label = key === "trash" ? "trash items" : key;
    const after = report.storeAfter ? report.storeAfter[key] : "-";
    const found = report.verification ? `${report.verification.found[key]}/${report.backup[key]}` : "-";
    lines.push(`${label.padEnd(13)}${String(report.backup[key]).padStart(11)}${String(after).padStart(11)}${found.padStart(9)}`);
  });
  lines.push("");
  lines.push(`Added: ${report.added.chats} chats, ${report.added.messages} messages, ${report.added.attachments} attachments, ${report.added.trash} trash items, ${report.added.customStickers} stickers`);
  lines.push(`Updated to newer version: ${report.updated.chats} chats, ${report.updated.messages} messages`);
  lines.push(`Already present: ${report.unchanged.chats} chats, ${report.unchanged.messages} messages, ${report.unchanged.attachments} attachments, ${report.unchanged.trash} trash items`);
  if (report.skipped.length) lines.push(`Skipped (${report.skipped.length}):`, ...report.skipped.slice(0, 50).map(item => `  - ${item}`));
  if (report.warnings.length) lines.push(`Warnings (${report.warnings.length}):`, ...report.warnings.slice(0, 50).map(item => `  - ${item}`));
  if (report.verification) {
    lines.push("");
    lines.push(report.verification.ok
      ? "RESULT: MATCH - every chat, message, attachment and trash item in the backup is in the store."
      : `RESULT: MISMATCH - missing ${Object.entries(report.verification.missing).filter(([, list]) => list.length).map(([key, list]) => `${list.length} ${key}`).join(", ")}.`);
  }
  return lines.join("\n");
}

module.exports = { backupPayload, parseBackup, importBackup, verifyImport, formatReport, decodeDataUrl, backupCounts };
