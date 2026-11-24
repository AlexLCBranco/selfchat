(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatAppCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // The text stays in the composer until the server has saved the message to disk.
  // Only then is the sent text removed from the composer and the message shown.
  function createTextSendController(options) {
    let sending = false;
    return async function sendText() {
      if (sending) return false;
      const raw = options.getInput();
      const text = raw.trim();
      if (!text) return false;

      sending = true;
      const message = {
        id: options.createId(),
        chatId: options.getChatId(),
        text,
        createdAt: options.now(),
        editedAt: null,
        ...(options.getExtra?.() || {})
      };
      try {
        await options.persist(message, "");
      } catch (error) {
        options.onFailure?.(error, message);
        return false;
      } finally {
        sending = false;
      }
      const current = options.getInput();
      options.setInput(current === raw ? "" : current.startsWith(raw) ? current.slice(raw.length).replace(/^\n+/, "") : current);
      options.onSaved?.(message);
      return true;
    };
  }

  function sortChatsByPinAndActivity(chats, messages) {
    const activity = new Map((chats || []).map(chat => [chat.id, chat.createdAt || ""]));
    (messages || []).forEach(message => {
      const current = activity.get(message.chatId) || "";
      if ((message.createdAt || "") > current) activity.set(message.chatId, message.createdAt || "");
    });
    return [...(chats || [])].sort((a, b) => {
      const pinDifference = Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt));
      if (pinDifference) return pinDifference;
      const aOrder = Number.isFinite(a.orderIndex) ? a.orderIndex : null;
      const bOrder = Number.isFinite(b.orderIndex) ? b.orderIndex : null;
      if (aOrder !== null || bOrder !== null) {
        if (aOrder === null && bOrder !== null) return -1;
        if (aOrder !== null && bOrder === null) return 1;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      return String(activity.get(b.id) || "").localeCompare(String(activity.get(a.id) || ""))
        || String(a.id || "").localeCompare(String(b.id || ""));
    });
  }

  function groupGlobalMessages(chats, messages, hiddenChatIds = []) {
    const activeChatIds = new Set((chats || []).map(chat => chat?.id).filter(Boolean));
    const hidden = hiddenChatIds instanceof Set ? hiddenChatIds : new Set(hiddenChatIds || []);
    const ordered = (messages || [])
      .filter(message => message?.id && activeChatIds.has(message.chatId) && !hidden.has(message.chatId))
      .slice()
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
        || String(a.id).localeCompare(String(b.id)));
    return ordered.reduce((groups, message) => {
      const current = groups.at(-1);
      if (current?.chatId === message.chatId) current.messages.push(message);
      else groups.push({ chatId: message.chatId, messages: [message] });
      return groups;
    }, []);
  }

  function assignChatOrder(group, updatedAt) {
    const changed = [];
    group.forEach((chat, index) => {
      if (chat.orderIndex === index) return;
      chat.orderIndex = index;
      chat.updatedAt = updatedAt;
      changed.push(chat);
    });
    return changed;
  }

  function reorderChat(chats, messages, chatId, targetId, placement, updatedAt) {
    if (!chatId || !targetId || chatId === targetId) return [];
    const ordered = sortChatsByPinAndActivity(chats, messages);
    const moving = ordered.find(chat => chat.id === chatId);
    const target = ordered.find(chat => chat.id === targetId);
    if (!moving || !target || Boolean(moving.pinnedAt) !== Boolean(target.pinnedAt)) return [];
    const group = ordered.filter(chat => Boolean(chat.pinnedAt) === Boolean(moving.pinnedAt));
    group.splice(group.findIndex(chat => chat.id === moving.id), 1);
    const targetIndex = group.findIndex(chat => chat.id === target.id);
    group.splice(targetIndex + (placement === "after" ? 1 : 0), 0, moving);
    return assignChatOrder(group, updatedAt);
  }

  function moveChatByOffset(chats, messages, chatId, offset, updatedAt) {
    const ordered = sortChatsByPinAndActivity(chats, messages);
    const moving = ordered.find(chat => chat.id === chatId);
    if (!moving || !offset) return [];
    const group = ordered.filter(chat => Boolean(chat.pinnedAt) === Boolean(moving.pinnedAt));
    const from = group.findIndex(chat => chat.id === chatId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= group.length) return [];
    [group[from], group[to]] = [group[to], group[from]];
    return assignChatOrder(group, updatedAt);
  }

  function setChatPinned(chat, pinned, updatedAt) {
    if (!chat) return null;
    if (pinned) chat.pinnedAt = updatedAt;
    else delete chat.pinnedAt;
    delete chat.orderIndex;
    chat.updatedAt = updatedAt;
    return chat;
  }

  function setMessageFlag(message, field, enabled, updatedAt) {
    if (!message || !["starredAt", "pinnedAt"].includes(field)) return null;
    if (enabled) message[field] = updatedAt;
    else delete message[field];
    message.updatedAt = updatedAt;
    return message;
  }

  function messageMatchesFilters(message, filters = {}, labelForMessage = messagePlainText) {
    const query = String(filters.query || "").trim().toLocaleLowerCase();
    const label = String(labelForMessage(message) || "");
    const type = filters.type || "all";
    const hasLink = /https?:\/\/[^\s<>]+/i.test(label);
    const typeMatches = type === "all"
      || (type === "text" && !["image", "file", "sticker"].includes(message?.type))
      || type === message?.type
      || (type === "link" && hasLink);
    const date = new Date(message?.createdAt || "");
    const day = Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const afterStart = !filters.dateFrom || day >= filters.dateFrom;
    const beforeEnd = !filters.dateTo || day <= filters.dateTo;
    const tagMatches = !filters.tag || (message?.tags || []).some(tag => String(tag).toLocaleLowerCase() === String(filters.tag).toLocaleLowerCase());
    return typeMatches && tagMatches && afterStart && beforeEnd && (!query || label.toLocaleLowerCase().includes(query));
  }

  function normalizeMessageTags(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : String(value || "").split(","))
      .map(tag => String(tag).trim().replace(/^#/, "").slice(0, 24))
      .filter(tag => {
        const key = tag.toLocaleLowerCase();
        if (!tag || seen.has(key) || seen.size >= 10) return false;
        seen.add(key);
        return true;
      });
  }

  function setChatNote(chat, value, updatedAt) {
    if (!chat || !updatedAt) return null;
    const note = String(value || "").replace(/\r\n?/g, "\n").slice(0, 10000);
    if (note.trim()) chat.note = note;
    else delete chat.note;
    chat.noteUpdatedAt = updatedAt;
    chat.updatedAt = updatedAt;
    return chat;
  }

  function resolveSplitChatId(chats, activeChatId, requestedChatId) {
    const candidates = (Array.isArray(chats) ? chats : []).filter(chat => chat?.id && chat.id !== activeChatId);
    return candidates.some(chat => chat.id === requestedChatId) ? requestedChatId : candidates[0]?.id || null;
  }

  function duplicateMessage(message, id, createdAt) {
    if (!message || !id || !createdAt) return null;
    const copy = JSON.parse(JSON.stringify(message));
    Object.assign(copy, { id, createdAt, editedAt: null });
    ["updatedAt", "movedAt", "editHistory", "starredAt", "pinnedAt", "replyToId", "replyPreview"].forEach(field => delete copy[field]);
    return copy;
  }

  function parseFencedCode(value) {
    const text = String(value || "");
    const parts = [];
    const pattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parts.push({ type: "text", text: text.slice(cursor, match.index) });
      parts.push({ type: "code", language: match[1].trim().slice(0, 40), code: match[2].replace(/\n$/, "") });
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) });
    return parts.length ? parts : [{ type: "text", text }];
  }

  function moveMessagesToTrash(state, messageIds, deletedAt) {
    const ids = new Set(messageIds);
    const messages = state.messages.filter(message => ids.has(message.id));
    if (!messages.length) return null;
    const previousTrash = state.trash.filter(item => ids.has(item.entityId));
    const previousDeletedIds = state.deletedMessageIds.filter(id => ids.has(id));

    state.trash = state.trash.filter(item => !ids.has(item.entityId));
    messages.forEach(message => state.trash.push({
      id: `message:${message.id}`,
      entityType: "message",
      entityId: message.id,
      deletedAt,
      payload: { message: structuredClone(message), originalChatId: message.chatId }
    }));
    state.messages = state.messages.filter(message => !ids.has(message.id));
    state.deletedMessageIds = [...new Set([...state.deletedMessageIds, ...messages.map(message => message.id)])];
    return { messages: structuredClone(messages), previousTrash: structuredClone(previousTrash), previousDeletedIds };
  }

  function moveMessages(state, messageIds, targetChatId, movedAt) {
    const ids = new Set(messageIds || []);
    if (!ids.size || !state.chats?.some(chat => chat.id === targetChatId)) return [];
    const moving = (state.messages || []).filter(message => ids.has(message.id) && message.chatId !== targetChatId);
    moving.forEach(message => {
      message.chatId = targetChatId;
      message.movedAt = movedAt;
    });
    return moving;
  }

  function undoMessagesToTrash(state, token) {
    if (!token?.messages?.length) return [];
    const ids = new Set(token.messages.map(message => message.id));
    state.trash = state.trash.filter(item => !ids.has(item.entityId));
    state.trash.push(...structuredClone(token.previousTrash || []));
    const existingIds = new Set(state.messages.map(message => message.id));
    const restored = token.messages.filter(message => !existingIds.has(message.id));
    state.messages.push(...structuredClone(restored));
    state.deletedMessageIds = state.deletedMessageIds.filter(id => !ids.has(id));
    state.deletedMessageIds.push(...(token.previousDeletedIds || []).filter(id => !state.deletedMessageIds.includes(id)));
    return restored;
  }

  function messagePlainText(message, stickerLabel = "Sticker") {
    if (!message) return "";
    if (message.type === "image") return message.caption || message.imageName || "Image";
    if (message.type === "file") return message.caption || message.fileName || "File";
    if (message.type === "sticker") return stickerLabel;
    return message.text || "";
  }

  function copySelectedText(messages, selectedIds, labelForMessage = messagePlainText) {
    const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    return [...(messages || [])]
      .filter(message => ids.has(message.id))
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a.id).localeCompare(String(b.id)))
      .map(message => labelForMessage(message))
      .filter(Boolean)
      .join("\n\n");
  }

  function resolveReply(state, message, labelForMessage = messagePlainText) {
    if (!message?.replyToId) return null;
    const live = state.messages?.find(item => item.id === message.replyToId);
    if (live) return {
      id: live.id,
      chatId: live.chatId,
      text: labelForMessage(live),
      status: live.chatId === message.chatId ? "available" : "moved"
    };
    const trashed = state.trash?.find(item => item.entityType === "message" && item.entityId === message.replyToId)?.payload?.message;
    if (trashed) return { id: trashed.id, chatId: trashed.chatId, text: labelForMessage(trashed), status: "trashed" };
    return {
      id: message.replyToId,
      chatId: null,
      text: message.replyPreview || "Original message",
      status: "deleted"
    };
  }

  function createAttachmentBatch(files, options) {
    const createdAt = Number(options.now());
    const attachments = [];
    const messages = [];
    [...(files || [])].filter(Boolean).forEach((file, index) => {
      const attachmentId = options.createId();
      const messageId = options.createId();
      const isImage = String(file.type || "").startsWith("image/");
      const name = file.name || `Pasted file ${index + 1}`;
      attachments.push({ id: attachmentId, blob: file, name });
      const common = {
        id: messageId,
        chatId: options.chatId,
        caption: index === 0 ? options.caption || "" : "",
        createdAt: new Date(createdAt + index).toISOString(),
        editedAt: null,
        ...(index === 0 ? options.reply || {} : {})
      };
      messages.push(isImage
        ? { ...common, type: "image", imageId: attachmentId, imageName: name, imageType: file.type }
        : { ...common, type: "file", attachmentId, fileName: name, fileType: file.type || "application/octet-stream", fileSize: Number(file.size) || 0 });
    });
    return { attachments, messages };
  }

  return { createTextSendController, sortChatsByPinAndActivity, groupGlobalMessages, reorderChat, moveChatByOffset, setChatPinned, setMessageFlag, messageMatchesFilters, normalizeMessageTags, setChatNote, resolveSplitChatId, duplicateMessage, parseFencedCode, moveMessages, moveMessagesToTrash, undoMessagesToTrash, messagePlainText, copySelectedText, resolveReply, createAttachmentBatch };
});
