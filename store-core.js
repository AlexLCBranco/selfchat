(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatStoreCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Shared by the server (log replay) and the browser (live updates).
  // A log record is { seq, at, ops: [...], origin?, label?, prev, hash }.
  // Operations are explicit: a delete exists only when a user action created one.

  const RECORD_STORES = Object.freeze(["chats", "messages", "customStickers", "trash"]);
  const META_KEYS = Object.freeze(["globalHiddenChatIds", "backupDir"]);
  const MAX_ID_LENGTH = 200;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function validId(value) {
    return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
  }

  function validDate(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function validateOp(op) {
    if (!op || typeof op !== "object" || Array.isArray(op)) throw new Error("Operation must be an object");
    switch (op.op) {
      case "put": {
        if (!RECORD_STORES.includes(op.store)) throw new Error(`Unknown store: ${op.store}`);
        const value = op.value;
        if (!value || typeof value !== "object" || Array.isArray(value) || !validId(value.id)) throw new Error(`A ${op.store} record needs an id`);
        if (op.store === "chats" && typeof value.name !== "string") throw new Error(`Chat ${value.id} needs a name`);
        if (op.store === "messages" && (!validId(value.chatId) || !validDate(value.createdAt))) throw new Error(`Message ${value.id} needs a chat and a creation time`);
        if (op.store === "trash" && (!validId(value.entityId) || !["chat", "message"].includes(value.entityType))) throw new Error(`Trash item ${value.id} is invalid`);
        return;
      }
      case "delete":
        if (!RECORD_STORES.includes(op.store)) throw new Error(`Unknown store: ${op.store}`);
        if (!validId(op.id)) throw new Error("A delete needs an id");
        if (op.store === "chats" && op.id === "unsorted") throw new Error("The Unsorted chat is permanent");
        return;
      case "draft":
        if (!validId(op.chatId) || typeof op.text !== "string") throw new Error("A draft needs a chat and text");
        return;
      case "tombstone":
        if (!["chat", "message"].includes(op.kind) || !validId(op.id) || typeof op.present !== "boolean") throw new Error("Invalid tombstone operation");
        return;
      case "meta":
        if (!META_KEYS.includes(op.key)) throw new Error(`Unknown setting: ${op.key}`);
        if (op.key === "globalHiddenChatIds" && (!Array.isArray(op.value) || op.value.some(id => typeof id !== "string"))) throw new Error("Hidden chat list is invalid");
        if (op.key === "backupDir" && op.value !== null && (typeof op.value !== "string" || !op.value.trim())) throw new Error("Backup folder is invalid");
        return;
      case "attachment": {
        const value = op.value;
        if (!value || !validId(value.id) || !/^[0-9a-f]{64}$/.test(value.hash || "") || !Number.isSafeInteger(value.size) || value.size < 0) throw new Error("Attachment record is invalid");
        return;
      }
      default:
        throw new Error(`Unknown operation: ${op.op}`);
    }
  }

  function validateOps(ops) {
    if (!Array.isArray(ops) || !ops.length) throw new Error("A change needs at least one operation");
    ops.forEach(validateOp);
    return ops;
  }

  // Map-based state for fast replay on the server.
  function createIndex() {
    return {
      chats: new Map(), messages: new Map(), customStickers: new Map(), trash: new Map(),
      deletedChatIds: new Set(), deletedMessageIds: new Set(), drafts: new Map(), meta: new Map(), attachments: new Map()
    };
  }

  function applyOpToIndex(index, op) {
    switch (op.op) {
      case "put": index[op.store].set(op.value.id, op.value); break;
      case "delete": index[op.store].delete(op.id); break;
      case "draft": if (op.text) index.drafts.set(op.chatId, op.text); else index.drafts.delete(op.chatId); break;
      case "tombstone": {
        const set = op.kind === "chat" ? index.deletedChatIds : index.deletedMessageIds;
        if (op.present) set.add(op.id); else set.delete(op.id);
        break;
      }
      case "meta": index.meta.set(op.key, op.value); break;
      case "attachment": index.attachments.set(op.value.id, op.value); break;
    }
  }

  function indexToState(index) {
    return {
      chats: [...index.chats.values()],
      messages: [...index.messages.values()],
      customStickers: [...index.customStickers.values()],
      trash: [...index.trash.values()],
      deletedChatIds: [...index.deletedChatIds],
      deletedMessageIds: [...index.deletedMessageIds],
      drafts: Object.fromEntries(index.drafts),
      meta: Object.fromEntries(index.meta),
      attachments: Object.fromEntries(index.attachments)
    };
  }

  // Array-based state used by the browser's `state` object.
  function applyOpsToState(state, ops) {
    ops.forEach(op => {
      switch (op.op) {
        case "put": {
          const list = state[op.store] || (state[op.store] = []);
          const value = clone(op.value);
          const position = list.findIndex(item => item.id === value.id);
          if (position >= 0) list[position] = value; else list.push(value);
          break;
        }
        case "delete":
          state[op.store] = (state[op.store] || []).filter(item => item.id !== op.id);
          break;
        case "draft":
          state.drafts = state.drafts || {};
          if (op.text) state.drafts[op.chatId] = op.text; else delete state.drafts[op.chatId];
          break;
        case "tombstone": {
          const key = op.kind === "chat" ? "deletedChatIds" : "deletedMessageIds";
          const ids = new Set(state[key] || []);
          if (op.present) ids.add(op.id); else ids.delete(op.id);
          state[key] = [...ids];
          break;
        }
        case "meta":
          state.meta = state.meta || {};
          state.meta[op.key] = clone(op.value);
          break;
        case "attachment":
          state.attachments = state.attachments || {};
          state.attachments[op.value.id] = clone(op.value);
          break;
      }
    });
    return state;
  }

  function sameJson(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Build operations from an in-memory change. Changed and new records become puts.
  // A record missing from `after` becomes a delete ONLY if its id was declared by the
  // user action that removed it; otherwise the change is refused.
  function operationsForChange(before, after, declaredDeletes = {}) {
    const ops = [];
    const undeclared = [];
    for (const store of RECORD_STORES) {
      const previous = new Map((before[store] || []).map(item => [item.id, item]));
      const next = new Map((after[store] || []).map(item => [item.id, item]));
      const allowed = declaredDeletes[store] instanceof Set ? declaredDeletes[store] : new Set(declaredDeletes[store] || []);
      next.forEach((value, id) => { if (!sameJson(value, previous.get(id))) ops.push({ op: "put", store, value: clone(value) }); });
      previous.forEach((_, id) => {
        if (next.has(id)) return;
        if (allowed.has(id)) ops.push({ op: "delete", store, id });
        else undeclared.push(`${store}:${id}`);
      });
    }
    for (const [key, kind] of [["deletedChatIds", "chat"], ["deletedMessageIds", "message"]]) {
      const previous = new Set(before[key] || []);
      const next = new Set(after[key] || []);
      next.forEach(id => { if (!previous.has(id)) ops.push({ op: "tombstone", kind, id, present: true }); });
      previous.forEach(id => { if (!next.has(id)) ops.push({ op: "tombstone", kind, id, present: false }); });
    }
    const draftIds = new Set([...Object.keys(before.drafts || {}), ...Object.keys(after.drafts || {})]);
    draftIds.forEach(chatId => {
      const previous = before.drafts?.[chatId] || "";
      const next = after.drafts?.[chatId] || "";
      if (previous !== next) ops.push({ op: "draft", chatId, text: next });
    });
    if (undeclared.length) {
      const error = new Error(`Refusing to save: ${undeclared.length} record(s) disappeared without a delete action (${undeclared.slice(0, 5).join(", ")})`);
      error.code = "UNDECLARED_DELETE";
      error.undeclared = undeclared;
      throw error;
    }
    return ops;
  }

  function attachmentRefs(value) {
    const ids = [];
    if (!value || typeof value !== "object") return ids;
    if (typeof value.imageId === "string") ids.push(value.imageId);
    if (typeof value.attachmentId === "string") ids.push(value.attachmentId);
    if (typeof value.avatarImageId === "string") ids.push(value.avatarImageId);
    return ids;
  }

  return {
    RECORD_STORES, META_KEYS, clone, validateOp, validateOps, createIndex, applyOpToIndex, indexToState,
    applyOpsToState, operationsForChange, attachmentRefs
  };
});
