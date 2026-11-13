const STORAGE_KEY = "selfchat-data-v1";
const RECOVERY_KEY = "selfchat-recovery-v1";
const ACTIVE_TAB_KEY = "selfchat-active-tab-v1";
const DRAFT_BUFFER_KEY = "selfchat-draft-buffer-v1";
const TAB_CHANNEL_NAME = "selfchat-tab-ownership-v1";
const IMAGE_DB_NAME = "selfchat-images-v1";
const IMAGE_STORE = "images";
const RECOVERY_DB_NAME = "selfchat-snapshots-v1";
const RECOVERY_STORE = "snapshots";
const MAX_RECOVERY_SNAPSHOTS = 25;
const EMOJIS = ["💬", "🏀", "⚽", "🤖", "💻", "🎬", "🎮", "🎵", "📚", "💡", "🧠", "🔥", "🧾", "👀", "🗑️", "🌍"];
const STICKERS = [
  { id: "thumbs-up", emoji: "👍", label: "Thumbs up", tone: "mint" },
  { id: "laughing", emoji: "😂", label: "Laughing", tone: "yellow" },
  { id: "mind-blown", emoji: "🤯", label: "Mind blown", tone: "purple" },
  { id: "fire", emoji: "🔥", label: "Fire", tone: "orange" },
  { id: "heart", emoji: "❤️", label: "Love it", tone: "pink" },
  { id: "thinking", emoji: "🤔", label: "Thinking", tone: "blue" },
  { id: "eyes", emoji: "👀", label: "Watching", tone: "lime" },
  { id: "crying", emoji: "😭", label: "Crying", tone: "cyan" },
  { id: "celebrate", emoji: "🥳", label: "Celebrate", tone: "purple" },
  { id: "nope", emoji: "🙅", label: "Nope", tone: "pink" },
  { id: "salute", emoji: "🫡", label: "Salute", tone: "blue" },
  { id: "dead", emoji: "💀", label: "I'm dead", tone: "gray" }
];
const DEFAULT_STATE = {
  activeChatId: "nba",
  chats: [
    { id: "nba", name: "NBA", emoji: "🏀", createdAt: "2026-01-01T00:00:02.000Z" },
    { id: "ai", name: "Claude / Codex", emoji: "🤖", createdAt: "2026-01-01T00:00:01.000Z" },
    { id: "soccer", name: "Soccer", emoji: "⚽", createdAt: "2026-01-01T00:00:00.000Z" }
  ],
  messages: [],
  customStickers: [],
  trash: [],
  deletedChatIds: [],
  deletedMessageIds: [],
  drafts: {}
};

const $ = selector => document.querySelector(selector);
const elements = {
  app: $("#app"), singleTabScreen: $("#singleTabScreen"), singleTabHint: $("#singleTabHint"),
  closeThisTabButton: $("#closeThisTabButton"), useThisTabButton: $("#useThisTabButton"),
  chatList: $("#chatList"), activeChatAvatar: $("#activeChatAvatar"), activeChatName: $("#activeChatName"),
  emptyAvatar: $("#emptyAvatar"), emptyTitle: $("#emptyTitle"), emptyState: $("#emptyState"), messageList: $("#messageList"),
  messageStage: $("#messageStage"), composer: $("#composer"), messageInput: $("#messageInput"), sendButton: $("#sendButton"),
  imageButton: $("#imageButton"), imageInput: $("#imageInput"), dropOverlay: $("#dropOverlay"),
  imagePreviewTray: $("#imagePreviewTray"), imagePreviewList: $("#imagePreviewList"), imagePreviewTitle: $("#imagePreviewTitle"),
  stickerButton: $("#stickerButton"), stickerPanel: $("#stickerPanel"), stickerGrid: $("#stickerGrid"),
  stickerDialog: $("#stickerDialog"), stickerForm: $("#stickerForm"), stickerImageInput: $("#stickerImageInput"),
  stickerImageDropzone: $("#stickerImageDropzone"), stickerImagePreview: $("#stickerImagePreview"),
  stickerImagePlaceholder: $("#stickerImagePlaceholder"), stickerImageChange: $("#stickerImageChange"),
  stickerNameInput: $("#stickerNameInput"), saveStickerButton: $("#saveStickerButton"),
  chatFilterInput: $("#chatFilterInput"), messageSearchPanel: $("#messageSearchPanel"), messageSearchInput: $("#messageSearchInput"),
  searchResultCount: $("#searchResultCount"), previousSearchResult: $("#previousSearchResult"), nextSearchResult: $("#nextSearchResult"),
  selectionBar: $("#selectionBar"), selectionCount: $("#selectionCount"),
  chatDialog: $("#chatDialog"), chatForm: $("#chatForm"), chatNameInput: $("#chatNameInput"),
  emojiPicker: $("#emojiPicker"), optionsDialog: $("#chatOptionsDialog"), optionsChatName: $("#optionsChatName"),
  settingsDialog: $("#settingsDialog"), editDialog: $("#editMessageDialog"), editForm: $("#editMessageForm"),
  editMessageInput: $("#editMessageInput"), contextMenu: $("#messageContextMenu"), toast: $("#toast"), importInput: $("#importInput"),
  recoveryList: $("#recoveryList"), recoveryStatus: $("#recoveryStatus"),
  storageDiagnostics: $("#storageDiagnostics"), recoveryPreviewDialog: $("#recoveryPreviewDialog"), recoveryPreviewSummary: $("#recoveryPreviewSummary"),
  trashDialog: $("#trashDialog"), trashList: $("#trashList"), trashCount: $("#trashCount"), emptyTrashButton: $("#emptyTrashButton"),
  moveDialog: $("#moveMessagesDialog"), moveForm: $("#moveMessagesForm"), moveTitle: $("#moveMessagesTitle"), moveDestination: $("#moveDestinationSelect"),
  imageViewerDialog: $("#imageViewerDialog"), imageViewerImage: $("#imageViewerImage"), imageViewerTitle: $("#imageViewerTitle"),
  imageViewerTime: $("#imageViewerTime"), imageViewerCaption: $("#imageViewerCaption")
};

let state = loadLegacyState();
let persistedState = structuredClone(state);
let repository = null;
let storageMode = "legacy";
let draftSaveTimer = null;
let selectedEmoji = EMOJIS[0];
let contextMessageId = null;
let editingMessageId = null;
let selectedMessageIds = new Set();
let imageRenderToken = 0;
let imageObjectUrls = [];
let stickerGridObjectUrls = [];
let pendingImages = [];
let pendingStickerImage = null;
let pendingStickerUrl = null;
let viewerMessageId = null;
let viewerObjectUrl = null;
let viewerLoadToken = 0;
const tabId = uid();
const tabChannel = "BroadcastChannel" in window ? new BroadcastChannel(TAB_CHANNEL_NAME) : null;
let tabIsBlocked = false;
let recoverySnapshotTimer = null;
let lastRecoverySignature = null;
let messageSearchIndex = 0;
let focusedMessageId = null;
let recoveryPreviewSnapshot = null;

function activeTabId() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_TAB_KEY))?.tabId || null;
  } catch (_) {
    return null;
  }
}

function closeOpenUi() {
  document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
  elements.dropOverlay.hidden = true;
  closeStickerPanel();
  closeContextMenu();
}

function blockThisTab() {
  if (tabIsBlocked) return;
  tabIsBlocked = true;
  closeOpenUi();
  elements.app.inert = true;
  elements.singleTabHint.textContent = "";
  elements.closeThisTabButton.textContent = "Close tab";
  elements.singleTabScreen.hidden = false;
  requestAnimationFrame(() => elements.useThisTabButton.focus());
}

async function claimThisTab() {
  localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify({ tabId, claimedAt: Date.now() }));
  tabChannel?.postMessage({ type: "claim", tabId });
  tabIsBlocked = false;
  elements.singleTabScreen.hidden = true;
  elements.app.inert = false;
  await initializeStorage();
  renderStickerGrid();
  render();
  elements.messageInput.value = state.drafts[state.activeChatId] || "";
  resizeComposer();
  updateComposerState();
  elements.messageInput.focus();
}

function honorCurrentTabOwner(candidateId) {
  queueMicrotask(() => {
    const ownerId = activeTabId();
    if (ownerId && ownerId !== tabId && (!candidateId || candidateId === ownerId)) blockThisTab();
  });
}

function readStoredState(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && Array.isArray(value.chats) && Array.isArray(value.messages) ? value : null;
  } catch (_) {}
  return null;
}

function readDraftBuffers() {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_BUFFER_KEY));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (_) { return {}; }
}

function setDraftBuffer(chatId, text) {
  const buffers = readDraftBuffers();
  buffers[chatId] = { text, updatedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_BUFFER_KEY, JSON.stringify(buffers));
}

function clearDraftBuffer(chatId, expectedText) {
  const buffers = readDraftBuffers();
  if (!buffers[chatId] || buffers[chatId].text !== expectedText) return;
  delete buffers[chatId];
  if (Object.keys(buffers).length) localStorage.setItem(DRAFT_BUFFER_KEY, JSON.stringify(buffers));
  else localStorage.removeItem(DRAFT_BUFFER_KEY);
}

function normalizeState(value) {
  const normalized = SelfChatStorageCore.normalizeState(value, DEFAULT_STATE);
  normalized.chats = Array.isArray(normalized.chats) ? normalized.chats : [];
  normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
  normalized.customStickers = normalizeCustomStickers(normalized.customStickers);
  normalized.trash = Array.isArray(normalized.trash) ? normalized.trash : [];
  normalized.deletedChatIds = Array.isArray(normalized.deletedChatIds) ? normalized.deletedChatIds.filter(id => typeof id === "string") : [];
  normalized.deletedMessageIds = Array.isArray(normalized.deletedMessageIds) ? normalized.deletedMessageIds.filter(id => typeof id === "string") : [];
  normalized.drafts = normalized.drafts && typeof normalized.drafts === "object" ? normalized.drafts : {};
  return normalized;
}

function mergeStates(values, preferred = values.at(-1)) {
  return SelfChatStorageCore.mergeStates(values, preferred, DEFAULT_STATE);
}

function loadLegacyState() {
  const stored = readStoredState(STORAGE_KEY);
  const recovery = readStoredState(RECOVERY_KEY);
  const merged = mergeStates([recovery, stored], stored || recovery);
  return merged.chats.length ? merged : structuredClone(DEFAULT_STATE);
}

function recoverySignature(value) {
  return JSON.stringify({
    chats: value.chats,
    messages: value.messages,
    customStickers: value.customStickers,
    trash: value.trash,
    deletedChatIds: value.deletedChatIds,
    deletedMessageIds: value.deletedMessageIds
  });
}

function operation(type, entityId, entityType, payload, source = "local") {
  return { id: uid(), type, entityId, entityType, payload: structuredClone(payload), source, createdAt: new Date().toISOString() };
}

function stateOperations(before, after, source = "local") {
  const operations = [];
  const beforeChats = new Map(before.chats.map(item => [item.id, item]));
  const afterChats = new Map(after.chats.map(item => [item.id, item]));
  const beforeMessages = new Map(before.messages.map(item => [item.id, item]));
  const afterMessages = new Map(after.messages.map(item => [item.id, item]));
  const beforeStickers = new Map(before.customStickers.map(item => [item.id, item]));
  const beforeTrash = new Map((before.trash || []).map(item => [item.id, item]));
  const deletedChatIds = new Set(before.chats.filter(chat => !afterChats.has(chat.id)).map(chat => chat.id));
  for (const chat of after.chats) if (JSON.stringify(chat) !== JSON.stringify(beforeChats.get(chat.id))) operations.push(operation("chat.upsert", chat.id, "chat", chat, source));
  for (const chat of before.chats) if (!afterChats.has(chat.id) && chat.id !== "unsorted") operations.push(operation("chat.delete", chat.id, "chat", {
    chat, messages: before.messages.filter(message => message.chatId === chat.id), draft: before.drafts?.[chat.id] || ""
  }, source));
  for (const message of after.messages) {
    const previous = beforeMessages.get(message.id);
    if (JSON.stringify(message) === JSON.stringify(previous)) continue;
    const type = previous?.chatId !== message.chatId && previous ? "message.move" : previous ? "message.edit" : "message.upsert";
    operations.push(operation(type, message.id, "message", message, source));
  }
  for (const message of before.messages) if (!afterMessages.has(message.id) && !deletedChatIds.has(message.chatId)) operations.push(operation("message.delete", message.id, "message", { message, originalChatId: message.chatId }, source));
  for (const sticker of after.customStickers) if (JSON.stringify(sticker) !== JSON.stringify(beforeStickers.get(sticker.id))) operations.push(operation("sticker.upsert", sticker.id, "sticker", sticker, source));
  for (const item of after.trash || []) if (!beforeTrash.has(item.id)) operations.push(operation("trash.import", item.entityId, item.entityType, { item }, source));
  const draftIds = new Set([...Object.keys(before.drafts || {}), ...Object.keys(after.drafts || {})]);
  draftIds.forEach(chatId => {
    if ((before.drafts?.[chatId] || "") !== (after.drafts?.[chatId] || "")) operations.push(operation("draft.set", chatId, "draft", { chatId, text: after.drafts?.[chatId] || "" }, source));
  });
  return operations;
}

async function saveState({ snapshot = true, source = "local" } = {}) {
  state = normalizeState(state);
  if (repository) {
    const operations = stateOperations(persistedState, state, source);
    try {
      if (operations.length) state = await repository.commit(operations, state.activeChatId);
      else if (state.activeChatId !== persistedState.activeChatId) await repository.setActiveChat(state.activeChatId);
    } catch (error) {
      state = structuredClone(persistedState);
      throw error;
    }
    persistedState = structuredClone(state);
  } else {
    const serialized = JSON.stringify(state);
    try { localStorage.setItem(RECOVERY_KEY, serialized); } catch (_) {}
    localStorage.setItem(STORAGE_KEY, serialized);
  }
  if (snapshot) queueRecoverySnapshot();
}

async function commitExplicit(operations, { snapshot = true } = {}) {
  if (!repository) throw new Error("Transactional storage is unavailable");
  state = await repository.commit(operations, state.activeChatId);
  persistedState = structuredClone(state);
  if (snapshot) queueRecoverySnapshot();
  return state;
}

async function initializeStorage() {
  try {
    if (!repository) repository = await SelfChatStorage.open({
      storageKey: STORAGE_KEY,
      recoveryKey: RECOVERY_KEY,
      defaultState: DEFAULT_STATE,
      loadLegacyState,
      getAllImages,
      getRecoverySnapshots
    });
    state = repository.initialState || await repository.load();
    persistedState = structuredClone(state);
    storageMode = "indexeddb";
    const attachmentRepair = await repairMissingAttachments();
    if (attachmentRepair.recovered) showToast(`Recovered ${attachmentRepair.recovered} local image${attachmentRepair.recovered === 1 ? "" : "s"} from the migration backup`, 5000);
    else if (attachmentRepair.missing) showToast(`${attachmentRepair.missing} local image${attachmentRepair.missing === 1 ? " is" : "s are"} unavailable; import a backup to restore them`, 6000);
    const buffers = readDraftBuffers();
    if (Object.keys(buffers).length) {
      Object.entries(buffers).forEach(([chatId, buffer]) => {
        if (state.chats.some(chat => chat.id === chatId) && typeof buffer?.text === "string") state.drafts[chatId] = buffer.text;
      });
      await saveState({ snapshot: false, source: "draft-recovery" });
      Object.entries(buffers).forEach(([chatId, buffer]) => clearDraftBuffer(chatId, buffer.text));
    }
  } catch (error) {
    console.error("IndexedDB migration unavailable; continuing with legacy storage", error);
    repository = null;
    storageMode = "legacy";
    state = loadLegacyState();
    persistedState = structuredClone(state);
    Object.entries(readDraftBuffers()).forEach(([chatId, buffer]) => {
      if (state.chats.some(chat => chat.id === chatId) && typeof buffer?.text === "string") state.drafts[chatId] = buffer.text;
    });
    showToast("Using legacy local storage; migration will retry next time", 5000);
  }
}

function openRecoveryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withRecoveryStore(mode, operation) {
  const db = await openRecoveryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECOVERY_STORE, mode);
    const store = transaction.objectStore(RECOVERY_STORE);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => { db.close(); resolve(result?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Recovery storage was interrupted")); };
  });
}

function getRecoverySnapshots() {
  return withRecoveryStore("readonly", store => store.getAll());
}

async function createRecoverySnapshot(label = "Automatic recovery point", value = state, { force = false } = {}) {
  const snapshotState = normalizeState(value);
  const signature = recoverySignature(snapshotState);
  if (!force && signature === lastRecoverySignature) return;
  const snapshots = await getRecoverySnapshots().catch(() => []);
  const now = new Date();
  const record = {
    id: `${now.toISOString()}-${uid()}`,
    createdAt: now.toISOString(),
    label,
    messageCount: snapshotState.messages.length,
    chatCount: snapshotState.chats.length,
    state: snapshotState
  };
  await withRecoveryStore("readwrite", store => {
    store.put(record);
    snapshots
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(MAX_RECOVERY_SNAPSHOTS - 1)
      .forEach(snapshot => store.delete(snapshot.id));
  });
  lastRecoverySignature = signature;
}

function queueRecoverySnapshot() {
  clearTimeout(recoverySnapshotTimer);
  recoverySnapshotTimer = setTimeout(() => {
    createRecoverySnapshot().catch(() => {});
  }, 250);
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withImageStore(mode, operation) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, mode);
    const store = transaction.objectStore(IMAGE_STORE);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => { db.close(); resolve(result?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Image storage was interrupted")); };
  });
}

function putImage(record) {
  return withImageStore("readwrite", store => store.put(record));
}

function getImage(id) {
  return withImageStore("readonly", store => store.get(id));
}

function getAllImages() {
  return withImageStore("readonly", store => store.getAll());
}

function deleteImages(ids) {
  if (!ids.length) return Promise.resolve();
  return withImageStore("readwrite", store => ids.forEach(id => store.delete(id)));
}

function replaceImages(records) {
  return withImageStore("readwrite", store => {
    store.clear();
    records.forEach(record => store.put(record));
  });
}

function addImages(records) {
  if (!records.length) return Promise.resolve();
  return withImageStore("readwrite", store => records.forEach(record => store.put(record)));
}

async function repairMissingAttachments() {
  if (!repository?.getLegacyBackup) return { recovered: 0, missing: 0 };
  const [currentRecords, backup, snapshots] = await Promise.all([
    getAllImages().catch(() => []),
    repository.getLegacyBackup().catch(() => null),
    getRecoverySnapshots().catch(() => [])
  ]);
  const requiredIds = SelfChatStorageCore.referencedAttachmentIds(state, snapshots.map(snapshot => snapshot.state));
  const recoverable = backup?.verified
    ? SelfChatStorageCore.recoverableAttachmentRecords(requiredIds, currentRecords, backup.images)
    : [];
  if (recoverable.length) await addImages(recoverable);
  const verifiedRecords = recoverable.length ? await getAllImages().catch(() => currentRecords) : currentRecords;
  const usableIds = new Set(verifiedRecords.filter(record => record?.blob?.size > 0).map(record => record.id));
  return {
    recovered: recoverable.filter(record => usableIds.has(record.id)).length,
    missing: [...requiredIds].filter(id => !usableIds.has(id)).length
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(value) {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value || "");
  if (!match) throw new Error("Invalid image data");
  const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

function normalizeCustomStickers(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap(sticker => {
    if (!sticker || typeof sticker !== "object") return [];
    const id = typeof sticker.id === "string" && sticker.id.startsWith("custom-") ? sticker.id.slice(0, 80) : "";
    const imageId = typeof sticker.imageId === "string" ? sticker.imageId.slice(0, 80) : "";
    const label = typeof sticker.label === "string" ? sticker.label.trim().slice(0, 40) : "Sticker";
    const emoji = typeof sticker.emoji === "string" ? sticker.emoji.trim().slice(0, 16) : "";
    const caption = typeof sticker.caption === "string" ? sticker.caption.trim().slice(0, 18) : "";
    const tone = typeof sticker.tone === "string" ? sticker.tone.slice(0, 20) : "mint";
    if (!id || ids.has(id) || (!imageId && (!emoji || !caption))) return [];
    ids.add(id);
    return [imageId ? { id, imageId, label } : { id, emoji, caption, label: `${caption} ${emoji}`, tone }];
  });
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

function allStickers() {
  return [...STICKERS, ...state.customStickers];
}

function stickerFor(message) {
  return allStickers().find(sticker => sticker.id === message.stickerId);
}

function messageLabel(message) {
  if (message.type === "sticker") return stickerFor(message)?.label || "Sticker";
  if (message.type === "image") return `Image ${message.imageName || ""} ${message.caption || ""}`.trim();
  return message.text || "";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
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
  });
  const renderChat = chat => {
    const lastMessage = messagesFor(chat.id).at(-1);
    const time = lastMessage ? formatSidebarTime(lastMessage.createdAt) : "";
    const preview = lastMessage ? (lastMessage.type === "sticker" ? "Sticker" : lastMessage.type === "image" ? `Photo${lastMessage.caption ? ` · ${lastMessage.caption}` : ""}` : lastMessage.text) : "No messages yet";
    return `<button class="chat-row ${chat.id === state.activeChatId ? "active" : ""}" data-chat-id="${chat.id}" type="button">
      <span class="chat-row-avatar">${escapeHtml(chat.emoji)}</span>
      <span class="chat-row-body">
        <span class="chat-row-line"><span class="chat-row-name">${escapeHtml(chat.name)}</span><span class="chat-row-time">${time}</span></span>
        <span class="chat-row-preview">${escapeHtml(preview)}</span>
      </span>
    </button>`;
  };
  if (!query) {
    elements.chatList.innerHTML = chats.map(renderChat).join("");
    return;
  }
  const chatMatches = chats.filter(chat => chat.name.toLocaleLowerCase().includes(query));
  const messageMatches = state.messages
    .filter(message => messageLabel(message).toLocaleLowerCase().includes(query))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const chatSection = chatMatches.length ? `<span class="search-section-label">Chats</span>${chatMatches.map(renderChat).join("")}` : "";
  const messageSection = messageMatches.length ? `<span class="search-section-label">Messages</span>${messageMatches.map(message => {
    const chat = state.chats.find(item => item.id === message.chatId);
    return `<button class="global-message-result" type="button" data-search-message-id="${escapeHtml(message.id)}" data-search-chat-id="${escapeHtml(message.chatId)}">
      <span class="result-icon">${escapeHtml(chat?.emoji || "💬")}</span>
      <span class="result-copy"><strong>${escapeHtml(chat?.name || "Unsorted")} · ${escapeHtml(formatSidebarTime(message.createdAt))}</strong><span>${escapeHtml(messageLabel(message))}</span></span>
    </button>`;
  }).join("")}` : "";
  elements.chatList.innerHTML = chatSection || messageSection ? chatSection + messageSection : '<p class="search-empty">No chats or messages found.</p>';
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
  const renderToken = ++imageRenderToken;
  imageObjectUrls.forEach(url => URL.revokeObjectURL(url));
  imageObjectUrls = [];
  const query = elements.messageSearchInput.value.trim().toLocaleLowerCase();
  const allMessages = messagesFor();
  const visibleMessages = allMessages;
  const matchIds = query ? allMessages.filter(message => messageLabel(message).toLocaleLowerCase().includes(query)).map(message => message.id) : [];
  if (messageSearchIndex >= matchIds.length) messageSearchIndex = Math.max(0, matchIds.length - 1);
  const activeMatchId = matchIds[messageSearchIndex];
  elements.emptyState.hidden = allMessages.length > 0;
  elements.messageList.hidden = allMessages.length === 0;
  elements.searchResultCount.textContent = query ? (matchIds.length ? `${messageSearchIndex + 1} of ${matchIds.length}` : "0 found") : "";
  elements.previousSearchResult.disabled = matchIds.length < 2;
  elements.nextSearchResult.disabled = matchIds.length < 2;
  elements.selectionBar.hidden = selectedMessageIds.size === 0;
  elements.selectionCount.textContent = `${selectedMessageIds.size} selected`;
  let previousDate = "";

  elements.messageList.innerHTML = visibleMessages.map(message => {
    const date = formatDay(message.createdAt);
    const divider = date !== previousDate ? `<div class="day-divider">${date}</div>` : "";
    previousDate = date;
    const sticker = message.type === "sticker" ? stickerFor(message) : null;
    const image = message.type === "image";
    const stickerImage = sticker?.imageId;
    const content = image
      ? `<img class="message-media" data-image-id="${escapeHtml(message.imageId)}" alt="${escapeHtml(message.imageName || "Image")}" hidden><span class="image-fallback">Loading image…<small>${escapeHtml(message.imageName || "Image")}</small></span>${message.caption ? `<span class="image-caption">${query ? highlightMatch(message.caption, query) : escapeHtml(message.caption)}</span>` : ""}`
      : stickerImage
      ? `<img class="sticker-art sticker-image" data-image-id="${escapeHtml(sticker.imageId)}" alt="${escapeHtml(sticker.label)}" hidden><span class="sticker-image-fallback">Loading sticker…</span>`
      : sticker
      ? `<span class="sticker-art sticker-${sticker.tone}" role="img" aria-label="${escapeHtml(sticker.label)}"><span class="sticker-emoji">${escapeHtml(sticker.emoji)}</span>${sticker.caption ? `<span class="sticker-caption">${escapeHtml(sticker.caption)}</span>` : ""}</span>`
      : `<span class="message-text">${renderLinkedText(message.text || "", query)}</span>`;
    return `${divider}<article class="message${sticker ? " sticker-message" : image ? " image-message" : " text-message"}${message.editedAt ? " message-edited" : ""}${selectedMessageIds.size ? " selection-mode" : ""}${selectedMessageIds.has(message.id) ? " selected" : ""}${message.id === activeMatchId ? " search-match-active" : ""}${message.id === focusedMessageId ? " flash-target" : ""}" data-message-id="${message.id}" aria-selected="${selectedMessageIds.has(message.id)}">
      <button class="message-menu-trigger" type="button" aria-label="Message options">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      ${content}
      <span class="message-meta">${message.editedAt ? "edited · " : ""}${formatTime(message.createdAt)}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 13 4 4L16 7"/><path d="m9 16 2 2L22 7"/></svg>
      </span>
    </article>`;
  }).join("");

  hydrateImages(renderToken);
  if (activeMatchId) requestAnimationFrame(() => scrollMessageIntoView(activeMatchId));
  else if (focusedMessageId) requestAnimationFrame(() => {
    scrollMessageIntoView(focusedMessageId);
    setTimeout(() => { focusedMessageId = null; }, 1700);
  });
  else if (!query) requestAnimationFrame(scrollToBottom);
}

function scrollMessageIntoView(messageId) {
  elements.messageList.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function navigateSearch(direction) {
  const query = elements.messageSearchInput.value.trim().toLocaleLowerCase();
  const matches = messagesFor().filter(message => messageLabel(message).toLocaleLowerCase().includes(query));
  if (!matches.length) return;
  messageSearchIndex = (messageSearchIndex + direction + matches.length) % matches.length;
  renderMessages();
}

async function hydrateImages(renderToken) {
  const images = [...elements.messageList.querySelectorAll("[data-image-id]")];
  await Promise.all(images.map(async image => {
    try {
      const record = await getImage(image.dataset.imageId);
      if (renderToken !== imageRenderToken || !image.isConnected) return;
      if (!record?.blob) throw new Error("Image not found");
      const url = URL.createObjectURL(record.blob);
      imageObjectUrls.push(url);
      image.addEventListener("load", () => {
        image.hidden = false;
        if (image.nextElementSibling) image.nextElementSibling.hidden = true;
        scrollToBottom();
      }, { once: true });
      image.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        if (image.nextElementSibling) image.nextElementSibling.textContent = "This image cannot be displayed";
      }, { once: true });
      image.src = url;
    } catch (_) {
      if (image.isConnected && image.nextElementSibling) image.nextElementSibling.textContent = "Image unavailable";
    }
  }));
}

function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${escapedQuery})`, "gi"), '<mark class="highlight">$1</mark>');
}

function renderLinkedText(text, query = "") {
  const value = String(text || "");
  const urlPattern = /https?:\/\/[^\s<>]+/gi;
  let cursor = 0;
  let output = "";
  for (const match of value.matchAll(urlPattern)) {
    output += query ? highlightMatch(value.slice(cursor, match.index), query) : escapeHtml(value.slice(cursor, match.index));
    let url = match[0];
    const trailing = url.match(/[),.!?;:]+$/)?.[0] || "";
    if (trailing) url = url.slice(0, -trailing.length);
    output += `<a class="message-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${query ? highlightMatch(url, query) : escapeHtml(url)}</a>`;
    output += query ? highlightMatch(trailing, query) : escapeHtml(trailing);
    cursor = match.index + match[0].length;
  }
  output += query ? highlightMatch(value.slice(cursor), query) : escapeHtml(value.slice(cursor));
  return output;
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

async function sendMessage() {
  const text = elements.messageInput.value.trim();
  if (!text) return;
  const message = { id: uid(), chatId: state.activeChatId, text, createdAt: new Date().toISOString(), editedAt: null };
  state.messages.push(message);
  state.drafts[state.activeChatId] = "";
  try {
    await saveState();
  } catch (_) {
    state.messages = state.messages.filter(item => item.id !== message.id);
    showToast("Message not saved — your text is still here", 5000);
    elements.messageInput.focus();
    return;
  }
  clearDraftBuffer(message.chatId, elements.messageInput.value);
  elements.messageInput.value = "";
  resizeComposer();
  updateComposerState();
  render();
  elements.messageInput.focus();
}

async function sendSticker(stickerId) {
  if (!allStickers().some(sticker => sticker.id === stickerId)) return;
  const message = { id: uid(), chatId: state.activeChatId, type: "sticker", stickerId, createdAt: new Date().toISOString(), editedAt: null };
  state.messages.push(message);
  try {
    await saveState();
  } catch (_) {
    state.messages = state.messages.filter(item => item.id !== message.id);
    return showToast("Sticker not saved", 5000);
  }
  closeStickerPanel();
  render();
  elements.messageInput.focus();
}

async function sendImages(files, caption = "") {
  const images = [...files].filter(file => file.type.startsWith("image/"));
  if (!images.length) return showToast("Choose an image file");
  let stored = 0;
  const addedMessageIds = [];
  const addedImageIds = [];
  for (const [index, file] of images.entries()) {
    const imageId = uid();
    try {
      await putImage({ id: imageId, blob: file, name: file.name || `Pasted image ${index + 1}` });
      addedImageIds.push(imageId);
      const messageId = uid();
      state.messages.push({
        id: messageId, chatId: state.activeChatId, type: "image", imageId,
        imageName: file.name || "Pasted image", imageType: file.type, caption: index === 0 ? caption : "",
        createdAt: new Date(Date.now() + index).toISOString(), editedAt: null
      });
      addedMessageIds.push(messageId);
      stored += 1;
    } catch (_) {
      showToast("Could not save an image locally");
    }
  }
  if (!stored) return;
  state.drafts[state.activeChatId] = "";
  try {
    await saveState();
  } catch (_) {
    state.messages = state.messages.filter(message => !addedMessageIds.includes(message.id));
    await deleteImages(addedImageIds).catch(() => {});
    showToast("Images not sent — they are still ready to send", 5000);
    return;
  }
  clearDraftBuffer(state.activeChatId, elements.messageInput.value);
  clearPendingImages();
  elements.messageInput.value = "";
  resizeComposer();
  updateComposerState();
  closeStickerPanel();
  render();
  elements.messageInput.focus();
  showToast(stored === 1 ? "Image sent" : `${stored} images sent`);
}

function stageImages(files) {
  const images = [...files].filter(file => file.type.startsWith("image/"));
  if (!images.length) return showToast("Choose an image file");
  images.forEach(file => pendingImages.push({ id: uid(), file, url: URL.createObjectURL(file) }));
  renderPendingImages();
  closeStickerPanel();
  elements.messageInput.focus();
}

function renderPendingImages() {
  elements.imagePreviewTray.hidden = pendingImages.length === 0;
  elements.imagePreviewTitle.textContent = pendingImages.length === 1 ? "Image ready to send" : `${pendingImages.length} images ready to send`;
  elements.imagePreviewList.innerHTML = pendingImages.map(image => `<div class="pending-image"><img src="${image.url}" alt="${escapeHtml(image.file.name || "Pasted image")}"><button type="button" data-remove-pending-image="${image.id}" aria-label="Remove image" title="Remove image">×</button></div>`).join("");
  updateComposerState();
}

function clearPendingImages() {
  pendingImages.forEach(image => URL.revokeObjectURL(image.url));
  pendingImages = [];
  renderPendingImages();
}

function updateComposerState() {
  elements.sendButton.disabled = !elements.messageInput.value.trim() && pendingImages.length === 0;
  elements.messageInput.placeholder = pendingImages.length ? "Add a caption" : "Type a message";
}

async function submitComposer() {
  if (pendingImages.length) {
    const files = pendingImages.map(image => image.file);
    await sendImages(files, elements.messageInput.value.trim());
    return;
  }
  sendMessage();
}

function closeStickerPanel() {
  elements.stickerPanel.hidden = true;
  elements.stickerButton.setAttribute("aria-expanded", "false");
}

function renderStickerGrid() {
  stickerGridObjectUrls.forEach(url => URL.revokeObjectURL(url));
  stickerGridObjectUrls = [];
  elements.stickerGrid.innerHTML = allStickers().map(sticker => sticker.imageId
    ? `<button class="sticker-choice sticker-image-choice" type="button" data-sticker-id="${escapeHtml(sticker.id)}" aria-label="Send ${escapeHtml(sticker.label)}" title="${escapeHtml(sticker.label)}"><img data-image-id="${escapeHtml(sticker.imageId)}" alt="" hidden><span class="sticker-choice-fallback">…</span></button>`
    : `<button class="sticker-choice sticker-${sticker.tone}" type="button" data-sticker-id="${escapeHtml(sticker.id)}" aria-label="Send ${escapeHtml(sticker.label)}" title="${escapeHtml(sticker.label)}"><span class="sticker-emoji">${escapeHtml(sticker.emoji)}</span>${sticker.caption ? `<span class="sticker-caption">${escapeHtml(sticker.caption)}</span>` : ""}</button>`).join("");
  hydrateStickerGridImages();
}

async function hydrateStickerGridImages() {
  await Promise.all([...elements.stickerGrid.querySelectorAll("[data-image-id]")].map(async image => {
    const record = await getImage(image.dataset.imageId).catch(() => null);
    if (!record?.blob || !image.isConnected) return;
    const url = URL.createObjectURL(record.blob);
    stickerGridObjectUrls.push(url);
    image.addEventListener("load", () => {
      image.hidden = false;
      if (image.nextElementSibling) image.nextElementSibling.hidden = true;
    }, { once: true });
    image.src = url;
  }));
}

function resetStickerCreator() {
  if (pendingStickerUrl) URL.revokeObjectURL(pendingStickerUrl);
  pendingStickerImage = null;
  pendingStickerUrl = null;
  elements.stickerImageInput.value = "";
  elements.stickerNameInput.value = "";
  elements.stickerImagePreview.removeAttribute("src");
  elements.stickerImagePreview.hidden = true;
  elements.stickerImagePlaceholder.hidden = false;
  elements.stickerImageChange.hidden = true;
  elements.saveStickerButton.disabled = true;
  elements.stickerImageDropzone.classList.remove("has-image");
}

function stageStickerImage(file) {
  if (!file?.type?.startsWith("image/")) return showToast("Choose an image file");
  if (pendingStickerUrl) URL.revokeObjectURL(pendingStickerUrl);
  pendingStickerImage = file;
  pendingStickerUrl = URL.createObjectURL(file);
  elements.stickerImagePreview.src = pendingStickerUrl;
  elements.stickerImagePreview.hidden = false;
  elements.stickerImagePlaceholder.hidden = true;
  elements.stickerImageChange.hidden = false;
  elements.saveStickerButton.disabled = false;
  elements.stickerImageDropzone.classList.add("has-image");
  if (!elements.stickerNameInput.value.trim()) elements.stickerNameInput.value = (file.name || "My sticker").replace(/\.[^.]+$/, "").slice(0, 40);
}

async function selectChat(id, messageId = null) {
  clearPendingImages();
  state.activeChatId = id;
  elements.messageSearchInput.value = "";
  elements.messageSearchPanel.hidden = true;
  closeStickerPanel();
  selectedMessageIds.clear();
  focusedMessageId = messageId;
  await saveState({ snapshot: false });
  elements.messageInput.value = state.drafts[id] || "";
  resizeComposer();
  updateComposerState();
  render();
  elements.messageInput.focus();
}

function resizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 160)}px`;
}

function showToast(text, duration = 1800) {
  elements.toast.textContent = text;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), duration);
}

function closeContextMenu() {
  elements.contextMenu.hidden = true;
  contextMessageId = null;
}

function clearMessageSelection() {
  selectedMessageIds.clear();
  renderMessages();
}

async function deleteSelectedMessages() {
  const messages = state.messages.filter(message => selectedMessageIds.has(message.id));
  if (!messages.length || !confirm(`Move ${messages.length} selected message${messages.length === 1 ? "" : "s"} to Trash?`)) return;
  await createRecoverySnapshot("Before deleting selected messages", state, { force: true }).catch(() => {});
  try {
    await commitExplicit(messages.map(message => operation("message.delete", message.id, "message", { message, originalChatId: message.chatId })));
    selectedMessageIds.clear();
    render();
    showToast(`${messages.length} message${messages.length === 1 ? "" : "s"} moved to Trash`);
  } catch (_) { showToast("Messages could not be moved to Trash", 5000); }
}

function openMoveDialog(messageIds) {
  selectedMessageIds = new Set(messageIds.filter(id => state.messages.some(message => message.id === id)));
  if (!selectedMessageIds.size) return;
  const count = selectedMessageIds.size;
  elements.moveTitle.textContent = count === 1 ? "Move message" : `Move ${count} messages`;
  elements.moveDestination.innerHTML = [...state.chats]
    .sort((a, b) => (a.id === "unsorted" ? -1 : b.id === "unsorted" ? 1 : a.name.localeCompare(b.name)))
    .map(chat => `<option value="${escapeHtml(chat.id)}">${escapeHtml(chat.name)}</option>`).join("");
  const first = state.messages.find(message => selectedMessageIds.has(message.id));
  const alternative = state.chats.find(chat => chat.id !== first?.chatId);
  if (alternative) elements.moveDestination.value = alternative.id;
  elements.moveDialog.showModal();
}

function trashLabel(item) {
  const payload = item.payload || {};
  if (item.entityType === "chat") return payload.chat?.name || "Deleted chat";
  const message = payload.message;
  if (!message) return "Deleted message";
  if (message.type === "image") return message.caption || message.imageName || "Photo";
  if (message.type === "sticker") return "Sticker";
  return message.text || "Message";
}

function purgeTargets(items) {
  const entityIds = new Set();
  const chatIds = new Set();
  const messageIds = new Set();
  const imageIds = new Set();
  items.forEach(item => {
    entityIds.add(item.entityId);
    const payload = item.payload || {};
    if (item.entityType === "chat") {
      chatIds.add(item.entityId);
      (payload.messages || []).forEach(message => {
        messageIds.add(message.id);
        entityIds.add(message.id);
        if (message.imageId) imageIds.add(message.imageId);
      });
    } else {
      messageIds.add(item.entityId);
      if (payload.message?.imageId) imageIds.add(payload.message.imageId);
    }
  });
  return { entityIds, chatIds, messageIds, imageIds };
}

function redactPurgedContent(value, targets) {
  return SelfChatStorageCore.redactState(value, targets, DEFAULT_STATE);
}

function redactLegacySources(targets) {
  [STORAGE_KEY, RECOVERY_KEY].forEach(key => {
    const stored = readStoredState(key);
    if (stored) localStorage.setItem(key, JSON.stringify(redactPurgedContent(stored, targets)));
  });
}

async function redactRecoveryPoints(targets) {
  const snapshots = await getRecoverySnapshots().catch(() => []);
  await withRecoveryStore("readwrite", store => snapshots.forEach(snapshot => {
    const nextState = redactPurgedContent(snapshot.state, targets);
    store.put({ ...snapshot, state: nextState, messageCount: nextState.messages.length, chatCount: nextState.chats.length });
  }));
}

async function completePermanentPurge(items) {
  const targets = purgeTargets(items);
  await repository?.purgeHistory([...targets.entityIds]);
  redactLegacySources(targets);
  await redactRecoveryPoints(targets);
  const snapshots = await getRecoverySnapshots().catch(() => []);
  const referenced = SelfChatStorageCore.referencedAttachmentIds(state, snapshots.map(snapshot => snapshot.state));
  await deleteImages([...targets.imageIds].filter(id => !referenced.has(id)));
  lastRecoverySignature = recoverySignature(state);
}

function renderTrash() {
  const items = [...(state.trash || [])].sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
  elements.trashCount.textContent = String(items.length);
  elements.emptyTrashButton.disabled = items.length === 0;
  elements.trashList.innerHTML = items.length ? items.map(item => {
    const payload = item.payload || {};
    const originalChatId = payload.originalChatId || payload.message?.chatId;
    const originalChat = state.chats.find(chat => chat.id === originalChatId);
    const detail = item.entityType === "chat"
      ? `${(payload.messages || []).length} message${(payload.messages || []).length === 1 ? "" : "s"} · deleted ${formatDay(item.deletedAt)}`
      : `${originalChat ? `From ${originalChat.name}` : "Original chat unavailable · restore to Unsorted"} · deleted ${formatDay(item.deletedAt)}`;
    return `<div class="trash-row" data-trash-id="${escapeHtml(item.id)}">
      <span class="trash-row-copy"><strong>${escapeHtml(trashLabel(item))}</strong><span>${escapeHtml(detail)}</span></span>
      <span class="trash-actions"><button type="button" data-trash-action="restore">${item.entityType === "message" && !originalChat ? "Restore to Unsorted" : "Restore"}</button><button class="danger" type="button" data-trash-action="purge">Delete permanently</button></span>
    </div>`;
  }).join("") : '<p class="trash-empty">Trash is empty.</p>';
}

elements.composer.addEventListener("submit", event => { event.preventDefault(); submitComposer(); });
elements.messageInput.addEventListener("input", () => {
  resizeComposer();
  updateComposerState();
  state.drafts[state.activeChatId] = elements.messageInput.value;
  setDraftBuffer(state.activeChatId, elements.messageInput.value);
  clearTimeout(draftSaveTimer);
  const bufferedChatId = state.activeChatId;
  const bufferedText = elements.messageInput.value;
  draftSaveTimer = setTimeout(() => saveState({ snapshot: false }).then(() => clearDraftBuffer(bufferedChatId, bufferedText)).catch(() => showToast("Draft could not be saved", 4000)), 180);
});
elements.messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submitComposer();
  }
});
elements.imageButton.addEventListener("click", () => elements.imageInput.click());
elements.imageInput.addEventListener("change", () => {
  stageImages(elements.imageInput.files);
  elements.imageInput.value = "";
});
document.addEventListener("paste", event => {
  const itemImages = [...(event.clipboardData?.items || [])]
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
  const images = itemImages.length
    ? itemImages
    : [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith("image/"));
  if (!images.length) return;
  event.preventDefault();
  if (elements.stickerDialog.open) {
    stageStickerImage(images[0]);
    return;
  }
  stageImages(images);
});
elements.imagePreviewList.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-pending-image]");
  if (!button) return;
  const image = pendingImages.find(item => item.id === button.dataset.removePendingImage);
  if (image) URL.revokeObjectURL(image.url);
  pendingImages = pendingImages.filter(item => item !== image);
  renderPendingImages();
  elements.messageInput.focus();
});
$("#clearImagePreviews").addEventListener("click", () => {
  clearPendingImages();
  elements.messageInput.focus();
});
let dragDepth = 0;
document.addEventListener("dragenter", event => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  if (elements.stickerDialog.open) return;
  dragDepth += 1;
  elements.dropOverlay.hidden = false;
});
document.addEventListener("dragover", event => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  if (elements.stickerDialog.open) return;
  event.dataTransfer.dropEffect = "copy";
});
document.addEventListener("dragleave", event => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  if (elements.stickerDialog.open) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) elements.dropOverlay.hidden = true;
});
document.addEventListener("drop", event => {
  event.preventDefault();
  dragDepth = 0;
  elements.dropOverlay.hidden = true;
  if (elements.stickerDialog.open) {
    stageStickerImage([...event.dataTransfer.files].find(file => file.type.startsWith("image/")));
    return;
  }
  stageImages(event.dataTransfer.files);
});
elements.chatList.addEventListener("click", event => {
  const result = event.target.closest("[data-search-message-id]");
  if (result) {
    elements.chatFilterInput.value = "";
    selectChat(result.dataset.searchChatId, result.dataset.searchMessageId);
    return;
  }
  const row = event.target.closest("[data-chat-id]");
  if (row) selectChat(row.dataset.chatId);
});
elements.chatFilterInput.addEventListener("input", renderChats);

renderStickerGrid();
elements.stickerButton.addEventListener("click", () => {
  const willOpen = elements.stickerPanel.hidden;
  elements.stickerPanel.hidden = !willOpen;
  elements.stickerButton.setAttribute("aria-expanded", String(willOpen));
});
elements.stickerGrid.addEventListener("click", event => {
  const choice = event.target.closest("[data-sticker-id]");
  if (choice) sendSticker(choice.dataset.stickerId);
});

$("#createStickerButton").addEventListener("click", () => {
  resetStickerCreator();
  elements.stickerDialog.showModal();
  closeStickerPanel();
  setTimeout(() => elements.stickerImageDropzone.focus(), 40);
});
$("#cancelStickerButton").addEventListener("click", () => elements.stickerDialog.close());
elements.stickerImageDropzone.addEventListener("click", () => elements.stickerImageInput.click());
elements.stickerImageInput.addEventListener("change", () => {
  stageStickerImage(elements.stickerImageInput.files[0]);
  elements.stickerImageInput.value = "";
});
elements.stickerImageDropzone.addEventListener("dragover", event => {
  event.preventDefault();
  event.stopPropagation();
  elements.stickerImageDropzone.classList.add("dragging");
});
elements.stickerImageDropzone.addEventListener("dragleave", () => elements.stickerImageDropzone.classList.remove("dragging"));
elements.stickerImageDropzone.addEventListener("drop", event => {
  event.preventDefault();
  event.stopPropagation();
  elements.stickerImageDropzone.classList.remove("dragging");
  stageStickerImage([...event.dataTransfer.files].find(file => file.type.startsWith("image/")));
});
elements.stickerDialog.addEventListener("close", resetStickerCreator);
elements.stickerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!pendingStickerImage) return;
  const imageId = uid();
  const label = elements.stickerNameInput.value.trim() || "My sticker";
  elements.saveStickerButton.disabled = true;
  try {
    await putImage({ id: imageId, blob: pendingStickerImage, name: pendingStickerImage.name || label });
  } catch (_) {
    elements.saveStickerButton.disabled = false;
    return showToast("Could not save the sticker locally");
  }
  const sticker = { id: `custom-${uid()}`, imageId, label: label.slice(0, 40) };
  state.customStickers.push(sticker);
  try { await saveState(); } catch (_) {
    state.customStickers = state.customStickers.filter(item => item.id !== sticker.id);
    await deleteImages([imageId]).catch(() => {});
    elements.saveStickerButton.disabled = false;
    return showToast("Could not save the sticker locally");
  }
  renderStickerGrid();
  elements.stickerDialog.close();
  showToast("Sticker created");
});

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
elements.chatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = elements.chatNameInput.value.trim();
  if (!name) return;
  const chat = { id: uid(), name, emoji: selectedEmoji, createdAt: new Date().toISOString() };
  state.chats.push(chat);
  state.activeChatId = chat.id;
  try { await saveState(); } catch (_) {
    state.chats = state.chats.filter(item => item.id !== chat.id);
    state.activeChatId = persistedState.activeChatId;
    return showToast("Chat could not be saved", 5000);
  }
  elements.chatDialog.close();
  render();
  elements.messageInput.focus();
});

$("#messageSearchButton").addEventListener("click", () => {
  clearMessageSelection();
  messageSearchIndex = 0;
  elements.messageSearchPanel.hidden = false;
  elements.messageSearchInput.focus();
});
$("#closeMessageSearch").addEventListener("click", () => {
  elements.messageSearchInput.value = "";
  elements.messageSearchPanel.hidden = true;
  messageSearchIndex = 0;
  renderMessages();
  elements.messageInput.focus();
});
elements.messageSearchInput.addEventListener("input", () => { messageSearchIndex = 0; renderMessages(); });
elements.messageSearchInput.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    $("#closeMessageSearch").click();
  }
  if (event.key === "Enter") {
    event.preventDefault();
    navigateSearch(event.shiftKey ? -1 : 1);
  }
});
elements.previousSearchResult.addEventListener("click", () => navigateSearch(-1));
elements.nextSearchResult.addEventListener("click", () => navigateSearch(1));

$("#chatMenuButton").addEventListener("click", () => elements.optionsDialog.showModal());
$("#closeOptionsButton").addEventListener("click", () => elements.optionsDialog.close());
$("#renameChatButton").addEventListener("click", async () => {
  const chat = activeChat();
  if (chat.id === "unsorted") return showToast("Unsorted is permanent");
  const nextName = prompt("Rename chat", chat.name)?.trim();
  if (!nextName) return;
  chat.name = nextName.slice(0, 48);
  chat.updatedAt = new Date().toISOString();
  await saveState();
  elements.optionsDialog.close();
  render();
});
$("#deleteChatButton").addEventListener("click", async () => {
  if (state.chats.length === 1) return showToast("Keep at least one chat");
  const chat = activeChat();
  if (chat.id === "unsorted") return showToast("Unsorted is permanent");
  if (!confirm(`Move “${chat.name}” and all its messages to Trash? You can restore it later.`)) return;
  await createRecoverySnapshot(`Before deleting ${chat.name}`, state, { force: true }).catch(() => {});
  state.deletedChatIds.push(chat.id);
  state.deletedMessageIds.push(...state.messages.filter(message => message.chatId === chat.id).map(message => message.id));
  state.chats = state.chats.filter(item => item.id !== chat.id);
  state.messages = state.messages.filter(message => message.chatId !== chat.id);
  state.activeChatId = state.chats[0].id;
  await saveState();
  elements.optionsDialog.close();
  render();
  showToast("Chat moved to Trash");
});

elements.moveForm.addEventListener("submit", async event => {
  event.preventDefault();
  const targetChatId = elements.moveDestination.value;
  if (!state.chats.some(chat => chat.id === targetChatId)) return;
  const moving = state.messages.filter(message => selectedMessageIds.has(message.id) && message.chatId !== targetChatId);
  if (!moving.length) {
    elements.moveDialog.close();
    clearMessageSelection();
    return showToast("Messages are already in that chat");
  }
  const operations = moving.map(message => operation("message.move", message.id, "message", { ...message, chatId: targetChatId }));
  try {
    await commitExplicit(operations);
    elements.moveDialog.close();
    selectedMessageIds.clear();
    render();
    showToast(`${moving.length} message${moving.length === 1 ? "" : "s"} moved`);
  } catch (_) { showToast("Messages could not be moved", 5000); }
});
$("#cancelMoveButton").addEventListener("click", () => elements.moveDialog.close());
elements.moveDialog.addEventListener("close", () => { selectedMessageIds.clear(); renderMessages(); });
$("#moveSelectedButton").addEventListener("click", () => openMoveDialog([...selectedMessageIds]));
$("#deleteSelectedButton").addEventListener("click", deleteSelectedMessages);
$("#cancelSelectionButton").addEventListener("click", clearMessageSelection);

async function renderRecoveryPoints() {
  elements.recoveryStatus.textContent = "Loading recovery points…";
  elements.recoveryList.innerHTML = "";
  const snapshots = await getRecoverySnapshots().catch(() => null);
  if (!snapshots) {
    elements.recoveryStatus.textContent = "Recovery storage is unavailable in this browser.";
    return;
  }
  const recent = snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  elements.recoveryStatus.textContent = recent.length
    ? `Keeping up to ${MAX_RECOVERY_SNAPSHOTS} rolling recovery points on this device.`
    : "Your first recovery point will appear after the next content change.";
  elements.recoveryList.innerHTML = recent.map(snapshot => {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.createdAt));
    const counts = `${snapshot.messageCount} message${snapshot.messageCount === 1 ? "" : "s"} · ${snapshot.chatCount} chat${snapshot.chatCount === 1 ? "" : "s"}`;
    return `<div class="recovery-row"><span><strong>${escapeHtml(date)}</strong><small>${escapeHtml(counts)}</small></span><button type="button" data-restore-snapshot="${escapeHtml(snapshot.id)}">Restore</button></div>`;
  }).join("");
}

async function renderStorageDiagnostics() {
  const [estimate, images, snapshots, operationCount] = await Promise.all([
    navigator.storage?.estimate?.().catch(() => null),
    getAllImages().catch(() => []),
    getRecoverySnapshots().catch(() => []),
    repository?.operationCount?.().catch(() => null)
  ]);
  const used = estimate?.usage == null ? "Unavailable" : `${(estimate.usage / 1024 / 1024).toFixed(1)} MB used`;
  const quota = estimate?.quota == null ? "" : ` of ${(estimate.quota / 1024 / 1024).toFixed(0)} MB`;
  const lastExport = localStorage.getItem("selfchat-last-export-v1");
  const exportText = lastExport ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastExport)) : "Never";
  elements.storageDiagnostics.textContent = `${storageMode === "indexeddb" ? "Transactional IndexedDB active" : "Legacy fallback active"} · ${used}${quota} · ${images.length} local image${images.length === 1 ? "" : "s"} · ${snapshots.length} recovery point${snapshots.length === 1 ? "" : "s"}${operationCount == null ? "" : ` · ${operationCount} operations`} · Last export: ${exportText}`;
}

$("#settingsButton").addEventListener("click", () => {
  elements.settingsDialog.showModal();
  renderTrash();
  renderRecoveryPoints();
  renderStorageDiagnostics();
});
$("#closeSettingsButton").addEventListener("click", () => elements.settingsDialog.close());
$("#openTrashButton").addEventListener("click", () => {
  elements.settingsDialog.close();
  renderTrash();
  elements.trashDialog.showModal();
});
$("#closeTrashButton").addEventListener("click", () => elements.trashDialog.close());
elements.trashList.addEventListener("click", async event => {
  const button = event.target.closest("[data-trash-action]");
  const row = event.target.closest("[data-trash-id]");
  const item = state.trash.find(candidate => candidate.id === row?.dataset.trashId);
  if (!button || !item) return;
  const payload = item.payload || {};
  if (button.dataset.trashAction === "restore") {
    let restoreOperation;
    if (item.entityType === "chat") {
      restoreOperation = operation("chat.restore", item.entityId, "chat", payload);
    } else {
      const originalChatId = payload.originalChatId || payload.message?.chatId;
      const targetChatId = state.chats.some(chat => chat.id === originalChatId) ? originalChatId : "unsorted";
      restoreOperation = operation("message.restore", item.entityId, "message", { message: payload.message, targetChatId });
    }
    try {
      await commitExplicit([restoreOperation]);
      render(); renderTrash();
      showToast(item.entityType === "chat" ? "Chat restored" : "Message restored");
    } catch (_) { showToast("Item could not be restored", 5000); }
    return;
  }
  if (!confirm(`Erase “${trashLabel(item).slice(0, 80)}” from this browser permanently? This removes it from Trash, recovery points, migration backups, operation history, and unreferenced local image storage. This cannot be undone.`)) return;
  try {
    await commitExplicit([operation(`${item.entityType}.purge`, item.entityId, item.entityType, { trashId: item.id })]);
    await completePermanentPurge([item]);
    renderTrash();
    await renderRecoveryPoints();
    await renderStorageDiagnostics();
    showToast("Erased from this browser");
  } catch (_) { showToast("Item could not be permanently deleted", 5000); }
});
elements.emptyTrashButton.addEventListener("click", async () => {
  if (!state.trash.length || !confirm("Erase every Trash item from this browser permanently? This also removes matching recovery, migration, history, and unreferenced image data. This cannot be undone.")) return;
  const items = structuredClone(state.trash);
  try {
    await commitExplicit([operation("trash.empty", "trash", "trash", { itemIds: state.trash.map(item => item.id) })]);
    await completePermanentPurge(items);
    renderTrash();
    await renderRecoveryPoints();
    await renderStorageDiagnostics();
    showToast("Trash erased from this browser");
  } catch (_) { showToast("Trash could not be emptied", 5000); }
});
elements.recoveryList.addEventListener("click", async event => {
  const button = event.target.closest("[data-restore-snapshot]");
  if (!button) return;
  const snapshots = await getRecoverySnapshots().catch(() => []);
  const snapshot = snapshots.find(item => item.id === button.dataset.restoreSnapshot);
  if (!snapshot) return;
  recoveryPreviewSnapshot = snapshot;
  const target = normalizeState(snapshot.state);
  const currentIds = new Set(state.messages.map(message => message.id));
  const targetIds = new Set(target.messages.map(message => message.id));
  const restored = target.messages.filter(message => !currentIds.has(message.id)).length;
  const removed = state.messages.filter(message => !targetIds.has(message.id)).length;
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.createdAt));
  elements.recoveryPreviewSummary.textContent = `${date}: ${target.chats.length} chats and ${target.messages.length} messages. Compared with now, ${restored} messages will return and ${removed} newer messages will leave the active view. A new recovery point will preserve the current state.`;
  elements.recoveryPreviewDialog.showModal();
});
$("#cancelRecoveryButton").addEventListener("click", () => elements.recoveryPreviewDialog.close());
$("#confirmRecoveryButton").addEventListener("click", async () => {
  const snapshot = recoveryPreviewSnapshot;
  if (!snapshot) return;
  $("#confirmRecoveryButton").disabled = true;
  await createRecoverySnapshot("Before restore", state, { force: true }).catch(() => {});
  try {
    const target = normalizeState(snapshot.state);
    if (repository) {
      state = await repository.replaceState(target, operation("state.restore", snapshot.id, "state", { snapshotId: snapshot.id, chatCount: target.chats.length, messageCount: target.messages.length }, "recovery"));
      persistedState = structuredClone(state);
    } else {
      state = target;
      await saveState({ snapshot: false, source: "recovery" });
    }
    lastRecoverySignature = recoverySignature(state);
    recoveryPreviewSnapshot = null;
    elements.recoveryPreviewDialog.close();
    renderStickerGrid();
    render();
    await renderRecoveryPoints();
    await renderStorageDiagnostics();
    showToast("Point-in-time recovery restored");
  } catch (_) { showToast("Recovery point could not be restored", 5000); }
  finally { $("#confirmRecoveryButton").disabled = false; }
});
$("#exportButton").addEventListener("click", async () => {
  const referenced = SelfChatStorageCore.referencedAttachmentIds(state);
  const imageRecords = (await getAllImages().catch(() => [])).filter(record => referenced.has(record.id));
  const images = await Promise.all(imageRecords.map(async record => ({ id: record.id, name: record.name, data: await blobToDataUrl(record.blob) })));
  const payload = { ...state, images, schemaVersion: 2, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `selfchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  localStorage.setItem("selfchat-last-export-v1", new Date().toISOString());
  renderStorageDiagnostics();
  showToast("Backup exported");
});
elements.importInput.addEventListener("change", async () => {
  const file = elements.importInput.files[0];
  if (!file) return;
  let importedImagesToRollback = [];
  let existingImageIds = new Set();
  let importCommitted = false;
  try {
    const imported = JSON.parse(await file.text());
    if (![undefined, 1, 2].includes(imported.schemaVersion) || !Array.isArray(imported.chats) || !imported.chats.length || !Array.isArray(imported.messages)) throw new Error("Invalid backup");
    const imageCount = Array.isArray(imported.images) ? imported.images.length : 0;
    if (!confirm(`Merge ${imported.chats.length} chats, ${imported.messages.length} messages, and ${imageCount} images from this backup? Existing records will be kept; matching stable IDs use the newer version.`)) return;
    await createRecoverySnapshot("Before import", state, { force: true }).catch(() => {});
    importedImagesToRollback = Array.isArray(imported.images) ? imported.images.map(image => ({ id: image.id, name: image.name || "Image", blob: dataUrlToBlob(image.data) })) : [];
    existingImageIds = new Set((await getAllImages().catch(() => [])).map(image => image.id));
    await addImages(importedImagesToRollback.filter(image => !existingImageIds.has(image.id)));
    const importedState = normalizeState({
      activeChatId: imported.activeChatId || imported.chats[0].id,
      chats: imported.chats,
      messages: imported.messages,
      customStickers: normalizeCustomStickers(imported.customStickers),
      trash: Array.isArray(imported.trash) ? imported.trash : [],
      deletedChatIds: Array.isArray(imported.deletedChatIds) ? imported.deletedChatIds : [],
      deletedMessageIds: Array.isArray(imported.deletedMessageIds) ? imported.deletedMessageIds : [],
      drafts: imported.drafts || {}
    });
    state = mergeStates([state, importedState], state);
    await saveState({ source: "backup-import" });
    importCommitted = true;
    renderStickerGrid();
    render();
    elements.settingsDialog.close();
    showToast("Backup merged");
  } catch (_) {
    if (!importCommitted) await deleteImages(importedImagesToRollback.filter(image => !existingImageIds.has(image.id)).map(image => image.id)).catch(() => {});
    showToast("That is not a valid SelfChat backup");
  } finally {
    elements.importInput.value = "";
  }
});

async function openImageViewer(messageId) {
  const loadToken = ++viewerLoadToken;
  const images = messagesFor().filter(message => message.type === "image");
  const index = images.findIndex(message => message.id === messageId);
  const message = images[index];
  if (!message) return;
  const record = await getImage(message.imageId).catch(() => null);
  if (loadToken !== viewerLoadToken || !record?.blob) return;
  if (viewerObjectUrl) URL.revokeObjectURL(viewerObjectUrl);
  viewerObjectUrl = URL.createObjectURL(record.blob);
  viewerMessageId = messageId;
  elements.imageViewerImage.src = viewerObjectUrl;
  elements.imageViewerImage.alt = message.imageName || "Image";
  elements.imageViewerTitle.textContent = message.imageName || "Image";
  elements.imageViewerTime.textContent = `${activeChat().name} · ${formatDay(message.createdAt)} at ${formatTime(message.createdAt)}`;
  elements.imageViewerCaption.textContent = message.caption || "";
  elements.imageViewerCaption.hidden = !message.caption;
  $("#previousViewerImage").disabled = index <= 0;
  $("#nextViewerImage").disabled = index < 0 || index >= images.length - 1;
  if (!elements.imageViewerDialog.open) elements.imageViewerDialog.showModal();
}

function navigateViewer(direction) {
  const images = messagesFor().filter(message => message.type === "image");
  const index = images.findIndex(message => message.id === viewerMessageId);
  const next = images[index + direction];
  if (next) openImageViewer(next.id);
}

function openMessageContextMenu(messageElement, x, y) {
  if (!messageElement) return;
  contextMessageId = messageElement.dataset.messageId;
  const selectedMessage = state.messages.find(item => item.id === contextMessageId);
  elements.contextMenu.querySelector('[data-action="copy"]').hidden = Boolean(selectedMessage?.type);
  elements.contextMenu.querySelector('[data-action="edit"]').hidden = selectedMessage?.type === "sticker";
  elements.contextMenu.querySelector('[data-action="edit"]').textContent = selectedMessage?.type === "image" ? "Edit caption" : "Edit";
  elements.contextMenu.querySelector('[data-action="move"]').textContent = selectedMessageIds.size > 1 ? `Move ${selectedMessageIds.size} messages` : "Move";
  elements.contextMenu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
  elements.contextMenu.style.top = `${Math.min(y, window.innerHeight - 190)}px`;
  elements.contextMenu.hidden = false;
  elements.contextMenu.querySelector("button:not([hidden])")?.focus();
}

elements.messageList.addEventListener("click", event => {
  const messageArticle = event.target.closest("[data-message-id]");
  if (selectedMessageIds.size && messageArticle && !event.target.closest(".message-menu-trigger")) {
    const id = messageArticle.dataset.messageId;
    if (selectedMessageIds.has(id)) selectedMessageIds.delete(id); else selectedMessageIds.add(id);
    renderMessages();
    return;
  }
  const clickedImage = event.target.closest(".message-media");
  if (clickedImage) {
    const messageElement = clickedImage.closest("[data-message-id]");
    openImageViewer(messageElement?.dataset.messageId);
    return;
  }
  const trigger = event.target.closest(".message-menu-trigger");
  if (!trigger) return;
  const message = trigger.closest("[data-message-id]");
  const rect = trigger.getBoundingClientRect();
  openMessageContextMenu(message, rect.right - 150, rect.bottom + 4);
  event.stopPropagation();
});
elements.messageList.addEventListener("contextmenu", event => {
  const message = event.target.closest("[data-message-id]");
  if (!message) return;
  event.preventDefault();
  openMessageContextMenu(message, event.clientX, event.clientY);
});
$("#closeImageViewer").addEventListener("click", () => elements.imageViewerDialog.close());
$("#previousViewerImage").addEventListener("click", event => { event.stopPropagation(); navigateViewer(-1); });
$("#nextViewerImage").addEventListener("click", event => { event.stopPropagation(); navigateViewer(1); });
elements.imageViewerDialog.addEventListener("click", event => {
  if (event.target === elements.imageViewerDialog || event.target.classList.contains("image-viewer-stage")) elements.imageViewerDialog.close();
});
elements.imageViewerDialog.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") navigateViewer(-1);
  if (event.key === "ArrowRight") navigateViewer(1);
});
elements.imageViewerDialog.addEventListener("close", () => {
  viewerLoadToken += 1;
  viewerMessageId = null;
  elements.imageViewerImage.removeAttribute("src");
  if (viewerObjectUrl) URL.revokeObjectURL(viewerObjectUrl);
  viewerObjectUrl = null;
});
document.addEventListener("click", event => {
  if (!event.target.closest("#messageContextMenu")) closeContextMenu();
});
elements.contextMenu.addEventListener("click", async event => {
  const action = event.target.dataset.action;
  const message = state.messages.find(item => item.id === contextMessageId);
  if (!action || !message) return;
  if (action === "copy") {
    if (message.type === "sticker") return;
    await navigator.clipboard.writeText(message.text || "");
    showToast("Copied");
    closeContextMenu();
  }
  if (action === "edit") {
    if (message.type === "sticker") return;
    editingMessageId = message.id;
    elements.editMessageInput.value = message.type === "image" ? message.caption || "" : message.text;
    closeContextMenu();
    elements.editDialog.showModal();
    setTimeout(() => elements.editMessageInput.focus(), 40);
  }
  if (action === "select") {
    selectedMessageIds.add(message.id);
    closeContextMenu();
    renderMessages();
    showToast("Select more messages, then choose Move");
  }
  if (action === "move") {
    const ids = selectedMessageIds.has(message.id) ? [...selectedMessageIds] : [message.id];
    closeContextMenu();
    openMoveDialog(ids);
  }
  if (action === "delete") {
    if (confirm("Move this message to Trash? You can restore it later.")) {
      await createRecoverySnapshot("Before deleting a message", state, { force: true }).catch(() => {});
      state.deletedMessageIds.push(message.id);
      state.messages = state.messages.filter(item => item.id !== message.id);
      await saveState();
      render();
      showToast("Message moved to Trash");
    }
    closeContextMenu();
  }
});
$("#cancelEditButton").addEventListener("click", () => elements.editDialog.close());
elements.editForm.addEventListener("submit", async event => {
  event.preventDefault();
  const message = state.messages.find(item => item.id === editingMessageId);
  const text = elements.editMessageInput.value.trim();
  if (!message || (!text && message.type !== "image")) return;
  message.editHistory = [...(message.editHistory || []), { text: message.type === "image" ? message.caption || "" : message.text, editedAt: message.editedAt || message.createdAt }];
  if (message.type === "image") message.caption = text;
  else message.text = text;
  message.editedAt = new Date().toISOString();
  await saveState();
  elements.editDialog.close();
  render();
});

elements.useThisTabButton.addEventListener("click", claimThisTab);
elements.closeThisTabButton.addEventListener("click", () => {
  window.close();
  setTimeout(() => {
    elements.singleTabHint.textContent = "Your browser cannot close this tab automatically. Close it from the tab bar.";
    elements.closeThisTabButton.textContent = "Close manually";
  }, 120);
});
elements.singleTabScreen.addEventListener("keydown", event => {
  if (event.key === "Escape") event.preventDefault();
  if (event.key !== "Tab") return;
  const buttons = [elements.closeThisTabButton, elements.useThisTabButton];
  const nextIndex = event.shiftKey ? buttons.indexOf(document.activeElement) - 1 : buttons.indexOf(document.activeElement) + 1;
  if (nextIndex >= 0 && nextIndex < buttons.length) return;
  event.preventDefault();
  buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (!elements.contextMenu.hidden) {
    event.preventDefault();
    closeContextMenu();
    return;
  }
  if (!elements.messageSearchPanel.hidden) {
    event.preventDefault();
    $("#closeMessageSearch").click();
    return;
  }
  if (selectedMessageIds.size) {
    event.preventDefault();
    clearMessageSelection();
  }
});
window.addEventListener("storage", event => {
  if (storageMode === "legacy" && event.key === STORAGE_KEY && event.newValue && !tabIsBlocked) {
    state = loadLegacyState();
    persistedState = structuredClone(state);
    renderStickerGrid();
    render();
    return;
  }
  if (event.key === ACTIVE_TAB_KEY && event.newValue) {
    let candidateId = null;
    try { candidateId = JSON.parse(event.newValue)?.tabId || null; } catch (_) {}
    honorCurrentTabOwner(candidateId);
  }
});
if (tabChannel) tabChannel.addEventListener("message", event => {
  if (event.data?.type === "claim" && event.data.tabId !== tabId) honorCurrentTabOwner(event.data.tabId);
});
window.addEventListener("pagehide", () => {
  clearTimeout(draftSaveTimer);
  if (!tabIsBlocked) void saveState({ snapshot: false }).catch(() => {});
  if (activeTabId() === tabId) localStorage.removeItem(ACTIVE_TAB_KEY);
  tabChannel?.close();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden" || tabIsBlocked) return;
  clearTimeout(draftSaveTimer);
  void saveState({ snapshot: false }).catch(() => {});
});

claimThisTab();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(registration => registration.update().catch(() => {}))
      .catch(error => console.error("Service worker registration failed", error));
  });
}
