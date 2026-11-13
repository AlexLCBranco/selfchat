const STORAGE_KEY = "selfchat-data-v1";
const RECOVERY_KEY = "selfchat-recovery-v1";
const ACTIVE_TAB_KEY = "selfchat-active-tab-v1";
const DRAFT_BUFFER_KEY = "selfchat-draft-buffer-v1";
const TAB_CHANNEL_NAME = "selfchat-tab-ownership-v1";
const IMAGE_DB_NAME = "selfchat-images-v1";
const IMAGE_STORE = "images";
const RECOVERY_DB_NAME = "selfchat-snapshots-v1";
const RECOVERY_STORE = "snapshots";
const MAX_RECOVERY_SNAPSHOTS = 30;
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
  chatList: $("#chatList"), activeChatAvatar: $("#activeChatAvatar"), activeChatName: $("#activeChatName"), activeChatNameInput: $("#activeChatNameInput"),
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
  settingsDialog: $("#settingsDialog"), contextMenu: $("#messageContextMenu"), toast: $("#toast"), importInput: $("#importInput"),
  recoveryList: $("#recoveryList"), recoveryStatus: $("#recoveryStatus"),
  storageDiagnostics: $("#storageDiagnostics"), recoveryPreviewDialog: $("#recoveryPreviewDialog"), recoveryPreviewSummary: $("#recoveryPreviewSummary"),
  trashDialog: $("#trashDialog"), trashList: $("#trashList"), trashCount: $("#trashCount"), emptyTrashButton: $("#emptyTrashButton"),
  moveDialog: $("#moveMessagesDialog"), moveForm: $("#moveMessagesForm"), moveTitle: $("#moveMessagesTitle"), moveDestination: $("#moveDestinationSelect"),
  imageViewerDialog: $("#imageViewerDialog"), imageViewerImage: $("#imageViewerImage"), imageViewerTitle: $("#imageViewerTitle"),
  imageViewerTime: $("#imageViewerTime"), imageViewerCaption: $("#imageViewerCaption"),
  originStatus: $("#originStatus"), persistenceStatus: $("#persistenceStatus"), automaticBackupStatus: $("#automaticBackupStatus"),
  exportStatus: $("#exportStatus"), dataStatusWarning: $("#dataStatusWarning"), automaticBackupFolderButton: $("#automaticBackupFolderButton"),
  confirmationDialog: $("#confirmationDialog"), confirmationForm: $("#confirmationForm"), confirmationTitle: $("#confirmationTitle"),
  confirmationMessage: $("#confirmationMessage"), confirmActionButton: $("#confirmActionButton"),
  replyComposerPreview: $("#replyComposerPreview"), replyComposerText: $("#replyComposerText")
};

let state = loadLegacyState();
let persistedState = structuredClone(state);
let repository = null;
let storageMode = "legacy";
let draftSaveTimer = null;
let selectedEmoji = EMOJIS[0];
let contextMessageId = null;
let selectedMessageIds = new Set();
let imageRenderToken = 0;
const imageUrlCache = new Map();
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
let lastRecoverySignature = null;
let messageSearchIndex = 0;
let focusedMessageId = null;
let recoveryPreviewSnapshot = null;
let storagePersisted = null;
let storageWarning = "";
let automaticBackupTimer = null;
let automaticBackupRunning = false;
let confirmationResolver = null;
let renamingChatId = null;
let inlineEditingMessageId = null;
let pendingReplyId = null;

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

function changedRecords(before, after, key = "id") {
  const previous = new Map(before.map(item => [item[key], item]));
  const next = new Map(after.map(item => [item[key], item]));
  return {
    put: after.filter(item => JSON.stringify(item) !== JSON.stringify(previous.get(item[key]))),
    remove: before.filter(item => !next.has(item[key])).map(item => item[key])
  };
}

function stateDiff(before, after, attachmentsPut = [], attachmentsDelete = []) {
  const chats = changedRecords(before.chats, after.chats);
  const messages = changedRecords(before.messages, after.messages);
  const stickers = changedRecords(before.customStickers, after.customStickers);
  const trash = changedRecords(before.trash || [], after.trash || []);
  const draftIds = new Set([...Object.keys(before.drafts || {}), ...Object.keys(after.drafts || {})]);
  const draftsPut = [];
  const draftsDelete = [];
  draftIds.forEach(chatId => {
    const previous = before.drafts?.[chatId] || "";
    const next = after.drafts?.[chatId] || "";
    if (previous === next) return;
    if (next) draftsPut.push({ chatId, text: next, updatedAt: new Date().toISOString() });
    else draftsDelete.push(chatId);
  });
  return {
    chatsPut: chats.put, chatsDelete: chats.remove,
    messagesPut: messages.put, messagesDelete: messages.remove,
    stickersPut: stickers.put, stickersDelete: stickers.remove,
    draftsPut, draftsDelete,
    trashPut: trash.put, trashDelete: trash.remove,
    attachmentsPut, attachmentsDelete,
    activeChatId: after.activeChatId
  };
}

function diffHasContent(diff) {
  return Object.entries(diff).some(([key, value]) => key !== "activeChatId" && Array.isArray(value) && value.length);
}

async function saveState({ significant = true, attachmentsPut = [], attachmentsDelete = [] } = {}) {
  state = normalizeState(state);
  if (repository) {
    const before = structuredClone(persistedState);
    const target = structuredClone(state);
    const diff = stateDiff(before, target, attachmentsPut, attachmentsDelete);
    try {
      if (diffHasContent(diff) || target.activeChatId !== persistedState.activeChatId) {
        await repository.commit(diff, { significant, snapshotState: before });
      }
    } catch (error) {
      state = structuredClone(persistedState);
      throw error;
    }
    persistedState = target;
  } else {
    const serialized = JSON.stringify(state);
    try { localStorage.setItem(RECOVERY_KEY, serialized); } catch (_) {}
    localStorage.setItem(STORAGE_KEY, serialized);
  }
  if (significant) queueAutomaticBackup();
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
    storageWarning = "";
    const buffers = readDraftBuffers();
    if (Object.keys(buffers).length) {
      Object.entries(buffers).forEach(([chatId, buffer]) => {
        if (state.chats.some(chat => chat.id === chatId) && typeof buffer?.text === "string") state.drafts[chatId] = buffer.text;
      });
      await saveState({ significant: false });
      Object.entries(buffers).forEach(([chatId, buffer]) => clearDraftBuffer(chatId, buffer.text));
    }
    storagePersisted = navigator.storage?.persist ? await navigator.storage.persist().catch(() => false) : false;
    await refreshDataStatus();
    await runAutomaticBackup("startup");
  } catch (error) {
    console.error("IndexedDB migration unavailable; continuing with legacy storage", error);
    repository = null;
    storageMode = "legacy";
    state = error.legacyState || loadLegacyState();
    persistedState = structuredClone(state);
    Object.entries(readDraftBuffers()).forEach(([chatId, buffer]) => {
      if (state.chats.some(chat => chat.id === chatId) && typeof buffer?.text === "string") state.drafts[chatId] = buffer.text;
    });
    storageWarning = `Unified storage migration failed: ${error.message}. v0.9.2 data remains active and will retry next time.`;
    await refreshDataStatus();
    showToast("Migration failed; your v0.9.2 data is still active", 6000);
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
  if (repository) return repository.listSnapshots();
  return withRecoveryStore("readonly", store => store.getAll());
}

async function createRecoverySnapshot(label = "Automatic recovery point", value = state, { force = false } = {}) {
  if (repository) return;
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
  if (repository) return repository.commit({ attachmentsPut: [record] }, { significant: false });
  return withImageStore("readwrite", store => store.put(record));
}

function getImage(id) {
  if (repository) return repository.getAttachment(id);
  return withImageStore("readonly", store => store.get(id));
}

function getAllImages() {
  if (repository) return repository.getAllAttachments();
  return withImageStore("readonly", store => store.getAll());
}

function deleteImages(ids) {
  if (!ids.length) return Promise.resolve();
  if (repository) return repository.commit({ attachmentsDelete: ids }, { significant: false });
  return withImageStore("readwrite", store => ids.forEach(id => store.delete(id)));
}

function addImages(records) {
  if (!records.length) return Promise.resolve();
  if (repository) return repository.commit({ attachmentsPut: records }, { significant: false });
  return withImageStore("readwrite", store => records.forEach(record => store.put(record)));
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

function formatStatusTime(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function buildBackupPayload() {
  const records = await getAllImages();
  const referenced = SelfChatStorageCore.referencedAttachmentIds(state);
  const attachments = await Promise.all(records.filter(record => referenced.has(record.id)).map(async record => ({
    id: record.id,
    name: record.name || "Attachment",
    type: record.blob?.type || "application/octet-stream",
    data: await blobToDataUrl(record.blob)
  })));
  return SelfChatStorageCore.backupPayload(state, attachments);
}

async function refreshDataStatus() {
  const originLabel = location.origin.includes("127.0.0.1") || location.origin.includes("localhost") ? "Local launcher" : "Hosted site";
  elements.originStatus.textContent = `Origin: ${originLabel} (${location.origin}) · separate dataset`;
  elements.persistenceStatus.textContent = `Storage persisted: ${storagePersisted === null ? "checking…" : storagePersisted ? "Yes" : "No"}`;
  const lastAutomaticBackup = repository ? await repository.getMeta("lastAutomaticBackup").catch(() => null) : null;
  const lastExport = repository ? await repository.getMeta("lastExport").catch(() => null) : localStorage.getItem("selfchat-last-export-v1");
  elements.automaticBackupStatus.textContent = `Automatic backup: ${formatStatusTime(lastAutomaticBackup)}`;
  elements.exportStatus.textContent = `Last export: ${formatStatusTime(lastExport)}`;
  let warning = storageWarning;
  if (!warning && !("showDirectoryPicker" in window)) warning = "Automatic folder backup is not supported by this browser.";
  if (!warning && repository) {
    const handle = await repository.getMeta("backupDirectoryHandle").catch(() => null);
    if (!handle) warning = "Choose an automatic backup folder in Data settings.";
    else {
      const permission = await handle.queryPermission?.({ mode: "readwrite" }).catch(() => "denied");
      if (permission !== "granted") warning = "Automatic backup folder permission was lost. Choose the folder again.";
    }
  }
  elements.dataStatusWarning.textContent = warning;
  elements.dataStatusWarning.hidden = !warning;
}

async function runAutomaticBackup(reason = "change") {
  if (!repository || automaticBackupRunning || !("showDirectoryPicker" in window)) return refreshDataStatus();
  const handle = await repository.getMeta("backupDirectoryHandle").catch(() => null);
  if (!handle) return refreshDataStatus();
  const permission = await handle.queryPermission?.({ mode: "readwrite" }).catch(() => "denied");
  if (permission !== "granted") return refreshDataStatus();
  const last = await repository.getMeta("lastAutomaticBackup").catch(() => null);
  if (reason === "startup" && last?.slice(0, 10) === new Date().toISOString().slice(0, 10)) return refreshDataStatus();
  automaticBackupRunning = true;
  try {
    const payload = await buildBackupPayload();
    const file = await handle.getFileHandle("SelfChat automatic backup.json", { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    await repository.setMeta("lastAutomaticBackup", new Date().toISOString());
    storageWarning = "";
  } catch (error) {
    storageWarning = `Automatic backup failed: ${error.message}`;
  } finally {
    automaticBackupRunning = false;
    await refreshDataStatus();
  }
}

function queueAutomaticBackup() {
  if (!repository) return;
  clearTimeout(automaticBackupTimer);
  automaticBackupTimer = setTimeout(() => runAutomaticBackup("change"), 1500);
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
  if (message.type === "file") return `${message.fileName || "File"} ${message.caption || ""}`.trim();
  return message.text || "";
}

function messagePlainText(message) {
  return SelfChatAppCore.messagePlainText(message, stickerFor(message)?.label || "Sticker");
}

function replyFields() {
  const original = state.messages.find(message => message.id === pendingReplyId);
  return original ? { replyToId: original.id, replyPreview: messagePlainText(original).slice(0, 240) } : {};
}

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / 1024 / 1024).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function replyQuoteHtml(message) {
  const reply = SelfChatAppCore.resolveReply(state, message, messagePlainText);
  if (!reply) return "";
  const status = reply.status === "moved" ? "Moved to another chat" : reply.status === "trashed" ? "Original is in Trash" : reply.status === "deleted" ? "Original message deleted" : "";
  return `<button class="reply-quote" type="button" data-reply-original-id="${escapeHtml(reply.id)}" data-reply-chat-id="${escapeHtml(reply.chatId || "")}" data-reply-status="${reply.status}"><strong>Reply</strong><span>${escapeHtml(reply.text || "Original message")}</span>${status ? `<small>${escapeHtml(status)}</small>` : ""}</button>`;
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

function messageArticleHtml(message, query = "", activeMatchId = null) {
  const sticker = message.type === "sticker" ? stickerFor(message) : null;
  const image = message.type === "image";
  const file = message.type === "file";
  const stickerImage = sticker?.imageId;
  const content = file
    ? `<div class="file-card"><span class="file-icon">FILE</span><span class="file-copy"><strong>${escapeHtml(message.fileName || "File")}</strong><small>${escapeHtml(formatFileSize(message.fileSize))}</small></span><span class="file-actions"><a data-file-open data-attachment-id="${escapeHtml(message.attachmentId)}" target="_blank" rel="noopener">Open</a><a data-file-download data-attachment-id="${escapeHtml(message.attachmentId)}" download="${escapeHtml(message.fileName || "download")}">Download</a></span></div>${message.caption ? `<span class="file-caption">${query ? highlightMatch(message.caption, query) : escapeHtml(message.caption)}</span>` : ""}`
    : image
    ? `<img class="message-media" data-image-id="${escapeHtml(message.imageId)}" alt="${escapeHtml(message.imageName || "Image")}" hidden><span class="image-fallback">Loading image…<small>${escapeHtml(message.imageName || "Image")}</small></span>${message.caption ? `<span class="image-caption">${query ? highlightMatch(message.caption, query) : escapeHtml(message.caption)}</span>` : ""}`
    : stickerImage
    ? `<img class="sticker-art sticker-image" data-image-id="${escapeHtml(sticker.imageId)}" alt="${escapeHtml(sticker.label)}" hidden><span class="sticker-image-fallback">Loading sticker…</span>`
    : sticker
    ? `<span class="sticker-art sticker-${sticker.tone}" role="img" aria-label="${escapeHtml(sticker.label)}"><span class="sticker-emoji">${escapeHtml(sticker.emoji)}</span>${sticker.caption ? `<span class="sticker-caption">${escapeHtml(sticker.caption)}</span>` : ""}</span>`
    : `<span class="message-text">${renderLinkedText(message.text || "", query)}</span>`;
  return `<article class="message${sticker ? " sticker-message" : image ? " image-message" : file ? " file-message" : " text-message"}${message.editedAt ? " message-edited" : ""}${selectedMessageIds.size ? " selection-mode" : ""}${selectedMessageIds.has(message.id) ? " selected" : ""}${message.id === activeMatchId ? " search-match-active" : ""}${message.id === focusedMessageId ? " flash-target" : ""}" data-message-id="${escapeHtml(message.id)}" aria-selected="${selectedMessageIds.has(message.id)}">
    <button class="message-menu-trigger" type="button" aria-label="Message options">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>
    ${replyQuoteHtml(message)}${content}
    <span class="message-meta">${message.editedAt ? "edited · " : ""}${formatTime(message.createdAt)}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 13 4 4L16 7"/><path d="m9 16 2 2L22 7"/></svg>
    </span>
  </article>`;
}

function captureScrollAnchor() {
  const stageRect = elements.messageStage.getBoundingClientRect();
  const articles = [...elements.messageList.querySelectorAll("[data-message-id]")];
  const anchor = articles.find(article => article.getBoundingClientRect().bottom > stageRect.top);
  return {
    id: anchor?.dataset.messageId || null,
    offset: anchor ? anchor.getBoundingClientRect().top - stageRect.top : 0,
    bottomDistance: elements.messageStage.scrollHeight - elements.messageStage.scrollTop - elements.messageStage.clientHeight,
    wasAtBottom: elements.messageStage.scrollHeight - elements.messageStage.scrollTop - elements.messageStage.clientHeight < 4
  };
}

function restoreScrollAnchor(anchor) {
  if (!anchor) return;
  if (anchor.wasAtBottom) return scrollToBottom();
  const article = anchor.id && elements.messageList.querySelector(`[data-message-id="${CSS.escape(anchor.id)}"]`);
  if (article) {
    const stageTop = elements.messageStage.getBoundingClientRect().top;
    elements.messageStage.scrollTop += article.getBoundingClientRect().top - stageTop - anchor.offset;
  } else {
    elements.messageStage.scrollTop = Math.max(0, elements.messageStage.scrollHeight - elements.messageStage.clientHeight - anchor.bottomDistance);
  }
}

function renderMessages({ scroll = "bottom" } = {}) {
  const savedAnchor = scroll === "preserve" ? captureScrollAnchor() : null;
  const renderToken = ++imageRenderToken;
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
    return `${divider}${messageArticleHtml(message, query, activeMatchId)}`;
  }).join("");

  hydrateImages(renderToken, activeMatchId || focusedMessageId);
  hydrateFileAttachments(renderToken);
  if (activeMatchId) requestAnimationFrame(() => scrollMessageIntoView(activeMatchId));
  else if (focusedMessageId) requestAnimationFrame(() => {
    scrollMessageIntoView(focusedMessageId);
    setTimeout(() => { focusedMessageId = null; }, 1700);
  });
  else if (scroll === "bottom" && !query) requestAnimationFrame(scrollToBottom);
  else if (savedAnchor) requestAnimationFrame(() => restoreScrollAnchor(savedAnchor));
}

function scrollMessageIntoView(messageId, behavior = "smooth") {
  elements.messageList.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.scrollIntoView({ block: "center", behavior });
}

function navigateSearch(direction) {
  const query = elements.messageSearchInput.value.trim().toLocaleLowerCase();
  const matches = messagesFor().filter(message => messageLabel(message).toLocaleLowerCase().includes(query));
  if (!matches.length) return;
  messageSearchIndex = (messageSearchIndex + direction + matches.length) % matches.length;
  renderMessages({ scroll: "target" });
}

async function hydrateImages(renderToken, anchoredMessageId = null, root = elements.messageList) {
  const images = [...root.querySelectorAll("[data-image-id]:not([src])")];
  await Promise.all(images.map(async image => {
    try {
      const anchor = captureScrollAnchor();
      let url = imageUrlCache.get(image.dataset.imageId);
      const record = url ? null : await getImage(image.dataset.imageId);
      if (renderToken !== imageRenderToken || !image.isConnected) return;
      if (!url) {
        if (!record?.blob) throw new Error("Image not found");
        url = URL.createObjectURL(record.blob);
        imageUrlCache.set(image.dataset.imageId, url);
      }
      image.addEventListener("load", () => {
        image.hidden = false;
        if (image.nextElementSibling) image.nextElementSibling.hidden = true;
        requestAnimationFrame(() => anchoredMessageId ? scrollMessageIntoView(anchoredMessageId, "auto") : restoreScrollAnchor(anchor));
      }, { once: true });
      image.addEventListener("error", () => {
        imageUrlCache.delete(image.dataset.imageId);
        URL.revokeObjectURL(url);
        if (image.nextElementSibling) image.nextElementSibling.textContent = "This image cannot be displayed";
      }, { once: true });
      image.src = url;
    } catch (_) {
      if (image.isConnected && image.nextElementSibling) image.nextElementSibling.textContent = "Image unavailable";
    }
  }));
}

async function hydrateFileAttachments(renderToken, root = elements.messageList) {
  const links = [...root.querySelectorAll("[data-attachment-id]:not([href])")];
  await Promise.all(links.map(async link => {
    try {
      let url = imageUrlCache.get(link.dataset.attachmentId);
      const record = url ? null : await getImage(link.dataset.attachmentId);
      if (renderToken !== imageRenderToken || !link.isConnected) return;
      if (!url) {
        if (!record?.blob) throw new Error("File not found");
        url = URL.createObjectURL(record.blob);
        imageUrlCache.set(link.dataset.attachmentId, url);
      }
      link.href = url;
    } catch (_) {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.title = "File unavailable";
    }
  }));
}

function updateMessageListVisibility() {
  const hasMessages = messagesFor().length > 0;
  elements.emptyState.hidden = hasMessages;
  elements.messageList.hidden = !hasMessages;
}

function refreshDayDividers() {
  elements.messageList.querySelectorAll(".day-divider").forEach(divider => divider.remove());
  let previousDate = "";
  [...elements.messageList.querySelectorAll("[data-message-id]")].forEach(article => {
    const message = state.messages.find(item => item.id === article.dataset.messageId);
    if (!message) return;
    const date = formatDay(message.createdAt);
    if (date !== previousDate) article.insertAdjacentHTML("beforebegin", `<div class="day-divider">${escapeHtml(date)}</div>`);
    previousDate = date;
  });
}

function insertMessageElement(message, { scroll = false } = {}) {
  if (message.chatId !== state.activeChatId || elements.messageList.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) return;
  const ordered = messagesFor();
  const next = ordered[ordered.findIndex(item => item.id === message.id) + 1];
  const nextArticle = next && elements.messageList.querySelector(`[data-message-id="${CSS.escape(next.id)}"]`);
  if (nextArticle) nextArticle.insertAdjacentHTML("beforebegin", messageArticleHtml(message));
  else elements.messageList.insertAdjacentHTML("beforeend", messageArticleHtml(message));
  refreshDayDividers();
  updateMessageListVisibility();
  const article = elements.messageList.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
  hydrateImages(imageRenderToken, null, article);
  hydrateFileAttachments(imageRenderToken, article);
  if (scroll) requestAnimationFrame(scrollToBottom);
}

function removeMessageElements(messageIds) {
  messageIds.forEach(id => elements.messageList.querySelector(`[data-message-id="${CSS.escape(id)}"]`)?.remove());
  refreshDayDividers();
  updateMessageListVisibility();
}

function updateSelectionUi() {
  elements.selectionBar.hidden = selectedMessageIds.size === 0;
  elements.selectionCount.textContent = `${selectedMessageIds.size} selected`;
  elements.messageList.querySelectorAll("[data-message-id]").forEach(article => {
    const selected = selectedMessageIds.has(article.dataset.messageId);
    article.classList.toggle("selection-mode", selectedMessageIds.size > 0);
    article.classList.toggle("selected", selected);
    article.setAttribute("aria-selected", String(selected));
  });
}

function cancelInlineMessageEdit() {
  if (!inlineEditingMessageId) return;
  const article = elements.messageList.querySelector(`[data-message-id="${CSS.escape(inlineEditingMessageId)}"]`);
  article?.querySelector(".inline-message-edit")?.remove();
  article?.classList.remove("inline-editing");
  inlineEditingMessageId = null;
}

function updateEditedMessageElement(message) {
  const article = elements.messageList.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
  if (!article) return;
  if (message.type === "image" || message.type === "file") {
    let caption = article.querySelector(message.type === "image" ? ".image-caption" : ".file-caption");
    if (message.caption && !caption) {
      caption = document.createElement("span");
      caption.className = message.type === "image" ? "image-caption" : "file-caption";
      article.querySelector(".message-meta")?.before(caption);
    }
    if (caption) {
      caption.textContent = message.caption || "";
      caption.hidden = !message.caption;
    }
  } else {
    const text = article.querySelector(".message-text");
    if (text) text.innerHTML = renderLinkedText(message.text || "");
  }
  const meta = article.querySelector(".message-meta");
  if (meta) meta.innerHTML = `edited · ${formatTime(message.createdAt)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 13 4 4L16 7"/><path d="m9 16 2 2L22 7"/></svg>`;
  article.classList.add("message-edited");
  updateReplyPreviews(message.id);
}

function updateReplyPreviews(originalId) {
  state.messages.filter(message => message.replyToId === originalId && message.chatId === state.activeChatId).forEach(message => {
    const article = elements.messageList.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
    if (!article) return;
    const current = article.querySelector(".reply-quote");
    const holder = document.createElement("div");
    holder.innerHTML = replyQuoteHtml(message);
    if (current && holder.firstElementChild) current.replaceWith(holder.firstElementChild);
  });
}

function cancelReply() {
  pendingReplyId = null;
  elements.replyComposerPreview.hidden = true;
  elements.replyComposerText.textContent = "";
}

function startReply(messageId) {
  const message = state.messages.find(item => item.id === messageId);
  if (!message) return;
  pendingReplyId = message.id;
  elements.replyComposerText.textContent = messagePlainText(message);
  elements.replyComposerPreview.hidden = false;
  closeContextMenu();
  elements.messageInput.focus();
}

function startInlineMessageEdit(messageId) {
  const message = state.messages.find(item => item.id === messageId);
  const article = elements.messageList.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!message || !article || message.type === "sticker") return;
  cancelInlineMessageEdit();
  const anchor = captureScrollAnchor();
  inlineEditingMessageId = messageId;
  article.classList.add("inline-editing");
  const form = document.createElement("form");
  form.className = "inline-message-edit";
  form.innerHTML = `<textarea maxlength="20000" aria-label="Edit message"></textarea><div class="inline-message-edit-actions"><button type="button">Cancel</button><button type="submit">Save</button></div>`;
  const input = form.querySelector("textarea");
  input.value = message.type === "image" || message.type === "file" ? message.caption || "" : message.text || "";
  form.querySelector('button[type="button"]').addEventListener("click", cancelInlineMessageEdit);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); cancelInlineMessageEdit(); }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text && message.type !== "image" && message.type !== "file") return;
    const previous = structuredClone(message);
    message.editHistory = [...(message.editHistory || []), { text: message.type === "image" || message.type === "file" ? message.caption || "" : message.text, editedAt: message.editedAt || message.createdAt }];
    if (message.type === "image" || message.type === "file") message.caption = text;
    else message.text = text;
    message.editedAt = new Date().toISOString();
    try {
      await saveState();
      updateEditedMessageElement(message);
      cancelInlineMessageEdit();
      renderChats();
      restoreScrollAnchor(anchor);
    } catch (_) {
      Object.assign(message, previous);
      showToast("Edit could not be saved", 5000);
    }
  });
  article.append(form);
  requestAnimationFrame(() => { restoreScrollAnchor(anchor); input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
}

function startInlineChatRename() {
  const chat = activeChat();
  if (!chat || chat.id === "unsorted") return showToast("Unsorted is permanent");
  renamingChatId = chat.id;
  elements.activeChatName.hidden = true;
  elements.activeChatNameInput.hidden = false;
  elements.activeChatNameInput.value = chat.name;
  elements.optionsDialog.close();
  elements.activeChatNameInput.focus();
  elements.activeChatNameInput.select();
}

async function finishInlineChatRename(cancel = false) {
  if (!renamingChatId) return;
  const chat = state.chats.find(item => item.id === renamingChatId);
  const nextName = elements.activeChatNameInput.value.trim().slice(0, 48);
  renamingChatId = null;
  elements.activeChatNameInput.hidden = true;
  elements.activeChatName.hidden = false;
  if (cancel || !chat || !nextName || nextName === chat.name) return;
  const previousName = chat.name;
  chat.name = nextName;
  chat.updatedAt = new Date().toISOString();
  try {
    await saveState();
    elements.activeChatName.textContent = chat.name;
    elements.emptyTitle.textContent = chat.name;
    elements.optionsChatName.textContent = chat.name;
    renderChats();
  } catch (_) {
    chat.name = previousName;
    showToast("Chat name could not be saved", 5000);
  }
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

const sendTextMessage = SelfChatAppCore.createTextSendController({
  getInput: () => elements.messageInput.value,
  setInput(value) {
    elements.messageInput.value = value;
    state.drafts[state.activeChatId] = value;
    if (!repository) setDraftBuffer(state.activeChatId, value);
    resizeComposer();
    updateComposerState();
  },
  getChatId: () => state.activeChatId,
  getExtra: replyFields,
  createId: uid,
  now: () => new Date().toISOString(),
  addOptimistic(message) {
    state.messages.push(message);
    insertMessageElement(message, { scroll: true });
    renderChats();
    elements.messageInput.focus();
  },
  async persist(message) {
    await saveState();
    if (message.replyToId === pendingReplyId) cancelReply();
    if (!repository) clearDraftBuffer(message.chatId, "");
  },
  rollback(message) {
    state.messages = state.messages.filter(item => item.id !== message.id);
    state.drafts[message.chatId] = elements.messageInput.value;
    removeMessageElements([message.id]);
    renderChats();
  },
  onFailure() {
    state.drafts[state.activeChatId] = elements.messageInput.value;
    showToast("Message not saved — your text is still here", 5000);
    elements.messageInput.focus();
  }
});

function sendMessage() {
  return sendTextMessage();
}

async function sendSticker(stickerId) {
  if (!allStickers().some(sticker => sticker.id === stickerId)) return;
  const message = { id: uid(), chatId: state.activeChatId, type: "sticker", stickerId, createdAt: new Date().toISOString(), editedAt: null, ...replyFields() };
  state.messages.push(message);
  try {
    await saveState();
  } catch (_) {
    state.messages = state.messages.filter(item => item.id !== message.id);
    return showToast("Sticker not saved", 5000);
  }
  closeStickerPanel();
  cancelReply();
  insertMessageElement(message, { scroll: true });
  renderChats();
  elements.messageInput.focus();
}

async function sendAttachments(files, caption = "") {
  const batch = SelfChatAppCore.createAttachmentBatch(files, {
    chatId: state.activeChatId, caption, reply: replyFields(), createId: uid, now: Date.now
  });
  if (!batch.messages.length) return showToast("Choose a file");
  const addedMessageIds = batch.messages.map(message => message.id);
  const addedAttachmentIds = batch.attachments.map(record => record.id);
  if (!repository) {
    try { await addImages(batch.attachments); }
    catch (_) { return showToast("Files could not be saved locally", 5000); }
  }
  state.messages.push(...batch.messages);
  state.drafts[state.activeChatId] = "";
  try {
    await saveState({ attachmentsPut: repository ? batch.attachments : [] });
  } catch (_) {
    state.messages = state.messages.filter(message => !addedMessageIds.includes(message.id));
    if (!repository) await deleteImages(addedAttachmentIds).catch(() => {});
    showToast("Files not sent — they are still ready to send", 5000);
    return;
  }
  if (!repository) clearDraftBuffer(state.activeChatId, elements.messageInput.value);
  clearPendingImages();
  elements.messageInput.value = "";
  resizeComposer();
  updateComposerState();
  closeStickerPanel();
  cancelReply();
  addedMessageIds.map(id => state.messages.find(message => message.id === id)).filter(Boolean).forEach(message => insertMessageElement(message, { scroll: true }));
  renderChats();
  elements.messageInput.focus();
  showToast(batch.messages.length === 1 ? "File sent" : `${batch.messages.length} files sent`);
}

function stageAttachments(files) {
  const attachments = [...files].filter(Boolean);
  if (!attachments.length) return showToast("Choose a file");
  attachments.forEach(file => pendingImages.push({ id: uid(), file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }));
  renderPendingImages();
  closeStickerPanel();
  elements.messageInput.focus();
}

function renderPendingImages() {
  elements.imagePreviewTray.hidden = pendingImages.length === 0;
  elements.imagePreviewTitle.textContent = pendingImages.length === 1 ? "File ready to send" : `${pendingImages.length} files ready to send`;
  elements.imagePreviewList.innerHTML = pendingImages.map(item => item.url
    ? `<div class="pending-image"><img src="${item.url}" alt="${escapeHtml(item.file.name || "Pasted image")}"><button type="button" data-remove-pending-image="${item.id}" aria-label="Remove file" title="Remove file">×</button></div>`
    : `<div class="pending-file"><strong>${escapeHtml(item.file.name || "Pasted file")}</strong><small>${escapeHtml(formatFileSize(item.file.size))}</small><button type="button" data-remove-pending-image="${item.id}" aria-label="Remove file" title="Remove file">×</button></div>`).join("");
  updateComposerState();
}

function clearPendingImages() {
  pendingImages.forEach(image => { if (image.url) URL.revokeObjectURL(image.url); });
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
    await sendAttachments(files, elements.messageInput.value.trim());
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
  cancelReply();
  state.activeChatId = id;
  elements.messageSearchInput.value = "";
  elements.messageSearchPanel.hidden = true;
  closeStickerPanel();
  selectedMessageIds.clear();
  focusedMessageId = messageId;
  await saveState({ significant: false });
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

function showToast(text, duration = 1800, action = null) {
  elements.toast.replaceChildren();
  const label = document.createElement("span");
  label.textContent = text;
  elements.toast.append(label);
  elements.toast.classList.toggle("with-action", Boolean(action));
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", async () => {
      button.disabled = true;
      clearTimeout(showToast.timer);
      await action.run();
      elements.toast.classList.remove("show", "with-action");
    }, { once: true });
    elements.toast.append(button);
  }
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show", "with-action"), duration);
}

function requestConfirmation({ title, message, confirmLabel = "Continue" }) {
  if (confirmationResolver) confirmationResolver(false);
  elements.confirmationTitle.textContent = title;
  elements.confirmationMessage.textContent = message;
  elements.confirmActionButton.textContent = confirmLabel;
  elements.confirmationDialog.showModal();
  return new Promise(resolve => { confirmationResolver = resolve; });
}

function closeContextMenu() {
  elements.contextMenu.hidden = true;
  contextMessageId = null;
}

function clearMessageSelection() {
  selectedMessageIds.clear();
  updateSelectionUi();
}

async function deleteMessagesWithUndo(messageIds) {
  const ids = [...new Set(messageIds)];
  const token = SelfChatAppCore.moveMessagesToTrash(state, ids, new Date().toISOString());
  if (!token) return;
  try {
    await saveState();
    selectedMessageIds.clear();
    removeMessageElements(ids);
    updateSelectionUi();
    renderChats();
    ids.forEach(updateReplyPreviews);
    showToast(`${token.messages.length} message${token.messages.length === 1 ? "" : "s"} moved to Trash`, 6000, {
      label: "Undo",
      run: async () => {
        try {
          const restored = SelfChatAppCore.undoMessagesToTrash(state, token);
          await saveState();
          restored.forEach(message => insertMessageElement(message));
          renderChats();
          ids.forEach(updateReplyPreviews);
          showToast(`${restored.length} message${restored.length === 1 ? "" : "s"} restored`);
        } catch (_) { showToast("Undo could not be saved", 5000); }
      }
    });
  } catch (_) { showToast("Messages could not be moved to Trash", 5000); }
}

function deleteSelectedMessages() {
  return deleteMessagesWithUndo([...selectedMessageIds]);
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
        if (message.attachmentId) imageIds.add(message.attachmentId);
      });
    } else {
      messageIds.add(item.entityId);
      if (payload.message?.imageId) imageIds.add(payload.message.imageId);
      if (payload.message?.attachmentId) imageIds.add(payload.message.attachmentId);
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
  const snapshots = await withRecoveryStore("readonly", store => store.getAll()).catch(() => []);
  await withRecoveryStore("readwrite", store => snapshots.forEach(snapshot => {
    const nextState = redactPurgedContent(snapshot.state, targets);
    store.put({ ...snapshot, state: nextState, messageCount: nextState.messages.length, chatCount: nextState.chats.length });
  }));
}

async function completePermanentPurge(items) {
  const targets = purgeTargets(items);
  await repository?.purgeEveryCopy(targets, state);
  redactLegacySources(targets);
  await redactRecoveryPoints(targets);
  const snapshots = await withRecoveryStore("readonly", store => store.getAll()).catch(() => []);
  const referenced = SelfChatStorageCore.referencedAttachmentIds(state, snapshots.map(snapshot => snapshot.state));
  const unreferenced = [...targets.imageIds].filter(id => !referenced.has(id));
  if (unreferenced.length) await withImageStore("readwrite", store => unreferenced.forEach(id => store.delete(id))).catch(() => {});
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
elements.confirmationForm.addEventListener("submit", event => {
  event.preventDefault();
  const resolve = confirmationResolver;
  confirmationResolver = null;
  elements.confirmationDialog.close();
  resolve?.(true);
});
$("#cancelConfirmationButton").addEventListener("click", () => {
  const resolve = confirmationResolver;
  confirmationResolver = null;
  elements.confirmationDialog.close();
  resolve?.(false);
});
elements.confirmationDialog.addEventListener("cancel", event => {
  event.preventDefault();
  $("#cancelConfirmationButton").click();
});
elements.messageInput.addEventListener("input", () => {
  resizeComposer();
  updateComposerState();
  state.drafts[state.activeChatId] = elements.messageInput.value;
  if (!repository) setDraftBuffer(state.activeChatId, elements.messageInput.value);
  clearTimeout(draftSaveTimer);
  const bufferedChatId = state.activeChatId;
  const bufferedText = elements.messageInput.value;
  draftSaveTimer = setTimeout(() => saveState({ significant: false }).then(() => { if (!repository) clearDraftBuffer(bufferedChatId, bufferedText); }).catch(() => showToast("Draft could not be saved", 4000)), 180);
});
elements.messageInput.addEventListener("keydown", event => {
  if (event.key === "ArrowUp" && !elements.messageInput.value && !pendingImages.length && !event.isComposing) {
    const lastEditable = [...messagesFor()].reverse().find(message => message.type !== "sticker");
    if (lastEditable) {
      event.preventDefault();
      startInlineMessageEdit(lastEditable.id);
    }
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submitComposer();
  }
});
elements.imageButton.addEventListener("click", () => elements.imageInput.click());
elements.imageInput.addEventListener("change", () => {
  stageAttachments(elements.imageInput.files);
  elements.imageInput.value = "";
});
document.addEventListener("paste", event => {
  const itemFiles = [...(event.clipboardData?.items || [])]
    .filter(item => item.kind === "file")
    .map(item => item.getAsFile())
    .filter(Boolean);
  const files = itemFiles.length ? itemFiles : [...(event.clipboardData?.files || [])];
  if (!files.length) return;
  event.preventDefault();
  if (elements.stickerDialog.open) {
    stageStickerImage(files.find(file => file.type.startsWith("image/")));
    return;
  }
  stageAttachments(files);
});
elements.imagePreviewList.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-pending-image]");
  if (!button) return;
  const image = pendingImages.find(item => item.id === button.dataset.removePendingImage);
  if (image?.url) URL.revokeObjectURL(image.url);
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
  stageAttachments(event.dataTransfer.files);
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
elements.chatFilterInput.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    elements.chatFilterInput.value = "";
    renderChats();
    elements.messageInput.focus();
  }
  if (event.key === "Enter") {
    const first = elements.chatList.querySelector("[data-chat-id], [data-search-message-id]");
    if (first) { event.preventDefault(); first.click(); }
  }
});

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
  const attachment = { id: imageId, blob: pendingStickerImage, name: pendingStickerImage.name || label };
  if (!repository) {
    try { await putImage(attachment); }
    catch (_) {
      elements.saveStickerButton.disabled = false;
      return showToast("Could not save the sticker locally");
    }
  }
  const sticker = { id: `custom-${uid()}`, imageId, label: label.slice(0, 40) };
  state.customStickers.push(sticker);
  try { await saveState({ attachmentsPut: repository ? [attachment] : [] }); } catch (_) {
    state.customStickers = state.customStickers.filter(item => item.id !== sticker.id);
    if (!repository) await deleteImages([imageId]).catch(() => {});
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
  renderMessages({ scroll: "preserve" });
  elements.messageInput.focus();
});
elements.messageSearchInput.addEventListener("input", () => { messageSearchIndex = 0; renderMessages({ scroll: "target" }); });
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
$("#renameChatButton").addEventListener("click", startInlineChatRename);
elements.activeChatNameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); finishInlineChatRename(); }
  if (event.key === "Escape") { event.preventDefault(); finishInlineChatRename(true); }
});
elements.activeChatNameInput.addEventListener("blur", () => finishInlineChatRename());
$("#deleteChatButton").addEventListener("click", async () => {
  if (state.chats.length === 1) return showToast("Keep at least one chat");
  const chat = activeChat();
  if (chat.id === "unsorted") return showToast("Unsorted is permanent");
  const deletedMessages = state.messages.filter(message => message.chatId === chat.id);
  const priorTrash = state.trash.filter(item => item.id === `chat:${chat.id}`);
  const priorDeletedChat = state.deletedChatIds.includes(chat.id);
  const priorDeletedMessages = state.deletedMessageIds.filter(id => deletedMessages.some(message => message.id === id));
  const draft = state.drafts[chat.id] || "";
  state.trash = state.trash.filter(item => item.id !== `chat:${chat.id}`);
  state.trash.push({
    id: `chat:${chat.id}`, entityType: "chat", entityId: chat.id, deletedAt: new Date().toISOString(),
    payload: { chat: structuredClone(chat), messages: structuredClone(deletedMessages), draft }
  });
  state.deletedChatIds.push(chat.id);
  state.deletedMessageIds.push(...deletedMessages.map(message => message.id));
  state.chats = state.chats.filter(item => item.id !== chat.id);
  state.messages = state.messages.filter(message => message.chatId !== chat.id);
  state.activeChatId = state.chats[0].id;
  await saveState();
  elements.optionsDialog.close();
  render();
  showToast("Chat moved to Trash", 6000, {
    label: "Undo",
    run: async () => {
      try {
        state.trash = state.trash.filter(item => item.id !== `chat:${chat.id}`);
        state.trash.push(...priorTrash);
        if (!state.chats.some(item => item.id === chat.id)) state.chats.push(chat);
        const existing = new Set(state.messages.map(message => message.id));
        state.messages.push(...deletedMessages.filter(message => !existing.has(message.id)));
        if (draft) state.drafts[chat.id] = draft;
        state.deletedChatIds = state.deletedChatIds.filter(id => id !== chat.id);
        if (priorDeletedChat) state.deletedChatIds.push(chat.id);
        const deletedIds = new Set(deletedMessages.map(message => message.id));
        state.deletedMessageIds = state.deletedMessageIds.filter(id => !deletedIds.has(id));
        state.deletedMessageIds.push(...priorDeletedMessages);
        state.activeChatId = chat.id;
        await saveState();
        elements.messageInput.value = draft;
        render();
        showToast("Chat restored");
      } catch (_) { showToast("Undo could not be saved", 5000); }
    }
  });
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
  try {
    const movedAt = new Date().toISOString();
    moving.forEach(message => { message.chatId = targetChatId; message.movedAt = movedAt; });
    await saveState();
    elements.moveDialog.close();
    selectedMessageIds.clear();
    removeMessageElements(moving.map(message => message.id));
    moving.forEach(message => updateReplyPreviews(message.id));
    updateSelectionUi();
    renderChats();
    showToast(`${moving.length} message${moving.length === 1 ? "" : "s"} moved`);
  } catch (_) { showToast("Messages could not be moved", 5000); }
});
$("#cancelMoveButton").addEventListener("click", () => elements.moveDialog.close());
elements.moveDialog.addEventListener("close", () => { selectedMessageIds.clear(); updateSelectionUi(); });
$("#moveSelectedButton").addEventListener("click", () => openMoveDialog([...selectedMessageIds]));
$("#copySelectedButton").addEventListener("click", async () => {
  const text = SelfChatAppCore.copySelectedText(state.messages, selectedMessageIds, messagePlainText);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast(`${selectedMessageIds.size} message${selectedMessageIds.size === 1 ? "" : "s"} copied`);
});
$("#deleteSelectedButton").addEventListener("click", deleteSelectedMessages);
$("#cancelSelectionButton").addEventListener("click", clearMessageSelection);
$("#cancelReplyButton").addEventListener("click", () => { cancelReply(); elements.messageInput.focus(); });

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
    ? `Keeping one recovery point per day for up to ${MAX_RECOVERY_SNAPSHOTS} days.`
    : "Your first daily recovery point will appear after the next content change.";
  elements.recoveryList.innerHTML = recent.map(snapshot => {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.createdAt));
    const counts = `${snapshot.messageCount} message${snapshot.messageCount === 1 ? "" : "s"} · ${snapshot.chatCount} chat${snapshot.chatCount === 1 ? "" : "s"}`;
    return `<div class="recovery-row"><span><strong>${escapeHtml(date)}</strong><small>${escapeHtml(counts)}</small></span><button type="button" data-restore-snapshot="${escapeHtml(snapshot.id)}">Restore</button></div>`;
  }).join("");
}

async function renderStorageDiagnostics() {
  const [estimate, images, snapshots] = await Promise.all([
    navigator.storage?.estimate?.().catch(() => null),
    getAllImages().catch(() => []),
    getRecoverySnapshots().catch(() => [])
  ]);
  const used = estimate?.usage == null ? "Unavailable" : `${(estimate.usage / 1024 / 1024).toFixed(1)} MB used`;
  const quota = estimate?.quota == null ? "" : ` of ${(estimate.quota / 1024 / 1024).toFixed(0)} MB`;
  const lastExport = repository ? await repository.getMeta("lastExport").catch(() => null) : localStorage.getItem("selfchat-last-export-v1");
  const exportText = lastExport ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastExport)) : "Never";
  elements.storageDiagnostics.textContent = `${storageMode === "indexeddb" ? "Unified IndexedDB active" : "v0.9.2 fallback active"} · ${used}${quota} · ${images.length} local attachment${images.length === 1 ? "" : "s"} · ${snapshots.length} daily recovery point${snapshots.length === 1 ? "" : "s"} · Last export: ${exportText}`;
}

$("#settingsButton").addEventListener("click", () => {
  elements.settingsDialog.showModal();
  renderTrash();
  renderRecoveryPoints();
  renderStorageDiagnostics();
});
elements.automaticBackupFolderButton.addEventListener("click", async () => {
  if (!("showDirectoryPicker" in window) || !repository) return refreshDataStatus();
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite", id: "selfchat-backups" });
    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("Folder permission was not granted");
    await repository.setMeta("backupDirectoryHandle", handle);
    storageWarning = "";
    await runAutomaticBackup("folder-selected");
    showToast("Automatic backup folder saved");
  } catch (error) {
    if (error.name !== "AbortError") {
      storageWarning = `Automatic backup folder unavailable: ${error.message}`;
      await refreshDataStatus();
    }
  }
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
    try {
      let restoredMessage = null;
      if (item.entityType === "chat") {
        if (payload.chat && !state.chats.some(chat => chat.id === payload.chat.id)) state.chats.push(payload.chat);
        (payload.messages || []).forEach(message => {
          if (!state.messages.some(candidate => candidate.id === message.id)) state.messages.push(message);
        });
        if (payload.draft) state.drafts[item.entityId] = payload.draft;
        state.deletedChatIds = state.deletedChatIds.filter(id => id !== item.entityId);
        state.deletedMessageIds = state.deletedMessageIds.filter(id => !(payload.messages || []).some(message => message.id === id));
      } else if (payload.message) {
        const originalChatId = payload.originalChatId || payload.message.chatId;
        const targetChatId = state.chats.some(chat => chat.id === originalChatId) ? originalChatId : "unsorted";
        const restored = { ...payload.message, chatId: targetChatId, movedAt: targetChatId === payload.message.chatId ? payload.message.movedAt : new Date().toISOString() };
        state.messages = state.messages.filter(message => message.id !== item.entityId);
        state.messages.push(restored);
        restoredMessage = restored;
        state.deletedMessageIds = state.deletedMessageIds.filter(id => id !== item.entityId);
      }
      state.trash = state.trash.filter(candidate => candidate.id !== item.id);
      await saveState();
      if (restoredMessage) insertMessageElement(restoredMessage);
      updateReplyPreviews(item.entityId);
      renderChats(); renderTrash();
      showToast(item.entityType === "chat" ? "Chat restored" : "Message restored");
    } catch (_) { showToast("Item could not be restored", 5000); }
    return;
  }
  if (!await requestConfirmation({
    title: "Delete permanently?",
    message: `Erase “${trashLabel(item).slice(0, 80)}” from this browser? This removes it from Trash, daily recovery points, migration backups, and unreferenced local attachment storage. This cannot be undone.`,
    confirmLabel: "Delete permanently"
  })) return;
  try {
    state.trash = state.trash.filter(candidate => candidate.id !== item.id);
    await saveState();
    await completePermanentPurge([item]);
    updateReplyPreviews(item.entityId);
    renderTrash();
    await renderRecoveryPoints();
    await renderStorageDiagnostics();
    showToast("Erased from this browser");
  } catch (_) { showToast("Item could not be permanently deleted", 5000); }
});
elements.emptyTrashButton.addEventListener("click", async () => {
  if (!state.trash.length || !await requestConfirmation({
    title: "Empty Trash permanently?",
    message: "Erase every Trash item from this browser? This also removes matching recovery, migration, history, and unreferenced image data. This cannot be undone.",
    confirmLabel: "Empty Trash"
  })) return;
  const items = structuredClone(state.trash);
  try {
    state.trash = [];
    await saveState();
    await completePermanentPurge(items);
    items.forEach(item => updateReplyPreviews(item.entityId));
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
  if (repository) await repository.commit({ activeChatId: state.activeChatId }, { significant: true, snapshotState: state }).catch(() => {});
  else await createRecoverySnapshot("Before restore", state, { force: true }).catch(() => {});
  try {
    const target = normalizeState(snapshot.state);
    if (repository) {
      await repository.replaceState(target);
      state = target;
      persistedState = structuredClone(state);
    } else {
      state = target;
      await saveState({ significant: false });
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
  const payload = await buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `selfchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  const exportedAt = new Date().toISOString();
  if (repository) await repository.setMeta("lastExport", exportedAt);
  else localStorage.setItem("selfchat-last-export-v1", exportedAt);
  renderStorageDiagnostics();
  await refreshDataStatus();
  showToast("Backup exported");
});
elements.importInput.addEventListener("change", async () => {
  const file = elements.importInput.files[0];
  if (!file) return;
  let importedImagesToRollback = [];
  let existingImageIds = new Set();
  let importCommitted = false;
  try {
    const parsed = SelfChatStorageCore.parseBackup(JSON.parse(await file.text()), DEFAULT_STATE);
    const imported = parsed.state;
    const imageCount = parsed.attachments.length;
    if (!await requestConfirmation({
      title: "Import this backup?",
      message: `Merge ${imported.chats.length} chats, ${imported.messages.length} messages, and ${imageCount} attachments? Existing records will be kept; matching stable IDs use the newer version.`,
      confirmLabel: "Import backup"
    })) return;
    importedImagesToRollback = parsed.attachments.map(image => ({ id: image.id, name: image.name || "Attachment", blob: dataUrlToBlob(image.data) }));
    existingImageIds = new Set((await getAllImages().catch(() => [])).map(image => image.id));
    const newAttachments = importedImagesToRollback.filter(image => !existingImageIds.has(image.id));
    if (!repository) await addImages(newAttachments);
    state = mergeStates([state, imported], state);
    await saveState({ attachmentsPut: repository ? newAttachments : [] });
    importCommitted = true;
    renderStickerGrid();
    render();
    elements.settingsDialog.close();
    showToast("Backup merged");
  } catch (_) {
    if (!repository && !importCommitted) await deleteImages(importedImagesToRollback.filter(image => !existingImageIds.has(image.id)).map(image => image.id)).catch(() => {});
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
  elements.contextMenu.querySelector('[data-action="copy"]').hidden = false;
  elements.contextMenu.querySelector('[data-action="edit"]').hidden = selectedMessage?.type === "sticker";
  elements.contextMenu.querySelector('[data-action="edit"]').textContent = selectedMessage?.type === "image" || selectedMessage?.type === "file" ? "Edit caption" : "Edit";
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
    updateSelectionUi();
    return;
  }
  const replyQuote = event.target.closest(".reply-quote");
  if (replyQuote) {
    const status = replyQuote.dataset.replyStatus;
    if (status === "available") scrollMessageIntoView(replyQuote.dataset.replyOriginalId);
    else if (status === "moved" && replyQuote.dataset.replyChatId) selectChat(replyQuote.dataset.replyChatId, replyQuote.dataset.replyOriginalId);
    else showToast(status === "trashed" ? "Original message is in Trash" : "Original message was permanently deleted");
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
  if (action === "reply") startReply(message.id);
  if (action === "copy") {
    await navigator.clipboard.writeText(messagePlainText(message));
    showToast("Copied");
    closeContextMenu();
  }
  if (action === "edit") {
    if (message.type === "sticker") return;
    closeContextMenu();
    startInlineMessageEdit(message.id);
  }
  if (action === "select") {
    selectedMessageIds.add(message.id);
    closeContextMenu();
    updateSelectionUi();
    showToast("Select more messages, then choose an action");
  }
  if (action === "move") {
    const ids = selectedMessageIds.has(message.id) ? [...selectedMessageIds] : [message.id];
    closeContextMenu();
    openMoveDialog(ids);
  }
  if (action === "delete") {
    closeContextMenu();
    await deleteMessagesWithUndo([message.id]);
  }
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    elements.chatFilterInput.focus();
    elements.chatFilterInput.select();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    $("#messageSearchButton").click();
    return;
  }
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
  if (pendingReplyId) {
    event.preventDefault();
    cancelReply();
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
  if (!tabIsBlocked) void saveState({ significant: false }).catch(() => {});
  if (activeTabId() === tabId) localStorage.removeItem(ACTIVE_TAB_KEY);
  tabChannel?.close();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden" || tabIsBlocked) return;
  clearTimeout(draftSaveTimer);
  void saveState({ significant: false }).catch(() => {});
});

claimThisTab();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(registration => registration.update().catch(() => {}))
      .catch(error => console.error("Service worker registration failed", error));
  });
}
