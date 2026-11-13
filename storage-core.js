(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatStorageCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const UNSORTED_CHAT = Object.freeze({
    id: "unsorted",
    name: "Unsorted",
    emoji: "📥",
    createdAt: "2026-01-01T00:00:03.000Z",
    permanent: true
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeState(value, fallback) {
    const source = value && typeof value === "object" ? clone(value) : clone(fallback || {});
    source.chats = Array.isArray(source.chats) ? source.chats.filter(item => item && typeof item.id === "string") : [];
    if (!source.chats.some(chat => chat.id === UNSORTED_CHAT.id)) source.chats.push(clone(UNSORTED_CHAT));
    source.messages = Array.isArray(source.messages) ? source.messages.filter(item => item && typeof item.id === "string" && typeof item.chatId === "string") : [];
    source.customStickers = Array.isArray(source.customStickers) ? source.customStickers : [];
    source.trash = Array.isArray(source.trash) ? source.trash.filter(item => item && typeof item.id === "string" && item.entityId) : [];
    source.deletedChatIds = Array.isArray(source.deletedChatIds) ? [...new Set(source.deletedChatIds.filter(id => typeof id === "string" && id !== UNSORTED_CHAT.id))] : [];
    source.deletedMessageIds = Array.isArray(source.deletedMessageIds) ? [...new Set(source.deletedMessageIds.filter(id => typeof id === "string"))] : [];
    source.drafts = source.drafts && typeof source.drafts === "object" && !Array.isArray(source.drafts) ? source.drafts : {};
    if (!source.chats.some(chat => chat.id === source.activeChatId)) source.activeChatId = source.chats[0]?.id || UNSORTED_CHAT.id;
    return source;
  }

  function newerEntity(current, candidate, editField) {
    if (!current) return candidate;
    const currentTime = current[editField] || current.updatedAt || current.createdAt || "";
    const nextTime = candidate[editField] || candidate.updatedAt || candidate.createdAt || "";
    return nextTime >= currentTime ? candidate : current;
  }

  function messageVersionTime(message) {
    return [message?.movedAt, message?.editedAt, message?.updatedAt, message?.createdAt, ""]
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  }

  function newerMessage(current, candidate) {
    if (!current) return candidate;
    return messageVersionTime(candidate) > messageVersionTime(current) ? candidate : current;
  }

  function mergeStates(values, preferred, fallback) {
    const sources = values.filter(Boolean).map(value => normalizeState(value, fallback));
    if (!sources.length) return normalizeState(fallback || {}, fallback);
    const chats = new Map();
    const messages = new Map();
    const stickers = new Map();
    const trash = new Map();
    const drafts = {};
    const deletedChatIds = new Set();
    const deletedMessageIds = new Set();
    for (const source of sources) {
      source.chats.forEach(chat => chats.set(chat.id, newerEntity(chats.get(chat.id), chat, "updatedAt")));
      source.messages.forEach(message => messages.set(message.id, newerMessage(messages.get(message.id), message)));
      source.customStickers.forEach(sticker => { if (sticker?.id) stickers.set(sticker.id, sticker); });
      source.trash.forEach(item => {
        const current = trash.get(item.id);
        if (!current || (item.deletedAt || "") >= (current.deletedAt || "")) trash.set(item.id, item);
      });
      Object.assign(drafts, source.drafts);
      source.deletedChatIds.forEach(id => deletedChatIds.add(id));
      source.deletedMessageIds.forEach(id => deletedMessageIds.add(id));
    }
    deletedChatIds.delete(UNSORTED_CHAT.id);
    const mergedChats = [...chats.values()].filter(chat => !deletedChatIds.has(chat.id));
    const mergedMessages = [...messages.values()].filter(message => !deletedMessageIds.has(message.id) && !deletedChatIds.has(message.chatId));
    const selected = normalizeState(preferred || sources.at(-1), fallback);
    return normalizeState({
      activeChatId: mergedChats.some(chat => chat.id === selected.activeChatId) ? selected.activeChatId : mergedChats[0]?.id,
      chats: mergedChats,
      messages: mergedMessages,
      customStickers: [...stickers.values()],
      deletedChatIds: [...deletedChatIds],
      deletedMessageIds: [...deletedMessageIds],
      drafts,
      trash: [...trash.values()]
    }, fallback);
  }

  function migrationOperations(state) {
    const operations = [];
    state.chats.forEach(chat => operations.push({ id: `migration:chat:${chat.id}`, type: "chat.upsert", entityId: chat.id, entityType: "chat", createdAt: chat.createdAt, payload: clone(chat), source: "legacy-migration" }));
    state.messages.forEach(message => operations.push({ id: `migration:message:${message.id}`, type: "message.upsert", entityId: message.id, entityType: "message", createdAt: message.createdAt, payload: clone(message), source: "legacy-migration" }));
    state.customStickers.forEach(sticker => operations.push({ id: `migration:sticker:${sticker.id}`, type: "sticker.upsert", entityId: sticker.id, entityType: "sticker", createdAt: "2026-01-01T00:00:00.000Z", payload: clone(sticker), source: "legacy-migration" }));
    Object.entries(state.drafts).filter(([, text]) => text).forEach(([chatId, text]) => operations.push({ id: `migration:draft:${chatId}`, type: "draft.set", entityId: chatId, entityType: "draft", createdAt: "2026-01-01T00:00:00.000Z", payload: { chatId, text }, source: "legacy-migration" }));
    state.deletedChatIds.forEach(id => operations.push({ id: `migration:chat-delete:${id}`, type: "chat.delete", entityId: id, entityType: "chat", createdAt: "2026-01-01T00:00:00.000Z", payload: { id }, source: "legacy-migration" }));
    state.deletedMessageIds.forEach(id => operations.push({ id: `migration:message-delete:${id}`, type: "message.delete", entityId: id, entityType: "message", createdAt: "2026-01-01T00:00:00.000Z", payload: { id }, source: "legacy-migration" }));
    return operations;
  }

  function replayOperations(operations, fallback) {
    const state = normalizeState({}, fallback);
    const seen = new Set();
    const chats = new Map(state.chats.map(chat => [chat.id, chat]));
    const messages = new Map();
    const stickers = new Map();
    const trash = new Map();
    const drafts = {};
    for (const operation of operations) {
      if (!operation?.id || seen.has(operation.id)) continue;
      seen.add(operation.id);
      const payload = clone(operation.payload || {});
      if (operation.type === "chat.upsert") chats.set(operation.entityId, payload);
      if (["message.upsert", "message.edit", "message.move"].includes(operation.type)) messages.set(operation.entityId, payload);
      if (operation.type === "sticker.upsert") stickers.set(operation.entityId, payload);
      if (operation.type === "draft.set") { if (payload.text) drafts[payload.chatId] = payload.text; else delete drafts[payload.chatId]; }
      if (operation.type === "message.delete") {
        const message = payload.message || messages.get(operation.entityId);
        messages.delete(operation.entityId);
        if (message) trash.set(`message:${operation.entityId}`, { id: `message:${operation.entityId}`, entityType: "message", entityId: operation.entityId, deletedAt: operation.createdAt, payload: { message, originalChatId: payload.originalChatId || message.chatId } });
      }
      if (operation.type === "chat.delete" && operation.entityId !== UNSORTED_CHAT.id) {
        const chat = payload.chat || chats.get(operation.entityId);
        const deletedMessages = payload.messages || [...messages.values()].filter(message => message.chatId === operation.entityId);
        chats.delete(operation.entityId);
        deletedMessages.forEach(message => messages.delete(message.id));
        if (chat) trash.set(`chat:${operation.entityId}`, { id: `chat:${operation.entityId}`, entityType: "chat", entityId: operation.entityId, deletedAt: operation.createdAt, payload: { chat, messages: deletedMessages, draft: payload.draft || "" } });
      }
      if (operation.type === "message.restore") {
        const message = payload.message;
        if (message) messages.set(operation.entityId, { ...message, chatId: payload.targetChatId || message.chatId });
        trash.delete(`message:${operation.entityId}`);
      }
      if (operation.type === "chat.restore") {
        if (payload.chat) chats.set(operation.entityId, payload.chat);
        (payload.messages || []).forEach(message => messages.set(message.id, message));
        if (payload.draft) drafts[operation.entityId] = payload.draft;
        trash.delete(`chat:${operation.entityId}`);
      }
      if (operation.type === "message.purge") trash.delete(`message:${operation.entityId}`);
      if (operation.type === "chat.purge") trash.delete(`chat:${operation.entityId}`);
      if (operation.type === "trash.empty") trash.clear();
    }
    return normalizeState({
      activeChatId: [...chats.keys()][0], chats: [...chats.values()], messages: [...messages.values()],
      customStickers: [...stickers.values()], drafts,
      trash: [...trash.values()],
      deletedChatIds: [...trash.values()].filter(item => item.entityType === "chat").map(item => item.entityId),
      deletedMessageIds: [...trash.values()].filter(item => item.entityType === "message").map(item => item.entityId)
    }, fallback);
  }

  function validateState(state, attachmentIds, { allowMissingAttachments = false } = {}) {
    const errors = [];
    const missingAttachments = [];
    const chatIds = new Set();
    const messageIds = new Set();
    const stickerIds = new Set();
    for (const chat of state.chats) {
      if (!chat.id || chatIds.has(chat.id)) errors.push(`Duplicate or missing chat ID: ${chat.id || "(missing)"}`);
      chatIds.add(chat.id);
    }
    for (const message of state.messages) {
      if (!message.id || messageIds.has(message.id)) errors.push(`Duplicate or missing message ID: ${message.id || "(missing)"}`);
      messageIds.add(message.id);
      if (!chatIds.has(message.chatId)) errors.push(`Message ${message.id} references missing chat ${message.chatId}`);
      if (message.type === "image" && (!message.imageId || (attachmentIds && !attachmentIds.has(message.imageId)))) {
        missingAttachments.push({ entityType: "message", entityId: message.id, imageId: message.imageId || null });
        if (!allowMissingAttachments) errors.push(`Message ${message.id} has an unavailable image`);
      }
    }
    for (const sticker of state.customStickers) {
      if (!sticker.id || stickerIds.has(sticker.id)) errors.push(`Duplicate or missing sticker ID: ${sticker.id || "(missing)"}`);
      stickerIds.add(sticker.id);
      if (sticker.imageId && attachmentIds && !attachmentIds.has(sticker.imageId)) {
        missingAttachments.push({ entityType: "sticker", entityId: sticker.id, imageId: sticker.imageId });
        if (!allowMissingAttachments) errors.push(`Sticker ${sticker.id} has an unavailable image`);
      }
    }
    if (!chatIds.has(UNSORTED_CHAT.id)) errors.push("Permanent Unsorted chat is missing");
    return { ok: errors.length === 0, errors, missingAttachments, counts: { chats: state.chats.length, messages: state.messages.length, stickers: state.customStickers.length } };
  }

  function referencedAttachmentIds(state, recoveryStates = []) {
    const ids = new Set();
    const collect = value => {
      (value.messages || []).forEach(message => { if (message.imageId) ids.add(message.imageId); });
      (value.customStickers || []).forEach(sticker => { if (sticker.imageId) ids.add(sticker.imageId); });
      (value.trash || []).forEach(item => {
        const payload = item.payload || {};
        if (payload.message?.imageId) ids.add(payload.message.imageId);
        (payload.messages || []).forEach(message => { if (message.imageId) ids.add(message.imageId); });
      });
    };
    collect(state || {});
    recoveryStates.forEach(collect);
    return ids;
  }

  function redactState(value, targets, fallback) {
    const state = normalizeState(value, fallback);
    const entityIds = targets?.entityIds || new Set();
    const chatIds = targets?.chatIds || new Set();
    const messageIds = targets?.messageIds || new Set();
    state.chats = state.chats.filter(chat => !chatIds.has(chat.id));
    state.messages = state.messages.filter(message => !messageIds.has(message.id) && !chatIds.has(message.chatId));
    state.trash = state.trash.filter(item => !entityIds.has(item.entityId));
    state.deletedChatIds = state.deletedChatIds.filter(id => !chatIds.has(id));
    state.deletedMessageIds = state.deletedMessageIds.filter(id => !messageIds.has(id));
    chatIds.forEach(id => delete state.drafts[id]);
    return normalizeState(state, fallback);
  }

  function recoverableAttachmentRecords(requiredIds, currentRecords, backupRecords) {
    const required = new Set(requiredIds || []);
    const usable = new Set((currentRecords || []).filter(record => record?.id && record.blob?.size > 0).map(record => record.id));
    const selected = new Map();
    (backupRecords || []).forEach(record => {
      if (record?.id && required.has(record.id) && !usable.has(record.id) && record.blob?.size > 0) selected.set(record.id, record);
    });
    return [...selected.values()];
  }

  function stateCounts(value) {
    const state = value || {};
    return {
      chats: Array.isArray(state.chats) ? state.chats.length : 0,
      messages: Array.isArray(state.messages) ? state.messages.length : 0,
      images: Array.isArray(state.attachments || state.images) ? (state.attachments || state.images).length : 0,
      trash: Array.isArray(state.trash) ? state.trash.length : 0
    };
  }

  function backupPayload(value, attachments, exportedAt = new Date().toISOString()) {
    const state = normalizeState(value, value);
    return {
      schemaVersion: 3,
      exportedAt,
      activeChatId: state.activeChatId,
      chats: clone(state.chats),
      messages: clone(state.messages),
      customStickers: clone(state.customStickers),
      trash: clone(state.trash),
      deletedChatIds: clone(state.deletedChatIds),
      deletedMessageIds: clone(state.deletedMessageIds),
      drafts: clone(state.drafts),
      attachments: clone(attachments || [])
    };
  }

  function parseBackup(value, fallback) {
    if (!value || ![undefined, 1, 2, 3].includes(value.schemaVersion) || !Array.isArray(value.chats) || !value.chats.length || !Array.isArray(value.messages)) {
      throw new Error("Invalid SelfChat backup");
    }
    const attachments = Array.isArray(value.attachments) ? value.attachments : Array.isArray(value.images) ? value.images : [];
    return {
      state: normalizeState({
        activeChatId: value.activeChatId || value.chats[0].id,
        chats: value.chats,
        messages: value.messages,
        customStickers: value.customStickers,
        trash: value.trash,
        deletedChatIds: value.deletedChatIds,
        deletedMessageIds: value.deletedMessageIds,
        drafts: value.drafts
      }, fallback),
      attachments: clone(attachments),
      schemaVersion: value.schemaVersion || 1
    };
  }

  function newestSnapshotPerDay(snapshots, maxDays = 30) {
    const byDay = new Map();
    [...(snapshots || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).forEach(snapshot => {
      const day = (snapshot.createdAt || "").slice(0, 10);
      if (day && !byDay.has(day)) byDay.set(day, clone(snapshot));
    });
    return [...byDay.values()].slice(0, maxDays);
  }

  return {
    UNSORTED_CHAT, normalizeState, mergeStates, migrationOperations, replayOperations, validateState,
    referencedAttachmentIds, redactState, recoverableAttachmentRecords, messageVersionTime,
    stateCounts, backupPayload, parseBackup, newestSnapshotPerDay
  };
});
