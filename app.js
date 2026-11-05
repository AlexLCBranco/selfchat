const STORAGE_KEY = "selfchat-data-v1";
const EMOJIS = ["💬", "🏀", "⚽", "🤖", "💻", "🎬", "🎮", "🎵", "📚", "💡", "🧠", "🔥", "🧾", "👀", "🗑️", "🌍"];
const DEFAULT_STATE = {
  activeChatId: "nba",
  chats: [
    { id: "nba", name: "NBA", emoji: "🏀", createdAt: "2026-01-01T00:00:02.000Z" },
    { id: "ai", name: "Claude / Codex", emoji: "🤖", createdAt: "2026-01-01T00:00:01.000Z" },
    { id: "soccer", name: "Soccer", emoji: "⚽", createdAt: "2026-01-01T00:00:00.000Z" }
  ],
  messages: []
};

const $ = selector => document.querySelector(selector);
const elements = {
  chatList: $("#chatList"), activeChatAvatar: $("#activeChatAvatar"), activeChatName: $("#activeChatName"),
  emptyAvatar: $("#emptyAvatar"), emptyTitle: $("#emptyTitle"), emptyState: $("#emptyState"), messageList: $("#messageList"),
  messageStage: $("#messageStage"), composer: $("#composer"), messageInput: $("#messageInput"), sendButton: $("#sendButton"),
  chatFilterInput: $("#chatFilterInput"), messageSearchPanel: $("#messageSearchPanel"), messageSearchInput: $("#messageSearchInput"),
  searchResultCount: $("#searchResultCount"), chatDialog: $("#chatDialog"), chatForm: $("#chatForm"), chatNameInput: $("#chatNameInput"),
  emojiPicker: $("#emojiPicker"), optionsDialog: $("#chatOptionsDialog"), optionsChatName: $("#optionsChatName"),
  settingsDialog: $("#settingsDialog"), editDialog: $("#editMessageDialog"), editForm: $("#editMessageForm"),
  editMessageInput: $("#editMessageInput"), contextMenu: $("#messageContextMenu"), toast: $("#toast"), importInput: $("#importInput")
};

let state = loadState();
let selectedEmoji = EMOJIS[0];
let contextMessageId = null;
let editingMessageId = null;

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && Array.isArray(value.chats) && value.chats.length && Array.isArray(value.messages)) return value;
  } catch (_) {}
  return structuredClone(DEFAULT_STATE);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeChat() {
  return state.chats.find(chat => chat.id === state.activeChatId) || state.chats[0];
}

function messagesFor(chatId = state.activeChatId) {
  return state.messages.filter(message => message.chatId === chatId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function render() {
  renderChats();
  renderConversation();
}

function renderChats() {
  const query = elements.chatFilterInput.value.trim().toLocaleLowerCase();
  const chats = [...state.chats].sort((a, b) => {
    const aLast = messagesFor(a.id).at(-1)?.createdAt || a.createdAt;
    const bLast = messagesFor(b.id).at(-1)?.createdAt || b.createdAt;
    return new Date(bLast) - new Date(aLast);
  }).filter(chat => chat.name.toLocaleLowerCase().includes(query));

  elements.chatList.innerHTML = chats.map(chat => {
    const lastMessage = messagesFor(chat.id).at(-1);
    const time = lastMessage ? formatSidebarTime(lastMessage.createdAt) : "";
    const preview = lastMessage?.text || "No messages yet";
    return `<button class="chat-row ${chat.id === state.activeChatId ? "active" : ""}" data-chat-id="${chat.id}" type="button">
      <span class="chat-row-avatar">${escapeHtml(chat.emoji)}</span>
      <span class="chat-row-body">
        <span class="chat-row-line"><span class="chat-row-name">${escapeHtml(chat.name)}</span><span class="chat-row-time">${time}</span></span>
        <span class="chat-row-preview">${escapeHtml(preview)}</span>
      </span>
    </button>`;
  }).join("");
}

function renderConversation() {
  const chat = activeChat();
  if (!chat) return;
  elements.activeChatAvatar.textContent = chat.emoji;
  elements.activeChatName.textContent = chat.name;
  elements.emptyAvatar.textContent = chat.emoji;
  elements.emptyTitle.textContent = chat.name;
  elements.optionsChatName.textContent = chat.name;
  renderMessages();
}

function renderMessages() {
  const query = elements.messageSearchInput.value.trim().toLocaleLowerCase();
  const allMessages = messagesFor();
  const visibleMessages = query ? allMessages.filter(message => message.text.toLocaleLowerCase().includes(query)) : allMessages;
  elements.emptyState.hidden = allMessages.length > 0;
  elements.messageList.hidden = allMessages.length === 0;
  elements.searchResultCount.textContent = query ? `${visibleMessages.length} found` : "";
  let previousDate = "";

  elements.messageList.innerHTML = visibleMessages.map(message => {
    const date = formatDay(message.createdAt);
    const divider = date !== previousDate ? `<div class="day-divider">${date}</div>` : "";
    previousDate = date;
    const text = query ? highlightMatch(message.text, query) : escapeHtml(message.text);
    return `${divider}<article class="message" data-message-id="${message.id}">
      <button class="message-menu-trigger" type="button" aria-label="Message options">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      <span class="message-text">${text}</span>
      <span class="message-meta">${message.editedAt ? "edited · " : ""}${formatTime(message.createdAt)}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 13 4 4L16 7"/><path d="m9 16 2 2L22 7"/></svg>
      </span>
    </article>`;
  }).join("");

  if (!query) requestAnimationFrame(scrollToBottom);
}

function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${escapedQuery})`, "gi"), '<mark class="highlight">$1</mark>');
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDay(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined }).format(date);
}

function formatSidebarTime(value) {
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? formatTime(value)
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function scrollToBottom() {
  elements.messageStage.scrollTop = elements.messageStage.scrollHeight;
}

function sendMessage() {
  const text = elements.messageInput.value.trim();
  if (!text) return;
  state.messages.push({ id: uid(), chatId: state.activeChatId, text, createdAt: new Date().toISOString(), editedAt: null });
  elements.messageInput.value = "";
  resizeComposer();
  elements.sendButton.disabled = true;
  saveState();
  render();
  elements.messageInput.focus();
}

function selectChat(id) {
  state.activeChatId = id;
  elements.messageSearchInput.value = "";
  elements.messageSearchPanel.hidden = true;
  saveState();
  render();
  elements.messageInput.focus();
}

function resizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 160)}px`;
}

function showToast(text) {
  elements.toast.textContent = text;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function closeContextMenu() {
  elements.contextMenu.hidden = true;
  contextMessageId = null;
}

elements.composer.addEventListener("submit", event => { event.preventDefault(); sendMessage(); });
elements.messageInput.addEventListener("input", () => {
  resizeComposer();
  elements.sendButton.disabled = !elements.messageInput.value.trim();
});
elements.messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});
elements.chatList.addEventListener("click", event => {
  const row = event.target.closest("[data-chat-id]");
  if (row) selectChat(row.dataset.chatId);
});
elements.chatFilterInput.addEventListener("input", renderChats);

EMOJIS.forEach(emoji => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = emoji;
  button.className = `emoji-choice${emoji === selectedEmoji ? " selected" : ""}`;
  button.addEventListener("click", () => {
    selectedEmoji = emoji;
    [...elements.emojiPicker.children].forEach(choice => choice.classList.toggle("selected", choice === button));
  });
  elements.emojiPicker.append(button);
});

$("#newChatButton").addEventListener("click", () => {
  elements.chatNameInput.value = "";
  elements.chatDialog.showModal();
  setTimeout(() => elements.chatNameInput.focus(), 40);
});
$("#cancelChatButton").addEventListener("click", () => elements.chatDialog.close());
elements.chatForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = elements.chatNameInput.value.trim();
  if (!name) return;
  const chat = { id: uid(), name, emoji: selectedEmoji, createdAt: new Date().toISOString() };
  state.chats.push(chat);
  state.activeChatId = chat.id;
  saveState();
  elements.chatDialog.close();
  render();
  elements.messageInput.focus();
});

$("#messageSearchButton").addEventListener("click", () => {
  elements.messageSearchPanel.hidden = false;
  elements.messageSearchInput.focus();
});
$("#closeMessageSearch").addEventListener("click", () => {
  elements.messageSearchInput.value = "";
  elements.messageSearchPanel.hidden = true;
  renderMessages();
});
elements.messageSearchInput.addEventListener("input", renderMessages);

$("#chatMenuButton").addEventListener("click", () => elements.optionsDialog.showModal());
$("#closeOptionsButton").addEventListener("click", () => elements.optionsDialog.close());
$("#renameChatButton").addEventListener("click", () => {
  const chat = activeChat();
  const nextName = prompt("Rename chat", chat.name)?.trim();
  if (!nextName) return;
  chat.name = nextName.slice(0, 48);
  saveState();
  elements.optionsDialog.close();
  render();
});
$("#deleteChatButton").addEventListener("click", () => {
  if (state.chats.length === 1) return showToast("Keep at least one chat");
  const chat = activeChat();
  if (!confirm(`Delete “${chat.name}” and all its messages?`)) return;
  state.chats = state.chats.filter(item => item.id !== chat.id);
  state.messages = state.messages.filter(message => message.chatId !== chat.id);
  state.activeChatId = state.chats[0].id;
  saveState();
  elements.optionsDialog.close();
  render();
});

$("#settingsButton").addEventListener("click", () => elements.settingsDialog.showModal());
$("#closeSettingsButton").addEventListener("click", () => elements.settingsDialog.close());
$("#exportButton").addEventListener("click", () => {
  const payload = { ...state, schemaVersion: 1, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `selfchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported");
});
elements.importInput.addEventListener("change", async () => {
  const file = elements.importInput.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.chats) || !imported.chats.length || !Array.isArray(imported.messages)) throw new Error("Invalid backup");
    if (!confirm("Replace this computer’s SelfChat data with this backup?")) return;
    state = { activeChatId: imported.activeChatId || imported.chats[0].id, chats: imported.chats, messages: imported.messages };
    saveState();
    render();
    elements.settingsDialog.close();
    showToast("Backup imported");
  } catch (_) {
    showToast("That is not a valid SelfChat backup");
  } finally {
    elements.importInput.value = "";
  }
});

elements.messageList.addEventListener("click", event => {
  const trigger = event.target.closest(".message-menu-trigger");
  if (!trigger) return;
  const message = trigger.closest("[data-message-id]");
  contextMessageId = message.dataset.messageId;
  const rect = trigger.getBoundingClientRect();
  elements.contextMenu.style.left = `${Math.min(rect.right - 150, window.innerWidth - 160)}px`;
  elements.contextMenu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 130)}px`;
  elements.contextMenu.hidden = false;
  event.stopPropagation();
});
document.addEventListener("click", event => {
  if (!event.target.closest("#messageContextMenu")) closeContextMenu();
});
elements.contextMenu.addEventListener("click", async event => {
  const action = event.target.dataset.action;
  const message = state.messages.find(item => item.id === contextMessageId);
  if (!action || !message) return;
  if (action === "copy") {
    await navigator.clipboard.writeText(message.text);
    showToast("Copied");
    closeContextMenu();
  }
  if (action === "edit") {
    editingMessageId = message.id;
    elements.editMessageInput.value = message.text;
    closeContextMenu();
    elements.editDialog.showModal();
    setTimeout(() => elements.editMessageInput.focus(), 40);
  }
  if (action === "delete") {
    if (confirm("Delete this message?")) {
      state.messages = state.messages.filter(item => item.id !== message.id);
      saveState();
      render();
    }
    closeContextMenu();
  }
});
$("#cancelEditButton").addEventListener("click", () => elements.editDialog.close());
elements.editForm.addEventListener("submit", event => {
  event.preventDefault();
  const message = state.messages.find(item => item.id === editingMessageId);
  const text = elements.editMessageInput.value.trim();
  if (!message || !text) return;
  message.text = text;
  message.editedAt = new Date().toISOString();
  saveState();
  elements.editDialog.close();
  render();
});

render();
elements.messageInput.focus();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}
