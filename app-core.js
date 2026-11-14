(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatAppCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createTextSendController(options) {
    return async function sendText() {
      const raw = options.getInput();
      const text = raw.trim();
      if (!text) return false;

      options.setInput("");
      const message = {
        id: options.createId(),
        chatId: options.getChatId(),
        text,
        createdAt: options.now(),
        editedAt: null,
        ...(options.getExtra?.() || {})
      };
      options.addOptimistic(message);
      try {
        await options.persist(message);
        options.onSaved?.(message);
        return true;
      } catch (error) {
        options.rollback(message);
        if (!options.getInput()) options.setInput(raw);
        options.onFailure?.(error, message);
        return false;
      }
    };
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

  return { createTextSendController, moveMessages, moveMessagesToTrash, undoMessagesToTrash, messagePlainText, copySelectedText, resolveReply, createAttachmentBatch };
});
