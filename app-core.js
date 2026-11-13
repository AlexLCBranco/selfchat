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
        editedAt: null
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

  return { createTextSendController, moveMessagesToTrash, undoMessagesToTrash };
});
