const ACTIVE_CHAT_KEY = "selfchat-active-chat-v1";
const SPLIT_VIEW_KEY = "selfchat-split-view-v1";
const GLOBAL_VIEW_KEY = "selfchat-global-view-v1";
const LAST_EXPORT_KEY = "selfchat-last-export-v1";
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
// Built-in default chats are created by the server only on a verified first run.
const EMPTY_STATE = { chats: [], messages: [], customStickers: [], trash: [], deletedChatIds: [], deletedMessageIds: [], drafts: {} };

const $ = selector => document.querySelector(selector);
const elements = {
  app: $("#app"), storageScreen: $("#storageScreen"), storageScreenTitle: $("#storageScreenTitle"), storageScreenMessage: $("#storageScreenMessage"),
  storageScreenPath: $("#storageScreenPath"), storageRetryButton: $("#storageRetryButton"),
  chatList: $("#chatList"), activeChatAvatar: $("#activeChatAvatar"), activeChatName: $("#activeChatName"), activeChatNameInput: $("#activeChatNameInput"),
  conversationSubtitle: $("#conversationSubtitle"), messageSearchButton: $("#messageSearchButton"), chatMenuButton: $("#chatMenuButton"), keyboardHint: $("#keyboardHint"),
  globalVisibilityButton: $("#globalVisibilityButton"), globalVisibilityDialog: $("#globalVisibilityDialog"), globalVisibilityList: $("#globalVisibilityList"),
  emptyAvatar: $("#emptyAvatar"), emptyTitle: $("#emptyTitle"), emptyDescription: $("#emptyDescription"), emptyHint: $("#emptyHint"), emptyState: $("#emptyState"), messageList: $("#messageList"),
  messageMarquee: $("#messageMarquee"),
  messageStage: $("#messageStage"), composer: $("#composer"), messageInput: $("#messageInput"), sendButton: $("#sendButton"),
  chatNotesButton: $("#chatNotesButton"), chatNotesDialog: $("#chatNotesDialog"), chatNotesForm: $("#chatNotesForm"),
  chatNotesTitle: $("#chatNotesTitle"), chatNotesInput: $("#chatNotesInput"), chatNotesCharacterCount: $("#chatNotesCharacterCount"),
  splitViewButton: $("#splitViewButton"), splitConversation: $("#splitConversation"), splitChatAvatar: $("#splitChatAvatar"),
  splitChatSelect: $("#splitChatSelect"), splitMessageStage: $("#splitMessageStage"), splitMessageList: $("#splitMessageList"),
  splitEmptyState: $("#splitEmptyState"), splitEmptyAvatar: $("#splitEmptyAvatar"), splitEmptyTitle: $("#splitEmptyTitle"),
  imageButton: $("#imageButton"), imageInput: $("#imageInput"), dropOverlay: $("#dropOverlay"),
  imagePreviewTray: $("#imagePreviewTray"), imagePreviewList: $("#imagePreviewList"), imagePreviewTitle: $("#imagePreviewTitle"),
  stickerButton: $("#stickerButton"), stickerPanel: $("#stickerPanel"), stickerGrid: $("#stickerGrid"),
  stickerDialog: $("#stickerDialog"), stickerForm: $("#stickerForm"), stickerImageInput: $("#stickerImageInput"),
  stickerImageDropzone: $("#stickerImageDropzone"), stickerImagePreview: $("#stickerImagePreview"),
  stickerImagePlaceholder: $("#stickerImagePlaceholder"), stickerImageChange: $("#stickerImageChange"),
  stickerNameInput: $("#stickerNameInput"), saveStickerButton: $("#saveStickerButton"),
  chatFilterInput: $("#chatFilterInput"), messageSearchPanel: $("#messageSearchPanel"), messageSearchInput: $("#messageSearchInput"),
  searchResultCount: $("#searchResultCount"), previousSearchResult: $("#previousSearchResult"), nextSearchResult: $("#nextSearchResult"),
  messageTypeFilter: $("#messageTypeFilter"), messageDateFrom: $("#messageDateFrom"), messageDateTo: $("#messageDateTo"),
  messageTagFilter: $("#messageTagFilter"),
  pinnedMessageBanner: $("#pinnedMessageBanner"), pinnedMessageLabel: $("#pinnedMessageLabel"), pinnedMessageText: $("#pinnedMessageText"),
  pinnedMessageCount: $("#pinnedMessageCount"), starredMessagesDialog: $("#starredMessagesDialog"), starredMessagesList: $("#starredMessagesList"),
  mediaGalleryDialog: $("#mediaGalleryDialog"), mediaGalleryTabs: $("#mediaGalleryTabs"), mediaGalleryContent: $("#mediaGalleryContent"),
  messageTitleDialog: $("#messageTitleDialog"), messageTitleForm: $("#messageTitleForm"), messageTitleInput: $("#messageTitleInput"),
  messageTagsDialog: $("#messageTagsDialog"), messageTagsForm: $("#messageTagsForm"), messageTagsInput: $("#messageTagsInput"),
  selectionBar: $("#selectionBar"), selectionCount: $("#selectionCount"),
  chatDialog: $("#chatDialog"), chatForm: $("#chatForm"), chatNameInput: $("#chatNameInput"),
  emojiPicker: $("#emojiPicker"), optionsDialog: $("#chatOptionsDialog"), optionsChatName: $("#optionsChatName"),
  newChatAvatarInput: $("#newChatAvatarInput"), newChatAvatarPreview: $("#newChatAvatarPreview"),
  removeNewChatAvatarButton: $("#removeNewChatAvatarButton"), avatarDialog: $("#avatarDialog"), avatarForm: $("#avatarForm"),
  avatarEmojiPicker: $("#avatarEmojiPicker"), avatarEditorPreview: $("#avatarEditorPreview"), avatarImageInput: $("#avatarImageInput"),
  removeAvatarImageButton: $("#removeAvatarImageButton"),
  settingsDialog: $("#settingsDialog"), contextMenu: $("#messageContextMenu"), chatContextMenu: $("#chatContextMenu"), toast: $("#toast"), importInput: $("#importInput"),
  recoveryList: $("#recoveryList"), recoveryStatus: $("#recoveryStatus"),
  storageDiagnostics: $("#storageDiagnostics"), recoveryPreviewDialog: $("#recoveryPreviewDialog"), recoveryPreviewSummary: $("#recoveryPreviewSummary"),
  trashDialog: $("#trashDialog"), trashList: $("#trashList"), trashCount: $("#trashCount"), emptyTrashButton: $("#emptyTrashButton"),
  moveDialog: $("#moveMessagesDialog"), moveForm: $("#moveMessagesForm"), moveTitle: $("#moveMessagesTitle"), moveDestination: $("#moveDestinationSelect"), confirmMoveButton: $("#confirmMoveButton"),
  imageViewerDialog: $("#imageViewerDialog"), imageViewerImage: $("#imageViewerImage"), imageViewerTitle: $("#imageViewerTitle"),
  imageViewerTime: $("#imageViewerTime"), imageViewerCaption: $("#imageViewerCaption"),
  dataFolderStatus: $("#dataFolderStatus"), integrityStatus: $("#integrityStatus"), messageCountStatus: $("#messageCountStatus"),
  backupStatus: $("#backupStatus"), dataStatusWarning: $("#dataStatusWarning"), backupFolderButton: $("#backupFolderButton"),
  backupFolderDialog: $("#backupFolderDialog"), backupFolderForm: $("#backupFolderForm"), backupFolderInput: $("#backupFolderInput"), backupFolderError: $("#backupFolderError"),
  offlineAppStatus: $("#offlineAppStatus"), installAppButton: $("#installAppButton"), installAppHelp: $("#installAppHelp"),
  confirmationDialog: $("#confirmationDialog"), confirmationForm: $("#confirmationForm"), confirmationTitle: $("#confirmationTitle"),
  confirmationMessage: $("#confirmationMessage"), confirmActionButton: $("#confirmActionButton"),
  replyComposerPreview: $("#replyComposerPreview"), replyComposerText: $("#replyComposerText")
};

let state = structuredClone(EMPTY_STATE);
let persistedState = structuredClone(EMPTY_STATE);
let serverSeq = 0;
let serverStatus = null;
let serverReachable = true;
let eventSource = null;
let eventsWereLost = false;
let appBlocked = true;
let commitQueue = Promise.resolve();
let seqWaiters = [];
const pendingRecords = new Map();
const pendingDeletes = { chats: new Set(), messages: new Set(), customStickers: new Set(), trash: new Set() };
let draftSaveTimer = null;
let selectedEmoji = EMOJIS[0];
let contextMessageId = null;
let contextChatId = null;
let draggingChatId = null;
let suppressChatClick = false;
let selectedMessageIds = new Set();
let selectedImageIds = new Set();
let marqueeSelection = null;
let selectionAnchorMessageId = null;
let messageDrag = null;
let suppressMessageClick = false;
let deferredInstallPrompt = null;
let pendingMoveMessageIds = [];
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
let messageSearchIndex = 0;
let focusedMessageId = null;
let recoveryPreviewSnapshot = null;
let confirmationResolver = null;
let renamingChatId = null;
let inlineEditingMessageId = null;
let pendingReplyId = null;
let pinnedMessageIndex = 0;
let galleryTab = "image";
const expandedMessageIds = new Set();
let metadataMessageId = null;
let notesChatId = null;
let splitChatId = null;
let globalViewOpen = localStorage.getItem(GLOBAL_VIEW_KEY) === "true";
let hiddenGlobalChatIds = new Set();
let pendingNewChatAvatar = null;
let pendingNewChatAvatarUrl = null;
let avatarDraft = null;
let avatarDraftUrl = null;

// ---- Server-backed storage -------------------------------------------------
// The local SelfChat server is the only writer. The browser keeps no authoritative copy:
// `persistedState` mirrors what the server has acknowledged, `state` is what is on screen.
// A change counts as saved only after the server has written it to disk and replied.

function normalizeState(value) {
  const normalized = SelfChatStorageCore.normalizeState(value, EMPTY_STATE);
  normalized.chats = Array.isArray(normalized.chats) ? normalized.chats : [];
  normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
  normalized.customStickers = normalizeCustomStickers(normalized.customStickers);
  normalized.trash = Array.isArray(normalized.trash) ? normalized.trash : [];
  normalized.deletedChatIds = Array.isArray(normalized.deletedChatIds) ? normalized.deletedChatIds.filter(id => typeof id === "string") : [];
  normalized.deletedMessageIds = Array.isArray(normalized.deletedMessageIds) ? normalized.deletedMessageIds.filter(id => typeof id === "string") : [];
  normalized.drafts = normalized.drafts && typeof normalized.drafts === "object" ? normalized.drafts : {};
  return normalized;
}

function normalizeGlobalHiddenChatIds(value) {
  const activeIds = new Set(state.chats.map(chat => chat.id));
  const candidates = Array.isArray(value) ? value : value instanceof Set ? [...value] : [];
  return new Set(candidates.filter(id => typeof id === "string" && activeIds.has(id)));
}

function rememberActiveChat() {
  if (state.activeChatId) localStorage.setItem(ACTIVE_CHAT_KEY, state.activeChatId);
}

function attachmentIndex() {
  return persistedState.attachments || {};
}

async function api(path, { method = "GET", body, headers = {}, keepalive = false } = {}) {
  const isJson = body !== undefined && !(body instanceof Blob) && typeof body !== "string";
  let response;
  try {
    response = await fetch(path, {
      method,
      cache: "no-store",
      keepalive,
      headers: { ...(method === "GET" ? {} : { "X-SelfChat": "1" }), ...(isJson ? { "Content-Type": "application/json" } : {}), ...headers },
      body: isJson ? JSON.stringify(body) : body
    });
  } catch (_) {
    setServerReachable(false);
    const error = new Error("The SelfChat server is not reachable. Nothing was saved.");
    error.code = "UNREACHABLE";
    throw error;
  }
  setServerReachable(true);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || `SelfChat server error ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code || null;
    throw error;
  }
  return data;
}

function setServerReachable(reachable) {
  if (serverReachable === reachable) return;
  serverReachable = reachable;
  renderDataStatus();
  if (!reachable) showToast("SelfChat server is not reachable — changes are not being saved", 6000);
}

function applyRecordToState(target, record) {
  SelfChatStoreCore.applyOpsToState(target, record.ops);
}

function acceptRecord(record) {
  if (!record || record.seq <= serverSeq) return;
  pendingRecords.set(record.seq, record);
  let remoteChange = false;
  while (pendingRecords.has(serverSeq + 1)) {
    const next = pendingRecords.get(serverSeq + 1);
    pendingRecords.delete(next.seq);
    applyRecordToState(persistedState, next);
    if (next.origin !== tabId) {
      applyRecordToState(state, next);
      remoteChange = true;
    }
    serverSeq = next.seq;
    if (serverStatus) {
      serverStatus.seq = serverSeq;
      serverStatus.integrity.records = serverSeq;
    }
  }
  seqWaiters = seqWaiters.filter(waiter => {
    if (serverSeq < waiter.seq) return true;
    waiter.resolve();
    return false;
  });
  if (pendingRecords.size) scheduleGapFill();
  if (remoteChange) scheduleRemoteRender();
  renderDataStatus();
}

function waitForSeq(seq) {
  if (serverSeq >= seq) return Promise.resolve();
  scheduleGapFill();
  return new Promise(resolve => seqWaiters.push({ seq, resolve }));
}

let gapFillTimer = null;
function scheduleGapFill() {
  if (gapFillTimer) return;
  gapFillTimer = setTimeout(async () => {
    gapFillTimer = null;
    try {
      const { records } = await api(`/api/records?after=${serverSeq}`);
      records.forEach(acceptRecord);
    } catch (_) {}
  }, 400);
}

let remoteRenderQueued = false;
function scheduleRemoteRender() {
  if (remoteRenderQueued) return;
  remoteRenderQueued = true;
  requestAnimationFrame(() => {
    remoteRenderQueued = false;
    state = normalizeState(state);
    hiddenGlobalChatIds = normalizeGlobalHiddenChatIds(persistedState.meta?.globalHiddenChatIds || []);
    if (!state.chats.some(chat => chat.id === state.activeChatId)) state.activeChatId = state.chats[0]?.id;
    renderStickerGrid();
    renderChats();
    if (globalViewOpen) renderGlobalConversation({ scroll: false });
    else if (!inlineEditingMessageId) {
      renderMessages({ scroll: "preserve" });
      renderPinnedMessageBanner();
      updateSavedMessageCount();
      updateMediaGalleryCount();
      renderSplitConversation();
    }
    if (elements.trashDialog.open) renderTrash();
  });
}

function connectEvents() {
  eventSource?.close();
  eventSource = new EventSource(`/api/events?after=${serverSeq}`);
  eventSource.onmessage = event => {
    try { acceptRecord(JSON.parse(event.data)); } catch (_) {}
  };
  eventSource.onerror = () => {
    eventsWereLost = true;
    setServerReachable(false);
  };
  eventSource.onopen = async () => {
    setServerReachable(true);
    if (!eventsWereLost) return;
    eventsWereLost = false;
    const status = await api("/api/status").catch(() => null);
    if (status && (!status.ok || status.seq < serverSeq || status.dataDir !== serverStatus?.dataDir)) location.reload();
    else if (status) { serverStatus = status; renderDataStatus(); }
  };
}

function rollbackToPersisted() {
  const activeChatId = state.activeChatId;
  state = normalizeState(structuredClone(persistedState));
  if (state.chats.some(chat => chat.id === activeChatId)) state.activeChatId = activeChatId;
  Object.values(pendingDeletes).forEach(ids => ids.clear());
  requestAnimationFrame(() => {
    renderStickerGrid();
    render();
  });
}

// Saves the difference between the screen and the server as explicit operations.
// Records that disappeared are deleted only if the calling user action declared them.
function saveState({ deletes = {}, label = null } = {}) {
  Object.entries(deletes).forEach(([store, ids]) => (ids || []).forEach(id => pendingDeletes[store]?.add(id)));
  const run = commitQueue.then(() => commitChanges(label));
  commitQueue = run.catch(() => {});
  return run;
}

async function commitChanges(label) {
  state = normalizeState(state);
  rememberActiveChat();
  let ops;
  try {
    ops = SelfChatStoreCore.operationsForChange(persistedState, state, pendingDeletes);
  } catch (error) {
    console.error(error);
    rollbackToPersisted();
    throw error;
  }
  if (!ops.length) return null;
  try {
    const { record } = await api("/api/commit", { method: "POST", body: { ops, origin: tabId, ...(label ? { label } : {}) } });
    acceptRecord(record);
    ops.filter(op => op.op === "delete").forEach(op => pendingDeletes[op.store]?.delete(op.id));
    return record;
  } catch (error) {
    rollbackToPersisted();
    throw error;
  }
}

async function persistGlobalVisibility() {
  hiddenGlobalChatIds = normalizeGlobalHiddenChatIds(hiddenGlobalChatIds);
  const value = [...hiddenGlobalChatIds];
  if (JSON.stringify(value) === JSON.stringify(persistedState.meta?.globalHiddenChatIds || [])) return;
  const { record } = await api("/api/commit", { method: "POST", body: { ops: [{ op: "meta", key: "globalHiddenChatIds", value }], origin: tabId } });
  acceptRecord(record);
}

function flushDraftsOnExit() {
  clearTimeout(draftSaveTimer);
  if (appBlocked) return;
  let ops = [];
  try { ops = SelfChatStoreCore.operationsForChange(persistedState, normalizeState(state), pendingDeletes).filter(op => op.op === "draft"); } catch (_) {}
  if (!ops.length) return;
  void api("/api/commit", { method: "POST", body: { ops, origin: tabId }, keepalive: true }).catch(() => {});
}

// Attachments are written and verified on disk before any message refers to them.
async function uploadAttachment(record) {
  const blob = record.blob;
  const params = new URLSearchParams({ id: record.id, name: record.name || "", type: blob?.type || "", origin: tabId });
  const result = await api(`/api/attachments?${params}`, { method: "POST", body: blob, headers: { "Content-Type": blob?.type || "application/octet-stream" } });
  if (result.record) acceptRecord(result.record);
  return result.attachment;
}

async function getImage(id) {
  const response = await fetch(`/api/attachments/${encodeURIComponent(id)}`);
  if (!response.ok) return null;
  return { id, name: attachmentIndex()[id]?.name || "Attachment", blob: await response.blob() };
}

function getRecoverySnapshots() {
  return api("/api/recovery-points").then(result => result.points);
}

function showStorageScreen({ title, message = "", path = "", retry = false }) {
  appBlocked = true;
  closeOpenUi();
  elements.app.inert = true;
  elements.storageScreenTitle.textContent = title;
  elements.storageScreenMessage.textContent = message;
  elements.storageScreenMessage.hidden = !message;
  elements.storageScreenPath.textContent = path ? `Data folder: ${path}` : "";
  elements.storageRetryButton.hidden = !retry;
  elements.storageScreen.hidden = false;
}

function hideStorageScreen() {
  elements.storageScreen.hidden = true;
  elements.app.hidden = false;
  elements.app.inert = false;
  appBlocked = false;
}

function closeOpenUi() {
  document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
  elements.dropOverlay.hidden = true;
  closeStickerPanel();
  closeContextMenu();
}

// Loads everything from the server. Never substitutes an empty or default state:
// if the data cannot be read, a blocking screen explains why.
async function loadFromServer() {
  let response;
  try {
    response = await fetch("/api/state", { cache: "no-store" });
  } catch (_) {
    showStorageScreen({ title: "SelfChat is not running", message: "The SelfChat server on this PC is not reachable, so your chats cannot be shown. Start it with “Start SelfChat.cmd”, then try again.", retry: true });
    return false;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.state) {
    const error = body?.error || {};
    showStorageScreen({
      title: "Your SelfChat data could not be opened",
      message: `${error.message || `The server answered with an error (${response.status}).`} Nothing has been changed. SelfChat will not show an empty chat list while your data folder has a problem.`,
      path: error.dataDir || body?.status?.dataDir || "",
      retry: true
    });
    return false;
  }
  persistedState = normalizeState(body.state);
  persistedState.meta = body.state.meta || {};
  persistedState.attachments = body.state.attachments || {};
  state = normalizeState(structuredClone(body.state));
  delete state.meta;
  delete state.attachments;
  const rememberedChatId = localStorage.getItem(ACTIVE_CHAT_KEY);
  if (state.chats.some(chat => chat.id === rememberedChatId)) state.activeChatId = rememberedChatId;
  persistedState.activeChatId = state.activeChatId;
  serverSeq = body.seq;
  serverStatus = body.status;
  hiddenGlobalChatIds = normalizeGlobalHiddenChatIds(persistedState.meta.globalHiddenChatIds || []);
  connectEvents();
  hideStorageScreen();
  renderDataStatus();
  if (serverStatus.firstRun) showToast(`New data folder created: ${serverStatus.dataDir}`, 8000);
  return true;
}

async function refreshServerStatus() {
  try {
    serverStatus = await api("/api/status");
  } catch (_) {}
  renderDataStatus();
}


async function clipboardImageBlob(blob) {
  if (!blob?.type?.startsWith("image/")) throw new Error("Image data is unavailable");
  const type = blob.type.toLowerCase();
  if (type === "image/png") return blob;
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Image could not be decoded"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error("Image could not be prepared")),
      "image/png"
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function copyImageToClipboard(imageId) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Image clipboard is unavailable");
  const record = await getImage(imageId);
  const blob = await clipboardImageBlob(record?.blob);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

function selectionCount() {
  return selectedMessageIds.size + selectedImageIds.size;
}

function hasSelection() {
  return selectionCount() > 0;
}

function selectionKeys() {
  return new Set([
    ...[...selectedMessageIds].map(id => `message:${id}`),
    ...[...selectedImageIds].map(id => `image:${id}`)
  ]);
}

function setSelectionKeys(keys) {
  selectedMessageIds = new Set();
  selectedImageIds = new Set();
  keys.forEach(key => {
    const separator = key.indexOf(":");
    const kind = key.slice(0, separator);
    const id = key.slice(separator + 1);
    if (kind === "message") selectedMessageIds.add(id);
    if (kind === "image") selectedImageIds.add(id);
  });
}

function selectedActionMessageIds() {
  const ids = new Set(selectedMessageIds);
  selectedImageIds.forEach(imageId => {
    const message = state.messages.find(item => item.imageId === imageId || item.images?.some(image => image.id === imageId || image.imageId === imageId));
    if (message) ids.add(message.id);
  });
  return [...ids];
}

function visibleMessageIds() {
  return [...elements.messageList.querySelectorAll("[data-message-id]")].map(article => article.dataset.messageId);
}

function selectMessageFromClick(messageId, event) {
  const ids = visibleMessageIds();
  if (!ids.includes(messageId)) return;
  if (event.shiftKey && selectionAnchorMessageId && ids.includes(selectionAnchorMessageId)) {
    const start = ids.indexOf(selectionAnchorMessageId);
    const end = ids.indexOf(messageId);
    if (!event.ctrlKey && !event.metaKey) {
      selectedMessageIds.clear();
      selectedImageIds.clear();
    }
    ids.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(id => selectedMessageIds.add(id));
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedMessageIds.has(messageId)) selectedMessageIds.delete(messageId); else selectedMessageIds.add(messageId);
    selectionAnchorMessageId = messageId;
  } else {
    selectedMessageIds = new Set([messageId]);
    selectedImageIds.clear();
    selectionAnchorMessageId = messageId;
  }
  updateSelectionUi();
}

async function createAvatarAttachment(file) {
  const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
  if (!file || !supportedTypes.has(file.type)) throw new Error("Choose a PNG, JPEG, WebP, GIF, or AVIF image");
  const bitmap = await createImageBitmap(file);
  try {
    const size = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.max(0, (bitmap.width - size) / 2);
    const sourceY = Math.max(0, (bitmap.height - size) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    canvas.getContext("2d").drawImage(bitmap, sourceX, sourceY, size, size, 0, 0, 256, 256);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image could not be prepared")), "image/webp", .86));
    return { id: uid(), name: `${(file.name || "chat-icon").replace(/\.[^.]+$/, "")}.webp`, blob };
  } finally {
    bitmap.close();
  }
}

function formatStatusTime(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function renderDataStatus() {
  const status = serverStatus;
  if (!status) return;
  const messageCount = (persistedState.messages || []).length;
  elements.dataFolderStatus.textContent = `Data folder: ${status.dataDir}`;
  elements.dataFolderStatus.title = status.dataDir;
  elements.integrityStatus.textContent = `Integrity check: ${status.integrity?.ok ? "passed" : "failed"} · ${serverSeq} log record${serverSeq === 1 ? "" : "s"}`;
  elements.messageCountStatus.textContent = `Messages: ${messageCount.toLocaleString()}`;
  const backup = status.lastBackup;
  elements.backupStatus.textContent = `Last backup: ${backup ? `${formatStatusTime(backup.at)}${backup.verified ? " · verified" : backup.fromDisk ? "" : " · NOT verified"}` : "Never"}`;
  elements.backupStatus.title = backup?.file || status.backupDir || "";
  const warnings = [];
  if (!serverReachable) warnings.push("SelfChat server is not reachable. New changes are not being saved.");
  if (status.firstRun) warnings.push(`A new empty data folder was created at ${status.dataDir}.`);
  if (status.integrity?.repair) warnings.push(`An interrupted write was set aside on startup (${status.integrity.repair.savedAs}). No acknowledged change was affected.`);
  if (backup?.error) warnings.push(backup.error);
  elements.dataStatusWarning.textContent = warnings.join(" ");
  elements.dataStatusWarning.hidden = !warnings.length;
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

function splitChat() {
  return state.chats.find(chat => chat.id === splitChatId) || null;
}

function persistSplitView() {
  if (splitChatId) localStorage.setItem(SPLIT_VIEW_KEY, splitChatId);
  else localStorage.removeItem(SPLIT_VIEW_KEY);
}

function restoreSplitView() {
  const requested = localStorage.getItem(SPLIT_VIEW_KEY);
  splitChatId = requested ? SelfChatAppCore.resolveSplitChatId(state.chats, state.activeChatId, requested) : null;
  persistSplitView();
}

function openSplitView(requestedChatId = null) {
  if (globalViewOpen) return;
  const nextId = SelfChatAppCore.resolveSplitChatId(state.chats, state.activeChatId, requestedChatId || splitChatId);
  if (!nextId) return showToast("Create another chat to use split view", 3500);
  splitChatId = nextId;
  persistSplitView();
  renderSplitConversation();
}

function closeSplitView() {
  splitChatId = null;
  persistSplitView();
  renderSplitConversation();
  elements.messageInput.focus();
}

async function openSplitAsPrimary(messageId = null) {
  const next = splitChat();
  if (!next) return;
  const previousActiveId = state.activeChatId;
  splitChatId = previousActiveId;
  persistSplitView();
  await selectChat(next.id, messageId);
}

function renderSplitConversation() {
  if (splitChatId) {
    splitChatId = SelfChatAppCore.resolveSplitChatId(state.chats, state.activeChatId, splitChatId);
    persistSplitView();
  }
  const chat = splitChat();
  const isOpen = Boolean(chat) && !globalViewOpen;
  elements.app.classList.toggle("split-active", isOpen);
  elements.splitConversation.hidden = !isOpen;
  elements.splitViewButton.setAttribute("aria-pressed", String(isOpen));
  elements.splitViewButton.title = isOpen ? "Close split chat view" : "Split chat view";
  if (!chat) return;

  const orderedChats = SelfChatAppCore.sortChatsByPinAndActivity(state.chats, state.messages).filter(item => item.id !== state.activeChatId);
  elements.splitChatSelect.innerHTML = orderedChats.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  elements.splitChatSelect.value = chat.id;
  setChatAvatarElement(elements.splitChatAvatar, chat);
  setChatAvatarElement(elements.splitEmptyAvatar, chat);
  elements.splitEmptyTitle.textContent = chat.name;

  const messages = messagesFor(chat.id);
  elements.splitEmptyState.hidden = messages.length > 0;
  elements.splitMessageList.hidden = messages.length === 0;
  let previousDate = "";
  elements.splitMessageList.innerHTML = messages.map(message => {
    const date = formatDay(message.createdAt);
    const divider = date !== previousDate ? `<div class="day-divider">${escapeHtml(date)}</div>` : "";
    previousDate = date;
    return `${divider}${messageArticleHtml(message)}`;
  }).join("");
  hydrateImages(imageRenderToken, null, elements.splitMessageList, false);
  hydrateFileAttachments(imageRenderToken, elements.splitMessageList);
  requestAnimationFrame(() => { elements.splitMessageStage.scrollTop = elements.splitMessageStage.scrollHeight; });
}

async function toggleChatPinned(chatId) {
  const chat = state.chats.find(item => item.id === chatId);
  if (!chat) return;
  const before = structuredClone(chat);
  const pinned = !chat.pinnedAt;
  SelfChatAppCore.setChatPinned(chat, pinned, new Date().toISOString());
  closeContextMenu();
  if (elements.optionsDialog.open) elements.optionsDialog.close();
  try {
    await saveState();
    renderChats();
    if (chat.id === state.activeChatId) updatePinChatButton(chat);
    showToast(pinned ? "Chat pinned" : "Chat unpinned");
  } catch (_) {
    Object.keys(chat).forEach(key => delete chat[key]);
    Object.assign(chat, before);
    renderChats();
    if (chat.id === state.activeChatId) updatePinChatButton(chat);
    showToast("Pin change could not be saved", 5000);
  }
}

function updatePinChatButton(chat = activeChat()) {
  const label = chat?.pinnedAt ? "Unpin chat" : "Pin chat";
  const button = $("#pinChatButton");
  button.querySelector("span").textContent = label;
  button.title = `${label} (Ctrl+Alt+Shift+P)`;
}

async function saveChatOrder(change, successMessage = "Chat order updated") {
  const before = structuredClone(state.chats);
  const changed = change(new Date().toISOString());
  if (!changed.length) return false;
  closeContextMenu();
  try {
    await saveState();
    renderChats();
    showToast(successMessage);
    return true;
  } catch (_) {
    state.chats = before;
    renderChats();
    showToast("Chat order could not be saved", 5000);
    return false;
  }
}

function reorderChatTo(chatId, targetId, placement) {
  return saveChatOrder(updatedAt => SelfChatAppCore.reorderChat(state.chats, state.messages, chatId, targetId, placement, updatedAt));
}

function moveChatByOffset(chatId, offset) {
  return saveChatOrder(updatedAt => SelfChatAppCore.moveChatByOffset(state.chats, state.messages, chatId, offset, updatedAt));
}

function switchChatByOffset(offset) {
  const chats = SelfChatAppCore.sortChatsByPinAndActivity(state.chats, state.messages);
  if (chats.length < 2) return;
  const current = chats.findIndex(chat => chat.id === state.activeChatId);
  const next = chats[(current + offset + chats.length) % chats.length];
  if (next) selectChat(next.id);
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
  const tags = (message.tags || []).join(" ");
  const prefix = `${message.title || ""} ${tags} `.trimStart();
  if (message.type === "sticker") return `${prefix}${stickerFor(message)?.label || "Sticker"}`.trim();
  if (message.type === "image") return `${prefix}Image ${message.imageName || ""} ${message.caption || ""}`.trim();
  if (message.type === "file") return `${prefix}${message.fileName || "File"} ${message.caption || ""}`.trim();
  return `${prefix}${message.text || ""}`.trim();
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

function chatAvatarHtml(chat, className) {
  const image = chat?.avatarImageId
    ? `<img data-chat-avatar-image-id="${escapeHtml(chat.avatarImageId)}" alt="" hidden>`
    : "";
  return `<span class="${className}">${image}<span>${escapeHtml(chat?.emoji || "💬")}</span></span>`;
}

async function hydrateChatAvatars(root = document) {
  await Promise.all([...root.querySelectorAll("[data-chat-avatar-image-id]:not([src])")].map(async image => {
    try {
      let url = imageUrlCache.get(image.dataset.chatAvatarImageId);
      const record = url ? null : await getImage(image.dataset.chatAvatarImageId);
      if (!image.isConnected) return;
      if (!url) {
        if (!record?.blob) return;
        url = URL.createObjectURL(record.blob);
        imageUrlCache.set(image.dataset.chatAvatarImageId, url);
      }
      image.addEventListener("load", () => {
        image.hidden = false;
        if (image.nextElementSibling) image.nextElementSibling.hidden = true;
      }, { once: true });
      image.src = url;
    } catch (_) {}
  }));
}

function setChatAvatarElement(element, chat) {
  element.innerHTML = chat?.avatarImageId
    ? `<img data-chat-avatar-image-id="${escapeHtml(chat.avatarImageId)}" alt="" hidden><span>${escapeHtml(chat.emoji || "💬")}</span>`
    : `<span>${escapeHtml(chat?.emoji || "💬")}</span>`;
  hydrateChatAvatars(element);
}

function render() {
  renderChats();
  renderConversation();
}

function renderChats() {
  const query = elements.chatFilterInput.value.trim().toLocaleLowerCase();
  updateMediaGalleryCount();
  const chats = SelfChatAppCore.sortChatsByPinAndActivity(state.chats, state.messages);
  const globalMessageCount = SelfChatAppCore.groupGlobalMessages(state.chats, state.messages, hiddenGlobalChatIds)
    .reduce((total, group) => total + group.messages.length, 0);
  const hiddenChatCount = hiddenGlobalChatIds.size;
  const globalRow = `<div class="chat-row global-view-row ${globalViewOpen ? "active" : ""}">
    <button class="chat-row-main" data-global-view-open type="button" aria-current="${globalViewOpen ? "page" : "false"}">
      <span class="chat-row-avatar global-view-avatar" aria-hidden="true">⌁</span>
      <span class="chat-row-body">
        <span class="chat-row-line"><span class="chat-row-name">All Messages</span></span>
        <span class="chat-row-preview">${globalMessageCount ? `${globalMessageCount} visible message${globalMessageCount === 1 ? "" : "s"}${hiddenChatCount ? ` · ${hiddenChatCount} hidden` : ""}` : hiddenChatCount ? `${hiddenChatCount} chat${hiddenChatCount === 1 ? "" : "s"} hidden` : "Messages from every chat"}</span>
      </span>
    </button>
  </div>`;
  const renderChat = chat => {
    const lastMessage = messagesFor(chat.id).at(-1);
    const time = lastMessage ? formatSidebarTime(lastMessage.createdAt) : "";
    const preview = lastMessage ? (lastMessage.type === "sticker" ? "Sticker" : lastMessage.type === "image" ? `Photo${lastMessage.caption ? ` · ${lastMessage.caption}` : ""}` : lastMessage.text) : "No messages yet";
    const pin = chat.pinnedAt ? '<svg class="chat-row-pin" viewBox="0 0 24 24" aria-label="Pinned chat"><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6ZM12 14v7"/></svg>' : "";
    return `<div class="chat-row ${!globalViewOpen && chat.id === state.activeChatId ? "active" : ""}" data-chat-id="${escapeHtml(chat.id)}" draggable="true">
      <button class="chat-row-main" data-chat-open-id="${escapeHtml(chat.id)}" type="button">
        ${chatAvatarHtml(chat, "chat-row-avatar")}
        <span class="chat-row-body">
          <span class="chat-row-line"><span class="chat-row-name">${escapeHtml(chat.name)}</span><span class="chat-row-time">${time}</span></span>
          <span class="chat-row-preview-line"><span class="chat-row-preview">${escapeHtml(preview)}</span>${pin}</span>
        </span>
      </button>
      <button class="chat-row-menu-button" data-chat-menu-id="${escapeHtml(chat.id)}" type="button" aria-label="Options for ${escapeHtml(chat.name)}" title="Chat options">⌄</button>
    </div>`;
  };
  if (!query) {
    elements.chatList.innerHTML = globalRow + chats.map(renderChat).join("");
    hydrateChatAvatars(elements.chatList);
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
      ${chatAvatarHtml(chat, "result-icon")}
      <span class="result-copy"><strong>${escapeHtml(chat?.name || "Unsorted")} · ${escapeHtml(formatSidebarTime(message.createdAt))}</strong><span>${escapeHtml(messageLabel(message))}</span></span>
    </button>`;
  }).join("")}` : "";
  const searchResults = chatSection || messageSection ? chatSection + messageSection : '<p class="search-empty">No chats or messages found.</p>';
  elements.chatList.innerHTML = globalRow + searchResults;
  hydrateChatAvatars(elements.chatList);
}

function renderConversation() {
  if (globalViewOpen) {
    renderGlobalConversation();
    return;
  }
  const chat = activeChat();
  if (!chat) return;
  elements.app.classList.remove("global-view-active");
  elements.activeChatName.hidden = false;
  elements.activeChatNameInput.hidden = true;
  elements.conversationSubtitle.textContent = "you";
  $("#deleteSelectedButton").hidden = false;
  elements.chatNotesButton.hidden = false;
  elements.splitViewButton.hidden = false;
  elements.messageSearchButton.hidden = false;
  elements.globalVisibilityButton.hidden = true;
  elements.chatMenuButton.hidden = false;
  elements.composer.hidden = false;
  elements.keyboardHint.hidden = false;
  elements.messageStage.setAttribute("aria-label", "Messages");
  elements.messageList.classList.remove("global-message-list");
  elements.emptyDescription.textContent = "This group has one member. Unfortunately, he has takes.";
  elements.emptyHint.textContent = "Send the first message";
  setChatAvatarElement(elements.activeChatAvatar, chat);
  elements.activeChatName.textContent = chat.name;
  setChatAvatarElement(elements.emptyAvatar, chat);
  elements.emptyTitle.textContent = chat.name;
  elements.optionsChatName.textContent = chat.name;
  $("#chatNotesStatus").textContent = chat.note?.trim() ? "Saved" : "Empty";
  updatePinChatButton(chat);
  updateSavedMessageCount();
  updateMediaGalleryCount();
  renderMessageTagFilter();
  renderPinnedMessageBanner();
  renderMessages();
  renderSplitConversation();
}

function renderGlobalConversation({ scroll = true } = {}) {
  const groups = SelfChatAppCore.groupGlobalMessages(state.chats, state.messages, hiddenGlobalChatIds);
  const messageCount = groups.reduce((total, group) => total + group.messages.length, 0);
  const hiddenChatCount = hiddenGlobalChatIds.size;
  const renderToken = ++imageRenderToken;
  elements.app.classList.add("global-view-active");
  elements.activeChatAvatar.innerHTML = '<span aria-hidden="true">⌁</span>';
  elements.activeChatName.hidden = false;
  elements.activeChatNameInput.hidden = true;
  elements.activeChatName.textContent = "All Messages";
  elements.conversationSubtitle.textContent = messageCount
    ? `${messageCount} visible message${messageCount === 1 ? "" : "s"}${hiddenChatCount ? ` · ${hiddenChatCount} hidden` : ""} · derived view`
    : hiddenChatCount ? `${hiddenChatCount} chat${hiddenChatCount === 1 ? "" : "s"} hidden · derived view` : "derived view · all chats";
  $("#deleteSelectedButton").hidden = true;
  elements.chatNotesButton.hidden = true;
  elements.splitViewButton.hidden = true;
  elements.messageSearchButton.hidden = true;
  elements.globalVisibilityButton.hidden = false;
  elements.chatMenuButton.hidden = true;
  elements.messageSearchPanel.hidden = true;
  elements.pinnedMessageBanner.hidden = true;
  elements.selectionBar.hidden = !hasSelection();
  elements.stickerPanel.hidden = true;
  elements.composer.hidden = true;
  elements.keyboardHint.hidden = true;
  elements.messageStage.setAttribute("aria-label", "All messages from active chats");
  elements.messageList.classList.add("global-message-list");
  elements.emptyState.hidden = messageCount > 0;
  elements.messageList.hidden = messageCount === 0;
  elements.emptyAvatar.innerHTML = '<span aria-hidden="true">⌁</span>';
  elements.emptyTitle.textContent = "All Messages";
  elements.emptyDescription.textContent = hiddenChatCount
    ? "No messages from visible chats. Hidden chats remain unchanged."
    : "Messages from every active chat will appear here in chronological order.";
  elements.emptyHint.textContent = hiddenChatCount ? "Use the visibility control above to restore chats" : "Open a chat to send the first message";

  let previousDate = "";
  elements.messageList.innerHTML = groups.map(group => {
    const chat = state.chats.find(item => item.id === group.chatId);
    const messages = group.messages.map(message => {
      const date = formatDay(message.createdAt);
      const divider = date !== previousDate ? `<div class="day-divider">${escapeHtml(date)}</div>` : "";
      previousDate = date;
      return `${divider}${messageArticleHtml(message, "", null, true)}`;
    }).join("");
    return `<section class="global-message-group" data-global-chat-id="${escapeHtml(group.chatId)}" aria-label="Messages from ${escapeHtml(chat?.name || "Unknown chat")}">
      <div class="global-group-header">${chatAvatarHtml(chat, "global-group-avatar")}<strong>${escapeHtml(chat?.name || "Unknown chat")}</strong><button class="global-group-hide" type="button" data-hide-global-chat-id="${escapeHtml(group.chatId)}" aria-label="Hide ${escapeHtml(chat?.name || "this chat")} from All Messages" title="Hide from All Messages"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.5 10.5 0 0 1 12 4c5.5 0 9 6 9 6a16.8 16.8 0 0 1-2.2 2.9M6.6 6.6C4.3 8.1 3 10 3 10s3.5 6 9 6c1 0 2-.2 2.9-.6"/></svg></button></div>
      <div class="global-group-messages">${messages}</div>
    </section>`;
  }).join("");
  hydrateChatAvatars(elements.messageList);
  hydrateImages(renderToken, null, elements.messageList, true);
  hydrateFileAttachments(renderToken, elements.messageList);
  renderSplitConversation();
  if (scroll) requestAnimationFrame(scrollToBottom);
}

function renderGlobalVisibilityManager() {
  const chats = SelfChatAppCore.sortChatsByPinAndActivity(state.chats, state.messages);
  elements.globalVisibilityList.innerHTML = chats.map(chat => `<label class="global-visibility-row">
    ${chatAvatarHtml(chat, "global-visibility-avatar")}
    <span>${escapeHtml(chat.name)}</span>
    <input type="checkbox" data-global-chat-visibility="${escapeHtml(chat.id)}" aria-label="Show ${escapeHtml(chat.name)} in All Messages" ${hiddenGlobalChatIds.has(chat.id) ? "" : "checked"}>
  </label>`).join("");
  hydrateChatAvatars(elements.globalVisibilityList);
}

async function setGlobalChatHidden(chatId, hidden) {
  if (!state.chats.some(chat => chat.id === chatId) || hiddenGlobalChatIds.has(chatId) === hidden) return;
  if (hidden) hiddenGlobalChatIds.add(chatId); else hiddenGlobalChatIds.delete(chatId);
  renderChats();
  renderGlobalConversation({ scroll: false });
  renderGlobalVisibilityManager();
  try {
    await persistGlobalVisibility();
  } catch (_) {
    if (hidden) hiddenGlobalChatIds.delete(chatId); else hiddenGlobalChatIds.add(chatId);
    renderChats();
    renderGlobalConversation({ scroll: false });
    renderGlobalVisibilityManager();
    showToast("Visibility could not be saved", 5000);
  }
}

function openGlobalView() {
  globalViewOpen = true;
  localStorage.setItem(GLOBAL_VIEW_KEY, "true");
  selectedMessageIds.clear();
  selectedImageIds.clear();
  selectionAnchorMessageId = null;
  focusedMessageId = null;
  closeContextMenu();
  closeStickerPanel();
  render();
  elements.messageStage.focus({ preventScroll: true });
}

function messageFlagIconsHtml(message) {
  return `${message.starredAt ? '<svg class="message-flag star" viewBox="0 0 24 24" aria-label="Starred message"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>' : ""}${message.pinnedAt ? '<svg class="message-flag pin" viewBox="0 0 24 24" aria-label="Pinned message"><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6ZM12 14v7"/></svg>' : ""}`;
}

function messageMetaHtml(message) {
  return `${messageFlagIconsHtml(message)}${message.editedAt ? "edited · " : ""}${formatTime(message.createdAt)}<svg class="delivery-status" viewBox="0 0 24 24" aria-hidden="true"><path d="m2 13 4 4L16 7"/><path d="m9 16 2 2L22 7"/></svg>`;
}

function pinnedMessagesForActiveChat() {
  return messagesFor().filter(message => message.pinnedAt)
    .sort((a, b) => String(b.pinnedAt).localeCompare(String(a.pinnedAt)) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

function renderPinnedMessageBanner() {
  const pinned = pinnedMessagesForActiveChat();
  if (!pinned.length) {
    pinnedMessageIndex = 0;
    elements.pinnedMessageBanner.hidden = true;
    return;
  }
  pinnedMessageIndex = (pinnedMessageIndex + pinned.length) % pinned.length;
  const message = pinned[pinnedMessageIndex];
  elements.pinnedMessageBanner.hidden = false;
  elements.pinnedMessageLabel.textContent = pinned.length === 1 ? "Pinned message" : `Pinned message ${pinnedMessageIndex + 1}`;
  elements.pinnedMessageText.textContent = message.title || messagePlainText(message);
  elements.pinnedMessageCount.textContent = pinned.length > 1 ? `${pinnedMessageIndex + 1}/${pinned.length}` : "";
  $("#openPinnedMessage").dataset.pinnedMessageId = message.id;
  $("#previousPinnedMessage").hidden = pinned.length < 2;
  $("#nextPinnedMessage").hidden = pinned.length < 2;
}

function navigatePinnedMessage(direction) {
  const pinned = pinnedMessagesForActiveChat();
  if (!pinned.length) return;
  pinnedMessageIndex = (pinnedMessageIndex + direction + pinned.length) % pinned.length;
  renderPinnedMessageBanner();
}

function updateSavedMessageCount() {
  $("#starredMessageCount").textContent = String(messagesFor().filter(message => message.starredAt).length);
}

function renderStarredMessages() {
  const chat = activeChat();
  const starred = messagesFor(chat.id).filter(message => message.starredAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  $("#starredMessagesTitle").textContent = `${chat.name} · Starred messages`;
  elements.starredMessagesList.innerHTML = starred.length ? starred.map(message => `<button class="saved-message-row" type="button" data-starred-message-id="${escapeHtml(message.id)}"><strong>${escapeHtml(message.title || messagePlainText(message))}</strong><span>${escapeHtml(formatDay(message.createdAt))} at ${escapeHtml(formatTime(message.createdAt))}</span></button>`).join("") : '<p class="saved-message-empty">No starred messages in this chat.</p>';
}

function extractHttpLinks(value) {
  return [...String(value || "").matchAll(/https?:\/\/[^\s<>]+/gi)].map(match => match[0].replace(/[),.!?;:]+$/, ""));
}

function messageLinks(message) {
  const value = message.type === "image" || message.type === "file" ? message.caption || "" : message.text || "";
  return [...new Set(extractHttpLinks(value))];
}

function galleryItems() {
  const messages = messagesFor();
  if (galleryTab === "image") return messages.filter(message => message.type === "image");
  if (galleryTab === "file") return messages.filter(message => message.type === "file");
  return messages.flatMap(message => messageLinks(message).map(url => ({ message, url })));
}

function updateMediaGalleryCount() {
  const count = messagesFor().reduce((total, message) => total + (["image", "file"].includes(message.type) ? 1 : 0) + messageLinks(message).length, 0);
  $("#mediaGalleryCount").textContent = String(count);
}

function renderMediaGallery() {
  const chat = activeChat();
  const items = galleryItems();
  $("#mediaGalleryTitle").textContent = `${chat.name} · Media, links and files`;
  elements.mediaGalleryTabs.querySelectorAll("[data-gallery-tab]").forEach(button => {
    const selected = button.dataset.galleryTab === galleryTab;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  if (!items.length) {
    elements.mediaGalleryContent.innerHTML = `<p class="saved-message-empty">No ${galleryTab === "image" ? "media" : galleryTab === "file" ? "files" : "links"} in this chat.</p>`;
    return;
  }
  if (galleryTab === "image") {
    elements.mediaGalleryContent.innerHTML = `<div class="gallery-media-grid">${items.map(message => `<button class="gallery-image" type="button" data-gallery-message-id="${escapeHtml(message.id)}"><img data-image-id="${escapeHtml(message.imageId)}" alt="${escapeHtml(message.imageName || "Image")}" hidden><span class="gallery-image-fallback">Loading image…</span><span class="gallery-image-caption">${escapeHtml(message.caption || message.imageName || formatDay(message.createdAt))}</span></button>`).join("")}</div>`;
    hydrateImages(++imageRenderToken, null, elements.mediaGalleryContent);
    return;
  }
  if (galleryTab === "file") {
    elements.mediaGalleryContent.innerHTML = `<div class="gallery-list">${items.map(message => `<div class="gallery-file"><span><strong>${escapeHtml(message.fileName || "File")}</strong><br>${escapeHtml(formatFileSize(message.fileSize))} · ${escapeHtml(formatDay(message.createdAt))}</span><a data-file-open data-attachment-id="${escapeHtml(message.attachmentId)}" target="_blank" rel="noopener">Open</a><a data-file-download data-attachment-id="${escapeHtml(message.attachmentId)}" download="${escapeHtml(message.fileName || "download")}">Download</a></div>`).join("")}</div>`;
    hydrateFileAttachments(imageRenderToken, elements.mediaGalleryContent);
    return;
  }
  elements.mediaGalleryContent.innerHTML = `<div class="gallery-list">${items.map(item => `<a class="gallery-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(item.url)}</strong><span>${escapeHtml(formatDay(item.message.createdAt))} · ${escapeHtml(messagePlainText(item.message))}</span></a>`).join("")}</div>`;
}

function currentMessageSearchFilters() {
  return {
    query: elements.messageSearchInput.value,
    type: elements.messageTypeFilter.value,
    tag: elements.messageTagFilter.value,
    dateFrom: elements.messageDateFrom.value,
    dateTo: elements.messageDateTo.value
  };
}

function renderMessageTagFilter() {
  const selected = elements.messageTagFilter.value;
  const tags = [...new Set(messagesFor().flatMap(message => message.tags || []).map(tag => String(tag).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  elements.messageTagFilter.innerHTML = '<option value="">All tags</option>' + tags.map(tag => `<option value="${escapeHtml(tag)}">#${escapeHtml(tag)}</option>`).join("");
  if (tags.some(tag => tag === selected)) elements.messageTagFilter.value = selected;
}

function messageMatchesCurrentSearch(message) {
  return SelfChatAppCore.messageMatchesFilters(message, currentMessageSearchFilters(), messageLabel);
}

async function toggleMessageFlag(messageId, field) {
  const message = state.messages.find(item => item.id === messageId);
  if (!message) return;
  const before = structuredClone(message);
  const enabled = !message[field];
  SelfChatAppCore.setMessageFlag(message, field, enabled, new Date().toISOString());
  closeContextMenu();
  try {
    await saveState();
    renderMessages({ scroll: "preserve" });
    renderPinnedMessageBanner();
    updateSavedMessageCount();
    if (elements.starredMessagesDialog.open) renderStarredMessages();
    const label = field === "starredAt" ? (enabled ? "Message starred" : "Star removed") : (enabled ? "Message pinned" : "Message unpinned");
    showToast(label);
  } catch (_) {
    Object.keys(message).forEach(key => delete message[key]);
    Object.assign(message, before);
    renderMessages({ scroll: "preserve" });
    renderPinnedMessageBanner();
    updateSavedMessageCount();
    showToast("Message marker could not be saved", 5000);
  }
}

async function updateMessageMetadata(messageId, updates, successMessage) {
  const message = state.messages.find(item => item.id === messageId);
  if (!message) return false;
  const before = structuredClone(message);
  Object.entries(updates).forEach(([key, value]) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) delete message[key];
    else message[key] = value;
  });
  message.updatedAt = new Date().toISOString();
  try {
    await saveState();
    renderMessages({ scroll: "preserve" });
    renderMessageTagFilter();
    renderStarredMessages();
    renderPinnedMessageBanner();
    showToast(successMessage);
    return true;
  } catch (_) {
    Object.keys(message).forEach(key => delete message[key]);
    Object.assign(message, before);
    renderMessages({ scroll: "preserve" });
    showToast("Message details could not be saved", 5000);
    return false;
  }
}

async function duplicateMessage(messageId) {
  const original = state.messages.find(message => message.id === messageId);
  const copy = SelfChatAppCore.duplicateMessage(original, uid(), new Date().toISOString());
  if (!copy) return;
  state.messages.push(copy);
  closeContextMenu();
  try {
    await saveState();
    insertMessageElement(copy, { scroll: true });
    renderChats();
    renderMessageTagFilter();
    showToast("Message duplicated");
  } catch (_) { showToast("Message could not be duplicated", 5000); }
}

async function copyDirectMessageLink(messageId) {
  const url = new URL(location.href);
  url.hash = new URLSearchParams({ message: messageId }).toString();
  await navigator.clipboard.writeText(url.href);
  closeContextMenu();
  showToast("Message link copied");
}

async function openLinkedMessageFromLocation() {
  const messageId = new URLSearchParams(location.hash.slice(1)).get("message");
  if (!messageId) return false;
  const message = state.messages.find(item => item.id === messageId);
  if (!message) { showToast("Linked message is unavailable", 4000); return false; }
  await selectChat(message.chatId, message.id);
  return true;
}

function messageArticleHtml(message, query = "", activeMatchId = null, readOnly = false) {
  const sticker = message.type === "sticker" ? stickerFor(message) : null;
  const image = message.type === "image";
  const file = message.type === "file";
  const stickerImage = sticker?.imageId;
  const content = file
    ? `<div class="file-card"><span class="file-icon">FILE</span><span class="file-copy"><strong>${escapeHtml(message.fileName || "File")}</strong><small>${escapeHtml(formatFileSize(message.fileSize))}</small></span><span class="file-actions"><a data-file-open data-attachment-id="${escapeHtml(message.attachmentId)}" target="_blank" rel="noopener">Open</a><a data-file-download data-attachment-id="${escapeHtml(message.attachmentId)}" download="${escapeHtml(message.fileName || "download")}">Download</a></span></div>${message.caption ? `<span class="file-caption">${query ? highlightMatch(message.caption, query) : escapeHtml(message.caption)}</span>` : ""}`
    : image
    ? `<span class="message-media-frame${selectedImageIds.has(message.imageId) ? " selected" : ""}" data-selectable-image-id="${escapeHtml(message.imageId)}" role="option" aria-selected="${selectedImageIds.has(message.imageId)}"><img class="message-media" data-image-id="${escapeHtml(message.imageId)}" alt="${escapeHtml(message.imageName || "Image")}" draggable="false" hidden><span class="image-fallback">Loading image…<small>${escapeHtml(message.imageName || "Image")}</small></span><button class="image-copy-trigger" type="button" data-copy-image-id="${escapeHtml(message.imageId)}" aria-label="Copy image" title="Copy image" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg></button></span>${message.caption ? `<span class="image-caption">${query ? highlightMatch(message.caption, query) : escapeHtml(message.caption)}</span>` : ""}`
    : stickerImage
    ? `<img class="sticker-art sticker-image" data-image-id="${escapeHtml(sticker.imageId)}" alt="${escapeHtml(sticker.label)}" hidden><span class="sticker-image-fallback">Loading sticker…</span>`
    : sticker
    ? `<span class="sticker-art sticker-${sticker.tone}" role="img" aria-label="${escapeHtml(sticker.label)}"><span class="sticker-emoji">${escapeHtml(sticker.emoji)}</span>${sticker.caption ? `<span class="sticker-caption">${escapeHtml(sticker.caption)}</span>` : ""}</span>`
    : `<div class="message-text">${renderMessageText(message, query)}</div>`;
  const long = isLongTextMessage(message);
  const expanded = expandedMessageIds.has(message.id);
  const title = message.title ? `<strong class="message-title">${query ? highlightMatch(message.title, query) : escapeHtml(message.title)}</strong>` : "";
  const tags = (message.tags || []).length ? `<span class="message-tags">${message.tags.map(tag => `<span class="message-tag">#${escapeHtml(tag)}</span>`).join("")}</span>` : "";
  return `<article class="message${sticker ? " sticker-message" : image ? " image-message" : file ? " file-message" : " text-message"}${message.editedAt ? " message-edited" : ""}${message.starredAt || message.pinnedAt ? " message-flagged" : ""}${long ? " message-long" : ""}${expanded ? " message-expanded" : ""}${hasSelection() ? " selection-mode" : ""}${selectedMessageIds.has(message.id) ? " selected" : ""}${message.id === activeMatchId ? " search-match-active" : ""}${message.id === focusedMessageId ? " flash-target" : ""}${readOnly ? " global-message" : ""}" data-message-id="${escapeHtml(message.id)}" aria-selected="${selectedMessageIds.has(message.id)}"${readOnly ? ' tabindex="0" title="Select this message; press Enter to open its chat"' : ""}>
    ${readOnly ? "" : `<button class="message-copy-trigger" type="button" aria-label="Copy message" title="Copy message">
      <svg class="message-copy-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>
      <svg class="message-copy-feedback" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>
    </button><button class="message-menu-trigger" type="button" aria-label="Message options">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>`}
    ${replyQuoteHtml(message)}${title}<div class="message-content">${content}</div>${tags}
    ${long ? `<button class="message-collapse-button" type="button" data-toggle-message-collapse>${expanded ? "Show less" : "Read more"}</button>` : ""}
    <span class="message-meta">${messageMetaHtml(message)}</span>
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
  const filters = currentMessageSearchFilters();
  const searchActive = Boolean(query || filters.type !== "all" || filters.tag || filters.dateFrom || filters.dateTo);
  const matchIds = searchActive ? allMessages.filter(messageMatchesCurrentSearch).map(message => message.id) : [];
  if (messageSearchIndex >= matchIds.length) messageSearchIndex = Math.max(0, matchIds.length - 1);
  const activeMatchId = matchIds[messageSearchIndex];
  elements.emptyState.hidden = allMessages.length > 0;
  elements.messageList.hidden = allMessages.length === 0;
  elements.searchResultCount.textContent = searchActive ? (matchIds.length ? `${messageSearchIndex + 1} of ${matchIds.length}` : "0 found") : "";
  elements.previousSearchResult.disabled = matchIds.length < 2;
  elements.nextSearchResult.disabled = matchIds.length < 2;
  elements.selectionBar.hidden = !hasSelection();
  elements.selectionCount.textContent = `${selectionCount()} selected`;
  let previousDate = "";

  elements.messageList.innerHTML = visibleMessages.map(message => {
    const date = formatDay(message.createdAt);
    const divider = date !== previousDate ? `<div class="day-divider">${date}</div>` : "";
    previousDate = date;
    return `${divider}${messageArticleHtml(message, query, activeMatchId)}`;
  }).join("");

  const stickToBottom = scroll === "bottom" && !query && !activeMatchId && !focusedMessageId;
  hydrateImages(renderToken, activeMatchId || focusedMessageId, elements.messageList, stickToBottom);
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
  const matches = messagesFor().filter(messageMatchesCurrentSearch);
  if (!matches.length) return;
  messageSearchIndex = (messageSearchIndex + direction + matches.length) % matches.length;
  renderMessages({ scroll: "target" });
}

async function hydrateImages(renderToken, anchoredMessageId = null, root = elements.messageList, stickToBottom = false) {
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
        const copyButton = image.parentElement?.querySelector("[data-copy-image-id]");
        if (copyButton) copyButton.hidden = false;
        requestAnimationFrame(() => {
          if (anchoredMessageId) scrollMessageIntoView(anchoredMessageId, "auto");
          else if (stickToBottom) scrollToBottom();
          else restoreScrollAnchor(anchor);
        });
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
  hydrateImages(imageRenderToken, null, article, scroll);
  hydrateFileAttachments(imageRenderToken, article);
  if (scroll) requestAnimationFrame(scrollToBottom);
}

function removeMessageElements(messageIds) {
  messageIds.forEach(id => elements.messageList.querySelector(`[data-message-id="${CSS.escape(id)}"]`)?.remove());
  refreshDayDividers();
  updateMessageListVisibility();
}

function updateSelectionUi() {
  elements.selectionBar.hidden = !hasSelection() || Boolean(marqueeSelection?.active);
  elements.selectionCount.textContent = `${selectionCount()} selected`;
  $("#openSelectedButton").hidden = !globalViewOpen || selectedActionMessageIds().length !== 1;
  elements.messageList.querySelectorAll("[data-message-id]").forEach(article => {
    const selected = selectedMessageIds.has(article.dataset.messageId);
    article.classList.toggle("selection-mode", hasSelection());
    article.classList.toggle("selected", selected);
    article.setAttribute("aria-selected", String(selected));
  });
  elements.messageList.querySelectorAll("[data-selectable-image-id]").forEach(frame => {
    const selected = selectedImageIds.has(frame.dataset.selectableImageId);
    frame.classList.toggle("selected", selected);
    frame.setAttribute("aria-selected", String(selected));
  });
}

function clearMessageDropTarget() {
  elements.chatList.querySelectorAll(".message-drop-target").forEach(row => row.classList.remove("message-drop-target"));
  if (messageDrag) messageDrag.targetChatId = null;
}

function cancelMessageDrag(suppressClick = messageDrag?.active) {
  if (!messageDrag) return false;
  if (messageDrag.pointerId != null && messageDrag.article?.hasPointerCapture(messageDrag.pointerId)) {
    messageDrag.article.releasePointerCapture(messageDrag.pointerId);
  }
  messageDrag.preview?.remove();
  clearMessageDropTarget();
  document.body.classList.remove("message-dragging");
  messageDrag = null;
  if (suppressClick) {
    suppressMessageClick = true;
    setTimeout(() => { suppressMessageClick = false; }, 0);
  }
  return true;
}

function positionMessageDragPreview(clientX, clientY) {
  if (!messageDrag?.preview) return;
  messageDrag.preview.style.transform = `translate(${clientX + 14}px, ${clientY + 14}px)`;
}

function updateMessageDropTarget(clientX, clientY) {
  clearMessageDropTarget();
  const row = document.elementFromPoint(clientX, clientY)?.closest("[data-chat-id]");
  if (!row || !messageDrag || !state.chats.some(chat => chat.id === row.dataset.chatId)) return;
  if (!messageDrag.messageIds.some(id => state.messages.find(message => message.id === id)?.chatId !== row.dataset.chatId)) return;
  row.classList.add("message-drop-target");
  messageDrag.targetChatId = row.dataset.chatId;
}

function startMessageDrag(event, article) {
  const messageId = article.dataset.messageId;
  const actionIds = selectedActionMessageIds();
  if (!actionIds.includes(messageId)) return;
  messageDrag = {
    pointerId: event.pointerId,
    article,
    startClientX: event.clientX,
    startClientY: event.clientY,
    currentClientX: event.clientX,
    currentClientY: event.clientY,
    messageIds: actionIds,
    active: false,
    targetChatId: null,
    preview: null
  };
  article.setPointerCapture(event.pointerId);
}

function activateMessageDrag() {
  if (!messageDrag || messageDrag.active) return;
  messageDrag.active = true;
  const preview = document.createElement("div");
  preview.className = "message-drag-preview";
  preview.innerHTML = `<strong>${messageDrag.messageIds.length}</strong><span>${messageDrag.messageIds.length === 1 ? "message" : "messages"}</span>`;
  document.body.append(preview);
  messageDrag.preview = preview;
  document.body.classList.add("message-dragging");
  closeContextMenu();
  positionMessageDragPreview(messageDrag.currentClientX, messageDrag.currentClientY);
  updateMessageDropTarget(messageDrag.currentClientX, messageDrag.currentClientY);
}

async function moveMessagesToChat(messageIds, targetChatId) {
  if (!state.chats.some(chat => chat.id === targetChatId)) return false;
  const before = new Map(messageIds.map(id => {
    const message = state.messages.find(item => item.id === id);
    return [id, message ? { chatId: message.chatId, movedAt: message.movedAt } : null];
  }));
  const moving = SelfChatAppCore.moveMessages(state, messageIds, targetChatId, new Date().toISOString());
  if (!moving.length) {
    showToast("Messages are already in that chat");
    return false;
  }
  try {
    await saveState();
    selectedMessageIds.clear();
    selectedImageIds.clear();
    selectionAnchorMessageId = null;
    moving.forEach(message => updateReplyPreviews(message.id));
    renderChats();
    if (globalViewOpen) renderGlobalConversation({ scroll: false });
    else {
      removeMessageElements(moving.map(message => message.id));
      updateSelectionUi();
      renderPinnedMessageBanner();
      updateSavedMessageCount();
    }
    showToast(`${moving.length} message${moving.length === 1 ? "" : "s"} moved`);
    return true;
  } catch (_) {
    before.forEach((prior, id) => {
      const message = state.messages.find(item => item.id === id);
      if (!message || !prior) return;
      message.chatId = prior.chatId;
      if (prior.movedAt == null) delete message.movedAt; else message.movedAt = prior.movedAt;
    });
    showToast("Messages could not be moved", 5000);
    return false;
  }
}

function marqueeSelectionKeys(selection, currentContentY) {
  const top = Math.min(selection.startContentY, currentContentY);
  const bottom = Math.max(selection.startContentY, currentContentY);
  const left = Math.min(selection.startClientX, selection.currentClientX);
  const right = Math.max(selection.startClientX, selection.currentClientX);
  const stageTop = elements.messageStage.getBoundingClientRect().top;
  const hits = new Set();
  const candidates = [...elements.messageList.querySelectorAll("[data-message-id]")];
  candidates.forEach(item => {
    const rect = item.getBoundingClientRect();
    const articleTop = rect.top - stageTop + elements.messageStage.scrollTop;
    const articleBottom = rect.bottom - stageTop + elements.messageStage.scrollTop;
    if (rect.right < left || rect.left > right || articleBottom < top || articleTop > bottom) return;
    hits.add(`message:${item.dataset.messageId}`);
  });
  return hits;
}

function updateMarqueeSelection() {
  const selection = marqueeSelection;
  if (!selection?.active) return;
  const stageRect = elements.messageStage.getBoundingClientRect();
  const clientX = Math.max(stageRect.left, Math.min(selection.currentClientX, stageRect.right));
  const clientY = Math.max(stageRect.top, Math.min(selection.currentClientY, stageRect.bottom));
  const currentContentY = clientY - stageRect.top + elements.messageStage.scrollTop;
  const startViewportY = selection.startContentY - elements.messageStage.scrollTop + stageRect.top;
  const visibleStartY = Math.max(stageRect.top, Math.min(startViewportY, stageRect.bottom));
  const visibleCurrentY = Math.max(stageRect.top, Math.min(clientY, stageRect.bottom));
  elements.messageMarquee.hidden = false;
  elements.messageMarquee.style.left = `${Math.min(selection.startClientX, clientX)}px`;
  elements.messageMarquee.style.top = `${Math.min(visibleStartY, visibleCurrentY)}px`;
  elements.messageMarquee.style.width = `${Math.abs(clientX - selection.startClientX)}px`;
  elements.messageMarquee.style.height = `${Math.abs(visibleCurrentY - visibleStartY)}px`;

  const hits = marqueeSelectionKeys(selection, currentContentY);
  let nextKeys;
  if (selection.toggle) {
    nextKeys = new Set(selection.baseKeys);
    hits.forEach(key => nextKeys.has(key) ? nextKeys.delete(key) : nextKeys.add(key));
  } else if (selection.add) {
    nextKeys = new Set([...selection.baseKeys, ...hits]);
  } else {
    nextKeys = hits;
  }
  setSelectionKeys(nextKeys);
  updateSelectionUi();
}

function runMarqueeAutoScroll() {
  const selection = marqueeSelection;
  if (!selection?.active) return;
  const rect = elements.messageStage.getBoundingClientRect();
  const edge = 48;
  const topDistance = selection.currentClientY - rect.top;
  const bottomDistance = rect.bottom - selection.currentClientY;
  let delta = 0;
  if (topDistance < edge) delta = -Math.ceil((edge - Math.max(0, topDistance)) / 5);
  else if (bottomDistance < edge) delta = Math.ceil((edge - Math.max(0, bottomDistance)) / 5);
  if (delta) {
    const before = elements.messageStage.scrollTop;
    elements.messageStage.scrollTop += delta;
    if (elements.messageStage.scrollTop !== before) updateMarqueeSelection();
  }
  selection.animationFrame = requestAnimationFrame(runMarqueeAutoScroll);
}

function finishMarqueeSelection(pointerId, cancelled = false) {
  const selection = marqueeSelection;
  if (!selection || selection.pointerId !== pointerId) return;
  if (selection.animationFrame) cancelAnimationFrame(selection.animationFrame);
  if (elements.messageStage.hasPointerCapture(pointerId)) elements.messageStage.releasePointerCapture(pointerId);
  elements.messageMarquee.hidden = true;
  elements.messageMarquee.removeAttribute("style");
  elements.messageStage.classList.remove("marquee-ready");
  document.body.classList.remove("marquee-selecting");
  if (!selection.active && !cancelled) clearMessageSelection();
  marqueeSelection = null;
  updateSelectionUi();
}

elements.messageStage.addEventListener("pointerdown", event => {
  if (event.button !== 0 || event.pointerType === "touch" || document.querySelector("dialog[open]") || appBlocked) return;
  if (event.target.closest("[data-message-id], .day-divider, button, a, input, textarea, select")) return;
  const rect = elements.messageStage.getBoundingClientRect();
  const scrollbarWidth = elements.messageStage.offsetWidth - elements.messageStage.clientWidth;
  if (scrollbarWidth > 0 && event.clientX >= rect.right - scrollbarWidth) return;
  marqueeSelection = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startContentY: event.clientY - rect.top + elements.messageStage.scrollTop,
    currentClientX: event.clientX,
    currentClientY: event.clientY,
    baseKeys: selectionKeys(),
    add: event.shiftKey,
    toggle: event.ctrlKey || event.metaKey,
    active: false,
    animationFrame: 0
  };
  elements.messageStage.setPointerCapture(event.pointerId);
  elements.messageStage.classList.add("marquee-ready");
});

elements.messageStage.addEventListener("pointermove", event => {
  const selection = marqueeSelection;
  if (!selection || selection.pointerId !== event.pointerId) return;
  selection.currentClientX = event.clientX;
  selection.currentClientY = event.clientY;
  if (!selection.active && Math.hypot(event.clientX - selection.startClientX, event.clientY - selection.startClientY) < 5) return;
  if (!selection.active) {
    selection.active = true;
    document.body.classList.add("marquee-selecting");
    closeContextMenu();
    selection.animationFrame = requestAnimationFrame(runMarqueeAutoScroll);
  }
  event.preventDefault();
  updateMarqueeSelection();
});

elements.messageStage.addEventListener("pointerup", event => finishMarqueeSelection(event.pointerId));
elements.messageStage.addEventListener("pointercancel", event => finishMarqueeSelection(event.pointerId, true));

elements.messageList.addEventListener("pointerdown", event => {
  if (event.button !== 0 || event.pointerType === "touch" || document.querySelector("dialog[open]") || appBlocked) return;
  if (event.target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
  const article = event.target.closest("[data-message-id]");
  if (!article || !selectedActionMessageIds().includes(article.dataset.messageId)) return;
  startMessageDrag(event, article);
});

elements.messageList.addEventListener("pointermove", event => {
  if (!messageDrag || messageDrag.pointerId !== event.pointerId) return;
  messageDrag.currentClientX = event.clientX;
  messageDrag.currentClientY = event.clientY;
  if (!messageDrag.active && Math.hypot(event.clientX - messageDrag.startClientX, event.clientY - messageDrag.startClientY) < 6) return;
  activateMessageDrag();
  event.preventDefault();
  positionMessageDragPreview(event.clientX, event.clientY);
  updateMessageDropTarget(event.clientX, event.clientY);
});

elements.messageList.addEventListener("pointerup", event => {
  if (!messageDrag || messageDrag.pointerId !== event.pointerId) return;
  const { active, messageIds, targetChatId } = messageDrag;
  cancelMessageDrag(active);
  if (active && targetChatId) void moveMessagesToChat(messageIds, targetChatId);
});
elements.messageList.addEventListener("pointercancel", event => {
  if (messageDrag?.pointerId === event.pointerId) cancelMessageDrag();
});

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
      article.querySelector(".message-content")?.append(caption);
    }
    if (caption) {
      caption.textContent = message.caption || "";
      caption.hidden = !message.caption;
    }
  } else {
    const text = article.querySelector(".message-text");
    if (text) text.innerHTML = renderMessageText(message);
  }
  const long = isLongTextMessage(message);
  article.classList.toggle("message-long", long);
  if (!long) {
    expandedMessageIds.delete(message.id);
    article.classList.remove("message-expanded");
    article.querySelector("[data-toggle-message-collapse]")?.remove();
  } else if (!article.querySelector("[data-toggle-message-collapse]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "message-collapse-button";
    button.setAttribute("data-toggle-message-collapse", "");
    button.textContent = expandedMessageIds.has(message.id) ? "Show less" : "Read more";
    article.querySelector(".message-content")?.after(button);
  }
  const meta = article.querySelector(".message-meta");
  if (meta) meta.innerHTML = messageMetaHtml(message);
  article.classList.add("message-edited");
  updateReplyPreviews(message.id);
  renderPinnedMessageBanner();
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

function codeBlocksFor(message) {
  return SelfChatAppCore.parseFencedCode(message?.text || "").filter(part => part.type === "code");
}

function renderMessageText(message, query = "") {
  let codeIndex = 0;
  return SelfChatAppCore.parseFencedCode(message.text || "").map(part => {
    if (part.type === "text") return renderLinkedText(part.text, query);
    const index = codeIndex++;
    const code = query ? highlightMatch(part.code, query) : escapeHtml(part.code);
    return `<span class="message-code-block"><span class="message-code-header"><span>${escapeHtml(part.language || "Code")}</span><button type="button" data-copy-code-index="${index}">Copy code</button></span><pre><code>${code}</code></pre></span>`;
  }).join("");
}

function isLongTextMessage(message) {
  if (!message || message.type) return false;
  const text = String(message.text || "");
  return text.length > 1000 || text.split("\n").length > 14;
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
    resizeComposer();
    updateComposerState();
  },
  getChatId: () => state.activeChatId,
  getExtra: replyFields,
  createId: uid,
  now: () => new Date().toISOString(),
  async persist(message, remainingText) {
    clearTimeout(draftSaveTimer);
    state.messages.push(message);
    state.drafts[message.chatId] = remainingText;
    await saveState();
  },
  onSaved(message) {
    if (message.replyToId && message.replyToId === pendingReplyId) cancelReply();
    insertMessageElement(message, { scroll: true });
    renderChats();
    elements.messageInput.focus();
  },
  onFailure(error) {
    state.drafts[state.activeChatId] = elements.messageInput.value;
    showToast(error?.code === "UNREACHABLE" ? "SelfChat server is not reachable — message not saved, your text is still here" : "Message not saved — your text is still here", 6000);
    elements.messageInput.focus();
  }
});

function sendMessage() {
  if (globalViewOpen) return false;
  return sendTextMessage();
}

async function sendSticker(stickerId) {
  if (globalViewOpen) return;
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
  if (globalViewOpen) return;
  const batch = SelfChatAppCore.createAttachmentBatch(files, {
    chatId: state.activeChatId, caption, reply: replyFields(), createId: uid, now: Date.now
  });
  if (!batch.messages.length) return showToast("Choose a file");
  const addedMessageIds = batch.messages.map(message => message.id);
  try {
    for (const attachment of batch.attachments) await uploadAttachment(attachment);
  } catch (_) {
    return showToast("Files not sent — they are still ready to send", 5000);
  }
  state.messages.push(...batch.messages);
  state.drafts[state.activeChatId] = "";
  try {
    await saveState();
  } catch (_) {
    showToast("Files not sent — they are still ready to send", 5000);
    return;
  }
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
  if (globalViewOpen) return showToast("Open a chat to add files", 3500);
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
  if (!state.chats.some(chat => chat.id === id)) return;
  globalViewOpen = false;
  localStorage.removeItem(GLOBAL_VIEW_KEY);
  clearPendingImages();
  cancelReply();
  const previousActiveId = state.activeChatId;
  if (splitChatId === id && previousActiveId !== id) splitChatId = previousActiveId;
  state.activeChatId = id;
  if (splitChatId) splitChatId = SelfChatAppCore.resolveSplitChatId(state.chats, state.activeChatId, splitChatId);
  persistSplitView();
  elements.messageSearchInput.value = "";
  elements.messageTypeFilter.value = "all";
  elements.messageTagFilter.value = "";
  elements.messageDateFrom.value = "";
  elements.messageDateTo.value = "";
  elements.messageSearchPanel.hidden = true;
  closeStickerPanel();
  selectedMessageIds.clear();
  selectedImageIds.clear();
  selectionAnchorMessageId = null;
  pinnedMessageIndex = 0;
  focusedMessageId = messageId;
  rememberActiveChat();
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
  elements.chatContextMenu.hidden = true;
  contextMessageId = null;
  contextChatId = null;
}

function clearMessageSelection() {
  selectedMessageIds.clear();
  selectedImageIds.clear();
  selectionAnchorMessageId = null;
  updateSelectionUi();
}

async function deleteMessagesWithUndo(messageIds) {
  const ids = [...new Set(messageIds)];
  const token = SelfChatAppCore.moveMessagesToTrash(state, ids, new Date().toISOString());
  if (!token) return;
  try {
    await saveState({ deletes: { messages: token.messages.map(message => message.id) } });
    selectedMessageIds.clear();
    selectedImageIds.clear();
    removeMessageElements(ids);
    updateSelectionUi();
    renderChats();
    renderPinnedMessageBanner();
    updateSavedMessageCount();
    ids.forEach(updateReplyPreviews);
    showToast(`${token.messages.length} message${token.messages.length === 1 ? "" : "s"} moved to Trash`, 6000, {
      label: "Undo",
      run: async () => {
        try {
          const restored = SelfChatAppCore.undoMessagesToTrash(state, token);
          await saveState({ deletes: { trash: token.messages.map(message => `message:${message.id}`) } });
          restored.forEach(message => insertMessageElement(message));
          renderChats();
          renderPinnedMessageBanner();
          updateSavedMessageCount();
          ids.forEach(updateReplyPreviews);
          showToast(`${restored.length} message${restored.length === 1 ? "" : "s"} restored`);
        } catch (_) { showToast("Undo could not be saved", 5000); }
      }
    });
  } catch (_) { showToast("Messages could not be moved to Trash", 5000); }
}

function deleteSelectedMessages() {
  return deleteMessagesWithUndo(selectedActionMessageIds());
}

function openMoveDialog(messageIds) {
  selectedMessageIds = new Set(messageIds.filter(id => state.messages.some(message => message.id === id)));
  selectedImageIds.clear();
  if (!selectedMessageIds.size) return;
  pendingMoveMessageIds = [...selectedMessageIds];
  const count = selectedMessageIds.size;
  elements.moveTitle.textContent = count === 1 ? "Move message" : `Move ${count} messages`;
  elements.moveDestination.innerHTML = [...state.chats]
    .sort((a, b) => (a.id === "unsorted" ? -1 : b.id === "unsorted" ? 1 : a.name.localeCompare(b.name)))
    .map(chat => `<option value="${escapeHtml(chat.id)}">${escapeHtml(chat.name)}</option>`).join("");
  const first = state.messages.find(message => selectedMessageIds.has(message.id));
  const alternative = state.chats.find(chat => chat.id !== first?.chatId);
  if (alternative) elements.moveDestination.value = alternative.id;
  elements.confirmMoveButton.disabled = false;
  elements.confirmMoveButton.textContent = "Move";
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
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => saveState().catch(() => showToast("Draft could not be saved", 4000)), 400);
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
  if (globalViewOpen) return;
  if (elements.stickerDialog.open) return;
  dragDepth += 1;
  elements.dropOverlay.hidden = false;
});
document.addEventListener("dragover", event => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  if (globalViewOpen) {
    event.dataTransfer.dropEffect = "none";
    return;
  }
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
  if (globalViewOpen) return showToast("Open a chat to add files", 3500);
  if (elements.stickerDialog.open) {
    stageStickerImage([...event.dataTransfer.files].find(file => file.type.startsWith("image/")));
    return;
  }
  stageAttachments(event.dataTransfer.files);
});
elements.chatList.addEventListener("click", event => {
  if (suppressChatClick) { event.preventDefault(); return; }
  if (event.target.closest("[data-global-view-open]")) {
    elements.chatFilterInput.value = "";
    openGlobalView();
    return;
  }
  const result = event.target.closest("[data-search-message-id]");
  if (result) {
    elements.chatFilterInput.value = "";
    selectChat(result.dataset.searchChatId, result.dataset.searchMessageId);
    return;
  }
  const menuButton = event.target.closest("[data-chat-menu-id]");
  if (menuButton) {
    const rect = menuButton.getBoundingClientRect();
    openChatContextMenu(menuButton.dataset.chatMenuId, rect.right - 160, rect.bottom + 4);
    event.stopPropagation();
    return;
  }
  const rowButton = event.target.closest("[data-chat-open-id]");
  if (rowButton) selectChat(rowButton.dataset.chatOpenId);
});
elements.chatList.addEventListener("contextmenu", event => {
  const row = event.target.closest("[data-chat-id]");
  if (!row) return;
  event.preventDefault();
  openChatContextMenu(row.dataset.chatId, event.clientX, event.clientY);
});
elements.chatList.addEventListener("dragstart", event => {
  const row = event.target.closest("[data-chat-id]");
  if (!row || event.target.closest("[data-chat-menu-id]")) return event.preventDefault();
  draggingChatId = row.dataset.chatId;
  row.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggingChatId);
});
elements.chatList.addEventListener("dragover", event => {
  const row = event.target.closest("[data-chat-id]");
  if (!row || !draggingChatId || row.dataset.chatId === draggingChatId) return;
  const moving = state.chats.find(chat => chat.id === draggingChatId);
  const target = state.chats.find(chat => chat.id === row.dataset.chatId);
  if (!moving || !target || Boolean(moving.pinnedAt) !== Boolean(target.pinnedAt)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  elements.chatList.querySelectorAll(".drag-before, .drag-after").forEach(item => item.classList.remove("drag-before", "drag-after"));
  row.classList.add(event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2 ? "drag-after" : "drag-before");
});
elements.chatList.addEventListener("drop", event => {
  const row = event.target.closest("[data-chat-id]");
  if (!row || !draggingChatId || row.dataset.chatId === draggingChatId) return;
  event.preventDefault();
  const placement = row.classList.contains("drag-after") ? "after" : "before";
  reorderChatTo(draggingChatId, row.dataset.chatId, placement);
});
elements.chatList.addEventListener("dragend", event => {
  event.target.closest("[data-chat-id]")?.classList.remove("dragging");
  elements.chatList.querySelectorAll(".drag-before, .drag-after").forEach(item => item.classList.remove("drag-before", "drag-after"));
  draggingChatId = null;
  suppressChatClick = true;
  setTimeout(() => { suppressChatClick = false; }, 0);
});
elements.chatFilterInput.addEventListener("input", renderChats);
elements.chatFilterInput.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    elements.chatFilterInput.value = "";
    renderChats();
    renderPinnedMessageBanner();
    updateSavedMessageCount();
    elements.messageInput.focus();
  }
  if (event.key === "Enter") {
    const first = elements.chatList.querySelector("[data-global-view-open], [data-chat-id], [data-search-message-id]");
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
  try { await uploadAttachment(attachment); }
  catch (_) {
    elements.saveStickerButton.disabled = false;
    return showToast("Could not save the sticker");
  }
  const sticker = { id: `custom-${uid()}`, imageId, label: label.slice(0, 40) };
  state.customStickers.push(sticker);
  try { await saveState(); } catch (_) {
    elements.saveStickerButton.disabled = false;
    return showToast("Could not save the sticker");
  }
  renderStickerGrid();
  elements.stickerDialog.close();
  showToast("Sticker created");
});

function populateEmojiPicker(container, selected, onSelect) {
  container.innerHTML = "";
  EMOJIS.forEach(emoji => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.setAttribute("aria-label", `Use ${emoji} icon`);
    button.className = `emoji-choice${emoji === selected ? " selected" : ""}`;
    button.addEventListener("click", () => {
      [...container.children].forEach(choice => choice.classList.toggle("selected", choice === button));
      onSelect(emoji);
    });
    container.append(button);
  });
}

function clearNewChatAvatar() {
  if (pendingNewChatAvatarUrl) URL.revokeObjectURL(pendingNewChatAvatarUrl);
  pendingNewChatAvatar = null;
  pendingNewChatAvatarUrl = null;
  elements.newChatAvatarInput.value = "";
  elements.newChatAvatarPreview.innerHTML = `<span>${escapeHtml(selectedEmoji)}</span>`;
  elements.removeNewChatAvatarButton.hidden = true;
}

async function stageNewChatAvatar(file) {
  if (!file) return;
  try {
    const record = await createAvatarAttachment(file);
    clearNewChatAvatar();
    pendingNewChatAvatar = record;
    pendingNewChatAvatarUrl = URL.createObjectURL(record.blob);
    elements.newChatAvatarPreview.innerHTML = `<img src="${pendingNewChatAvatarUrl}" alt="Selected chat icon">`;
    elements.removeNewChatAvatarButton.hidden = false;
  } catch (error) { showToast(error.message || "That image could not be used", 5000); }
}

function clearAvatarDraftUrl() {
  if (avatarDraftUrl) URL.revokeObjectURL(avatarDraftUrl);
  avatarDraftUrl = null;
}

function renderAvatarDraft() {
  clearAvatarDraftUrl();
  if (avatarDraft?.record) {
    avatarDraftUrl = URL.createObjectURL(avatarDraft.record.blob);
    elements.avatarEditorPreview.innerHTML = `<img src="${avatarDraftUrl}" alt="Selected chat icon">`;
  } else if (avatarDraft?.existingImageId) {
    elements.avatarEditorPreview.innerHTML = `<img data-chat-avatar-image-id="${escapeHtml(avatarDraft.existingImageId)}" alt="" hidden><span>${escapeHtml(avatarDraft.emoji)}</span>`;
    hydrateChatAvatars(elements.avatarEditorPreview);
  } else {
    elements.avatarEditorPreview.innerHTML = `<span>${escapeHtml(avatarDraft?.emoji || "💬")}</span>`;
  }
  elements.removeAvatarImageButton.disabled = !avatarDraft?.record && !avatarDraft?.existingImageId;
}

async function stageAvatarDraft(file) {
  if (!file) return;
  try {
    avatarDraft.record = await createAvatarAttachment(file);
    avatarDraft.existingImageId = null;
    renderAvatarDraft();
  } catch (error) { showToast(error.message || "That image could not be used", 5000); }
}

populateEmojiPicker(elements.emojiPicker, selectedEmoji, emoji => {
  selectedEmoji = emoji;
  if (!pendingNewChatAvatar) elements.newChatAvatarPreview.innerHTML = `<span>${escapeHtml(emoji)}</span>`;
});

$("#newChatButton").addEventListener("click", () => {
  selectedEmoji = EMOJIS[0];
  clearNewChatAvatar();
  populateEmojiPicker(elements.emojiPicker, selectedEmoji, emoji => {
    selectedEmoji = emoji;
    if (!pendingNewChatAvatar) elements.newChatAvatarPreview.innerHTML = `<span>${escapeHtml(emoji)}</span>`;
  });
  elements.chatNameInput.value = "";
  elements.chatDialog.showModal();
  setTimeout(() => elements.chatNameInput.focus(), 40);
});
$("#cancelChatButton").addEventListener("click", () => elements.chatDialog.close());
$("#chooseNewChatAvatarButton").addEventListener("click", () => elements.newChatAvatarInput.click());
elements.newChatAvatarInput.addEventListener("change", () => {
  stageNewChatAvatar(elements.newChatAvatarInput.files[0]);
  elements.newChatAvatarInput.value = "";
});
elements.removeNewChatAvatarButton.addEventListener("click", clearNewChatAvatar);
elements.chatDialog.addEventListener("close", clearNewChatAvatar);
elements.chatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = elements.chatNameInput.value.trim();
  if (!name) return;
  const avatar = pendingNewChatAvatar;
  const chat = { id: uid(), name, emoji: selectedEmoji, ...(avatar ? { avatarImageId: avatar.id } : {}), createdAt: new Date().toISOString() };
  if (avatar) {
    try { await uploadAttachment(avatar); }
    catch (_) { return showToast("Chat icon could not be saved", 5000); }
  }
  const previousActiveId = state.activeChatId;
  state.chats.push(chat);
  state.activeChatId = chat.id;
  try { await saveState(); } catch (_) {
    if (state.chats.some(item => item.id === previousActiveId)) state.activeChatId = previousActiveId;
    return showToast("Chat could not be saved", 5000);
  }
  globalViewOpen = false;
  localStorage.removeItem(GLOBAL_VIEW_KEY);
  elements.chatDialog.close();
  render();
  elements.messageInput.focus();
});

$("#messageSearchButton").addEventListener("click", () => {
  if (globalViewOpen) return;
  clearMessageSelection();
  messageSearchIndex = 0;
  elements.messageSearchPanel.hidden = false;
  elements.messageSearchInput.focus();
});
$("#closeMessageSearch").addEventListener("click", () => {
  elements.messageSearchInput.value = "";
  elements.messageTypeFilter.value = "all";
  elements.messageTagFilter.value = "";
  elements.messageDateFrom.value = "";
  elements.messageDateTo.value = "";
  elements.messageSearchPanel.hidden = true;
  messageSearchIndex = 0;
  renderMessages({ scroll: "preserve" });
  elements.messageInput.focus();
});
function updateMessageSearch() { messageSearchIndex = 0; renderMessages({ scroll: "target" }); }
elements.messageSearchInput.addEventListener("input", updateMessageSearch);
elements.messageTypeFilter.addEventListener("change", updateMessageSearch);
elements.messageTagFilter.addEventListener("change", updateMessageSearch);
elements.messageDateFrom.addEventListener("change", updateMessageSearch);
elements.messageDateTo.addEventListener("change", updateMessageSearch);
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

function updateChatNotesCharacterCount() {
  elements.chatNotesCharacterCount.textContent = `${elements.chatNotesInput.value.length.toLocaleString()} / 10,000`;
}

function openChatNotesDialog(chatId = state.activeChatId) {
  const chat = state.chats.find(item => item.id === chatId);
  if (!chat) return;
  notesChatId = chat.id;
  elements.chatNotesTitle.textContent = `${chat.name} notes`;
  elements.chatNotesInput.value = chat.note || "";
  updateChatNotesCharacterCount();
  if (elements.optionsDialog.open) elements.optionsDialog.close();
  elements.chatNotesDialog.showModal();
  setTimeout(() => elements.chatNotesInput.focus(), 30);
}

async function saveChatNotes() {
  const chat = state.chats.find(item => item.id === notesChatId);
  if (!chat) return false;
  const before = structuredClone(chat);
  SelfChatAppCore.setChatNote(chat, elements.chatNotesInput.value, new Date().toISOString());
  try {
    await saveState();
    renderChats();
    renderConversation();
    elements.chatNotesDialog.close();
    showToast(chat.note ? "Chat notes saved" : "Chat notes cleared");
    return true;
  } catch (_) {
    Object.keys(chat).forEach(key => delete chat[key]);
    Object.assign(chat, before);
    showToast("Chat notes could not be saved", 5000);
    return false;
  }
}

$("#chatMenuButton").addEventListener("click", () => elements.optionsDialog.showModal());
elements.globalVisibilityButton.addEventListener("click", () => {
  renderGlobalVisibilityManager();
  elements.globalVisibilityDialog.showModal();
});
$("#closeGlobalVisibilityButton").addEventListener("click", () => elements.globalVisibilityDialog.close());
elements.globalVisibilityList.addEventListener("change", event => {
  const input = event.target.closest("[data-global-chat-visibility]");
  if (input) void setGlobalChatHidden(input.dataset.globalChatVisibility, !input.checked);
});
$("#closeOptionsButton").addEventListener("click", () => elements.optionsDialog.close());
$("#pinChatButton").addEventListener("click", () => toggleChatPinned(state.activeChatId));
elements.chatNotesButton.addEventListener("click", () => openChatNotesDialog());
$("#chatNotesOptionsButton").addEventListener("click", () => openChatNotesDialog());
$("#cancelChatNotesButton").addEventListener("click", () => elements.chatNotesDialog.close());
elements.chatNotesInput.addEventListener("input", updateChatNotesCharacterCount);
elements.chatNotesInput.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    elements.chatNotesForm.requestSubmit();
  }
});
elements.chatNotesForm.addEventListener("submit", event => {
  event.preventDefault();
  void saveChatNotes();
});
elements.splitViewButton.addEventListener("click", () => splitChatId ? closeSplitView() : openSplitView());
$("#closeSplitViewButton").addEventListener("click", closeSplitView);
$("#openSplitAsPrimaryButton").addEventListener("click", () => openSplitAsPrimary());
$("#splitPrimaryAction").addEventListener("click", () => openSplitAsPrimary());
elements.splitChatSelect.addEventListener("change", () => openSplitView(elements.splitChatSelect.value));
$("#starredMessagesButton").addEventListener("click", () => {
  renderStarredMessages();
  elements.optionsDialog.close();
  elements.starredMessagesDialog.showModal();
});
$("#mediaGalleryButton").addEventListener("click", () => {
  galleryTab = "image";
  renderMediaGallery();
  elements.optionsDialog.close();
  elements.mediaGalleryDialog.showModal();
});
$("#closeMediaGalleryButton").addEventListener("click", () => elements.mediaGalleryDialog.close());
elements.mediaGalleryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-gallery-tab]");
  if (!button) return;
  galleryTab = button.dataset.galleryTab;
  renderMediaGallery();
});
elements.mediaGalleryContent.addEventListener("click", event => {
  const image = event.target.closest("[data-gallery-message-id]");
  if (image) openImageViewer(image.dataset.galleryMessageId);
});
function openMessageTitleDialog(message) {
  metadataMessageId = message.id;
  elements.messageTitleInput.value = message.title || "";
  closeContextMenu();
  elements.messageTitleDialog.showModal();
  setTimeout(() => { elements.messageTitleInput.focus(); elements.messageTitleInput.select(); }, 30);
}
function openMessageTagsDialog(message) {
  metadataMessageId = message.id;
  elements.messageTagsInput.value = (message.tags || []).join(", ");
  closeContextMenu();
  elements.messageTagsDialog.showModal();
  setTimeout(() => { elements.messageTagsInput.focus(); elements.messageTagsInput.select(); }, 30);
}
$("#cancelMessageTitleButton").addEventListener("click", () => elements.messageTitleDialog.close());
$("#cancelMessageTagsButton").addEventListener("click", () => elements.messageTagsDialog.close());
elements.messageTitleForm.addEventListener("submit", async event => {
  event.preventDefault();
  const id = metadataMessageId;
  if (await updateMessageMetadata(id, { title: elements.messageTitleInput.value.trim().slice(0, 80) }, "Message title updated")) elements.messageTitleDialog.close();
});
elements.messageTagsForm.addEventListener("submit", async event => {
  event.preventDefault();
  const id = metadataMessageId;
  const tags = SelfChatAppCore.normalizeMessageTags(elements.messageTagsInput.value);
  if (await updateMessageMetadata(id, { tags }, "Message tags updated")) elements.messageTagsDialog.close();
});
[elements.messageTitleDialog, elements.messageTagsDialog].forEach(dialog => dialog.addEventListener("close", () => { metadataMessageId = null; }));
$("#closeStarredMessagesButton").addEventListener("click", () => elements.starredMessagesDialog.close());
elements.starredMessagesList.addEventListener("click", event => {
  const row = event.target.closest("[data-starred-message-id]");
  if (!row) return;
  elements.starredMessagesDialog.close();
  selectChat(state.activeChatId, row.dataset.starredMessageId);
});
$("#openPinnedMessage").addEventListener("click", event => scrollMessageIntoView(event.currentTarget.dataset.pinnedMessageId));
$("#previousPinnedMessage").addEventListener("click", () => navigatePinnedMessage(-1));
$("#nextPinnedMessage").addEventListener("click", () => navigatePinnedMessage(1));
$("#changeChatAvatarButton").addEventListener("click", () => {
  const chat = activeChat();
  avatarDraft = { chatId: chat.id, emoji: chat.emoji || "💬", existingImageId: chat.avatarImageId || null, record: null };
  populateEmojiPicker(elements.avatarEmojiPicker, avatarDraft.emoji, emoji => {
    avatarDraft.emoji = emoji;
    avatarDraft.record = null;
    avatarDraft.existingImageId = null;
    renderAvatarDraft();
  });
  renderAvatarDraft();
  elements.optionsDialog.close();
  elements.avatarDialog.showModal();
  setTimeout(() => elements.avatarEmojiPicker.querySelector(".selected")?.focus(), 40);
});
$("#chooseAvatarImageButton").addEventListener("click", () => elements.avatarImageInput.click());
elements.avatarImageInput.addEventListener("change", () => {
  stageAvatarDraft(elements.avatarImageInput.files[0]);
  elements.avatarImageInput.value = "";
});
elements.removeAvatarImageButton.addEventListener("click", () => {
  avatarDraft.record = null;
  avatarDraft.existingImageId = null;
  renderAvatarDraft();
});
$("#cancelAvatarButton").addEventListener("click", () => elements.avatarDialog.close());
elements.avatarDialog.addEventListener("close", () => {
  clearAvatarDraftUrl();
  elements.avatarImageInput.value = "";
  avatarDraft = null;
});
elements.avatarForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!avatarDraft) return;
  const chat = state.chats.find(item => item.id === avatarDraft.chatId);
  if (!chat) return elements.avatarDialog.close();
  const before = structuredClone(chat);
  const record = avatarDraft.record;
  if (record) {
    try { await uploadAttachment(record); }
    catch (_) { return showToast("Chat icon could not be saved", 5000); }
  }
  chat.emoji = avatarDraft.emoji;
  if (record) chat.avatarImageId = record.id;
  else if (avatarDraft.existingImageId) chat.avatarImageId = avatarDraft.existingImageId;
  else delete chat.avatarImageId;
  chat.updatedAt = new Date().toISOString();
  try { await saveState(); }
  catch (_) {
    Object.keys(chat).forEach(key => delete chat[key]);
    Object.assign(chat, before);
    return showToast("Chat icon could not be saved", 5000);
  }
  elements.avatarDialog.close();
  render();
  elements.messageInput.focus();
  showToast("Chat icon updated");
});
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
  const wasHiddenInGlobalView = hiddenGlobalChatIds.has(chat.id);
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
  try {
    await saveState({ deletes: { chats: [chat.id], messages: deletedMessages.map(message => message.id) } });
  } catch (_) {
    return showToast("Chat could not be moved to Trash", 5000);
  }
  hiddenGlobalChatIds.delete(chat.id);
  await persistGlobalVisibility().catch(() => {});
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
        await saveState({ deletes: { trash: [`chat:${chat.id}`] } });
        if (wasHiddenInGlobalView) hiddenGlobalChatIds.add(chat.id);
        await persistGlobalVisibility().catch(() => {});
        elements.messageInput.value = draft;
        render();
        showToast("Chat restored");
      } catch (_) { showToast("Undo could not be saved", 5000); }
    }
  });
});

elements.moveForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (elements.confirmMoveButton.disabled) return;
  const targetChatId = elements.moveDestination.value;
  if (!state.chats.some(chat => chat.id === targetChatId)) return;
  elements.confirmMoveButton.disabled = true;
  elements.confirmMoveButton.textContent = "Moving…";
  await moveMessagesToChat(pendingMoveMessageIds, targetChatId);
  elements.moveDialog.close();
});
$("#cancelMoveButton").addEventListener("click", () => elements.moveDialog.close());
elements.moveDialog.addEventListener("close", () => {
  pendingMoveMessageIds = [];
  elements.confirmMoveButton.disabled = false;
  elements.confirmMoveButton.textContent = "Move";
  selectedMessageIds.clear();
  selectedImageIds.clear();
  updateSelectionUi();
});
$("#moveSelectedButton").addEventListener("click", () => openMoveDialog(selectedActionMessageIds()));
$("#openSelectedButton").addEventListener("click", () => {
  const message = state.messages.find(item => item.id === selectedActionMessageIds()[0]);
  if (message) selectChat(message.chatId, message.id);
});
$("#copySelectedButton").addEventListener("click", async () => {
  const count = selectionCount();
  if (selectedImageIds.size > 1 || (selectedImageIds.size && selectedMessageIds.size)) {
    showToast("Copy multiple images separately; browsers cannot reliably place mixed items on the clipboard", 5000);
    return;
  }
  if (selectedImageIds.size === 1) {
    try {
      await copyImageToClipboard([...selectedImageIds][0]);
    } catch (_) { showToast("Image could not be copied", 5000); }
    return;
  }
  const text = SelfChatAppCore.copySelectedText(state.messages, selectedMessageIds, messagePlainText);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (count > 1) showToast(`${count} messages copied`);
  } catch (_) { showToast("Messages could not be copied", 5000); }
});
$("#deleteSelectedButton").addEventListener("click", deleteSelectedMessages);
$("#cancelSelectionButton").addEventListener("click", clearMessageSelection);
$("#cancelReplyButton").addEventListener("click", () => { cancelReply(); elements.messageInput.focus(); });

async function renderRecoveryPoints() {
  elements.recoveryStatus.textContent = "Loading recovery points…";
  elements.recoveryList.innerHTML = "";
  const snapshots = await getRecoverySnapshots().catch(() => null);
  if (!snapshots) {
    elements.recoveryStatus.textContent = "Recovery points are unavailable while the SelfChat server is unreachable.";
    return;
  }
  const recent = snapshots.slice(0, 8);
  elements.recoveryStatus.textContent = recent.length
    ? `Keeping one recovery point per day for up to ${MAX_RECOVERY_SNAPSHOTS} days.`
    : "Your first daily recovery point will appear after the next content change.";
  elements.recoveryList.innerHTML = recent.map(snapshot => {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.createdAt));
    const counts = `${snapshot.messageCount} message${snapshot.messageCount === 1 ? "" : "s"} · ${snapshot.chatCount} chat${snapshot.chatCount === 1 ? "" : "s"}${snapshot.label === "Before restore" ? " · before restore" : ""}`;
    return `<div class="recovery-row"><span><strong>${escapeHtml(date)}</strong><small>${escapeHtml(counts)}</small></span><button type="button" data-restore-snapshot="${escapeHtml(snapshot.id)}">Restore</button></div>`;
  }).join("");
}

async function renderStorageDiagnostics() {
  await refreshServerStatus();
  const status = serverStatus;
  const attachments = Object.keys(attachmentIndex()).length;
  const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
  const exportText = lastExport ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastExport)) : "Never";
  const points = status?.recoveryPoints ?? 0;
  elements.storageDiagnostics.textContent = `Saved on disk by the SelfChat server · ${serverSeq} log record${serverSeq === 1 ? "" : "s"} · ${attachments} attachment${attachments === 1 ? "" : "s"} · ${points} recovery point${points === 1 ? "" : "s"} · Backups: ${status?.backupDir || "unknown"} · Last export: ${exportText}`;
}

function runningAsInstalledApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

async function refreshOfflineAppStatus() {
  if (!("serviceWorker" in navigator)) {
    elements.offlineAppStatus.textContent = "Offline app support is unavailable in this browser.";
  } else {
    const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
    const connection = navigator.onLine ? "online now" : "offline now";
    elements.offlineAppStatus.textContent = registration?.active
      ? `Offline app shell ready · ${connection}`
      : `Offline app shell is not ready yet · ${connection}`;
  }

  const installed = runningAsInstalledApp();
  elements.installAppButton.hidden = installed || !deferredInstallPrompt;
  elements.installAppHelp.textContent = installed
    ? "SelfChat is running as an installed app on this device."
    : deferredInstallPrompt
      ? "Install SelfChat as an app window. Your data stays in the data folder on this PC."
      : "Use this browser’s app or home-screen menu if installation is available.";
}

$("#settingsButton").addEventListener("click", () => {
  elements.settingsDialog.showModal();
  renderTrash();
  renderRecoveryPoints();
  renderStorageDiagnostics();
  refreshOfflineAppStatus();
});
elements.installAppButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return refreshOfflineAppStatus();
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  elements.installAppButton.hidden = true;
  await prompt.prompt();
  await prompt.userChoice.catch(() => null);
  await refreshOfflineAppStatus();
});
elements.backupFolderButton.addEventListener("click", () => {
  elements.backupFolderInput.value = serverStatus?.backupDir || "";
  elements.backupFolderError.hidden = true;
  elements.backupFolderDialog.showModal();
  setTimeout(() => { elements.backupFolderInput.focus(); elements.backupFolderInput.select(); }, 30);
});
$("#cancelBackupFolderButton").addEventListener("click", () => elements.backupFolderDialog.close());
elements.backupFolderForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = elements.backupFolderForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const result = await api("/api/settings/backup-dir", { method: "POST", body: { path: elements.backupFolderInput.value, origin: tabId } });
    acceptRecord(result.record);
    serverStatus = result.status;
    renderDataStatus();
    renderStorageDiagnostics();
    elements.backupFolderDialog.close();
    showToast(result.backup?.verified ? "Backup folder saved · backup written and verified" : "Backup folder saved, but the backup failed — see the data status", 6000);
  } catch (error) {
    elements.backupFolderError.textContent = error.message;
    elements.backupFolderError.hidden = false;
  } finally {
    submit.disabled = false;
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
      await saveState({ deletes: { trash: [item.id] } });
      if (restoredMessage) insertMessageElement(restoredMessage);
      updateReplyPreviews(item.entityId);
      renderChats(); renderTrash();
      renderPinnedMessageBanner();
      updateSavedMessageCount();
      showToast(item.entityType === "chat" ? "Chat restored" : "Message restored");
    } catch (_) { showToast("Item could not be restored", 5000); }
    return;
  }
  if (!await requestConfirmation({
    title: "Delete permanently?",
    message: `Remove “${trashLabel(item).slice(0, 80)}” from Trash? It disappears from SelfChat and from future backups. Its text stays in the data log on this PC and in earlier backup files.`,
    confirmLabel: "Delete permanently"
  })) return;
  try {
    state.trash = state.trash.filter(candidate => candidate.id !== item.id);
    await saveState({ deletes: { trash: [item.id] } });
    updateReplyPreviews(item.entityId);
    renderTrash();
    await renderRecoveryPoints();
    await renderStorageDiagnostics();
    showToast("Deleted from Trash");
  } catch (_) { showToast("Item could not be permanently deleted", 5000); }
});
elements.emptyTrashButton.addEventListener("click", async () => {
  if (!state.trash.length || !await requestConfirmation({
    title: "Empty Trash permanently?",
    message: "Remove every Trash item? They disappear from SelfChat and from future backups. Their text stays in the data log on this PC and in earlier backup files.",
    confirmLabel: "Empty Trash"
  })) return;
  const items = structuredClone(state.trash);
  try {
    state.trash = [];
    await saveState({ deletes: { trash: items.map(item => item.id) } });
    items.forEach(item => updateReplyPreviews(item.entityId));
    renderTrash();
    await renderRecoveryPoints();
    await renderStorageDiagnostics();
    showToast("Trash emptied");
  } catch (_) { showToast("Trash could not be emptied", 5000); }
});
elements.recoveryList.addEventListener("click", async event => {
  const button = event.target.closest("[data-restore-snapshot]");
  if (!button) return;
  let point;
  try {
    const points = await getRecoverySnapshots();
    const listed = points.find(item => item.id === button.dataset.restoreSnapshot);
    if (!listed) return;
    const { state: pointState } = await api(`/api/recovery-points/${encodeURIComponent(listed.id)}`);
    point = { ...listed, state: pointState };
  } catch (_) {
    return showToast("Recovery point could not be loaded", 5000);
  }
  recoveryPreviewSnapshot = point;
  const target = normalizeState(point.state);
  const currentIds = new Set(state.messages.map(message => message.id));
  const targetIds = new Set(target.messages.map(message => message.id));
  const restored = target.messages.filter(message => !currentIds.has(message.id)).length;
  const removed = state.messages.filter(message => !targetIds.has(message.id)).length;
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(point.createdAt));
  elements.recoveryPreviewSummary.textContent = `${date}: ${target.chats.length} chats and ${target.messages.length} messages. Compared with now, ${restored} messages will return and ${removed} newer messages will leave the active view. A new recovery point will preserve the current state.`;
  elements.recoveryPreviewDialog.showModal();
});
$("#cancelRecoveryButton").addEventListener("click", () => elements.recoveryPreviewDialog.close());
$("#confirmRecoveryButton").addEventListener("click", async () => {
  const snapshot = recoveryPreviewSnapshot;
  if (!snapshot) return;
  $("#confirmRecoveryButton").disabled = true;
  try {
    const target = normalizeState(snapshot.state);
    const removedIds = store => {
      const keep = new Set(target[store].map(record => record.id));
      return state[store].filter(record => !keep.has(record.id)).map(record => record.id);
    };
    const deletes = { chats: removedIds("chats"), messages: removedIds("messages"), customStickers: removedIds("customStickers"), trash: removedIds("trash") };
    const activeChatId = state.activeChatId;
    state = normalizeState({ ...target, activeChatId: target.chats.some(chat => chat.id === activeChatId) ? activeChatId : target.chats[0]?.id });
    await saveState({ deletes, label: "restore" });
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
  const link = document.createElement("a");
  link.href = "/api/export";
  link.download = `selfchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  renderStorageDiagnostics();
  showToast("Backup exported");
});
elements.importInput.addEventListener("change", async () => {
  const file = elements.importInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const { report: plan } = await api("/api/import?dryRun=1", { method: "POST", body: text, headers: { "Content-Type": "application/json" } });
    if (!await requestConfirmation({
      title: "Import this backup?",
      message: `Merge ${plan.backup.chats} chats, ${plan.backup.messages} messages, and ${plan.backup.attachments} attachments? Existing records will be kept; matching stable IDs use the newer version.`,
      confirmLabel: "Import backup"
    })) return;
    const { report, seq } = await api("/api/import", { method: "POST", body: text, headers: { "Content-Type": "application/json" } });
    await waitForSeq(seq);
    renderStickerGrid();
    render();
    elements.settingsDialog.close();
    const found = report.verification.found;
    showToast(report.verification.ok
      ? `Backup merged · all ${found.messages} messages, ${found.chats} chats, ${found.attachments} attachments and ${found.trash} Trash items are here`
      : `Backup merged, but some items are missing: ${found.messages}/${report.backup.messages} messages, ${found.attachments}/${report.backup.attachments} attachments`, 8000);
  } catch (error) {
    showToast(error.status === 400 ? "That is not a valid SelfChat backup" : `Import failed: ${error.message}`, 6000);
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
  closeContextMenu();
  contextMessageId = messageElement.dataset.messageId;
  const selectedMessage = state.messages.find(item => item.id === contextMessageId);
  elements.contextMenu.querySelector('[data-action="copy"]').hidden = false;
  elements.contextMenu.querySelector('[data-action="edit"]').hidden = selectedMessage?.type === "sticker";
  elements.contextMenu.querySelector('[data-action="edit"]').textContent = selectedMessage?.type === "image" || selectedMessage?.type === "file" ? "Edit caption" : "Edit";
  elements.contextMenu.querySelector('[data-action="star"]').textContent = selectedMessage?.starredAt ? "Unstar message" : "Star message";
  elements.contextMenu.querySelector('[data-action="pin"]').textContent = selectedMessage?.pinnedAt ? "Unpin message" : "Pin message";
  elements.contextMenu.querySelector('[data-action="title"]').textContent = selectedMessage?.title ? "Rename message" : "Add message title";
  const selectedActions = selectedActionMessageIds();
  elements.contextMenu.querySelector('[data-action="move"]').textContent = selectedActions.length > 1 ? `Move ${selectedActions.length} messages` : "Move";
  elements.contextMenu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
  elements.contextMenu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - 430))}px`;
  elements.contextMenu.hidden = false;
  elements.contextMenu.querySelector("button:not([hidden])")?.focus();
}

function openChatContextMenu(chatId, x, y) {
  const chat = state.chats.find(item => item.id === chatId);
  if (!chat) return;
  closeContextMenu();
  contextChatId = chat.id;
  const button = elements.chatContextMenu.querySelector('[data-chat-action="pin"]');
  button.textContent = chat.pinnedAt ? "Unpin chat" : "Pin chat";
  const ordered = SelfChatAppCore.sortChatsByPinAndActivity(state.chats, state.messages)
    .filter(item => Boolean(item.pinnedAt) === Boolean(chat.pinnedAt));
  const index = ordered.findIndex(item => item.id === chat.id);
  elements.chatContextMenu.querySelector('[data-chat-action="up"]').disabled = index <= 0;
  elements.chatContextMenu.querySelector('[data-chat-action="down"]').disabled = index < 0 || index >= ordered.length - 1;
  elements.chatContextMenu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - 170))}px`;
  elements.chatContextMenu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - 128))}px`;
  elements.chatContextMenu.hidden = false;
  button.focus();
}

elements.splitMessageList.addEventListener("click", async event => {
  const imageCopyButton = event.target.closest("[data-copy-image-id]");
  if (imageCopyButton) {
    event.preventDefault();
    event.stopPropagation();
    imageCopyButton.disabled = true;
    try { await copyImageToClipboard(imageCopyButton.dataset.copyImageId); }
    catch (_) { showToast("Image could not be copied", 5000); }
    finally { if (imageCopyButton.isConnected) imageCopyButton.disabled = false; }
    return;
  }
  const codeButton = event.target.closest("[data-copy-code-index]");
  if (codeButton) {
    const article = codeButton.closest("[data-message-id]");
    const message = state.messages.find(item => item.id === article?.dataset.messageId);
    const code = codeBlocksFor(message)[Number(codeButton.dataset.copyCodeIndex)]?.code;
    if (code != null) navigator.clipboard.writeText(code).then(() => showToast("Code copied")).catch(() => showToast("Code could not be copied", 5000));
    return;
  }
  const image = event.target.closest(".message-media");
  if (image) {
    const id = image.closest("[data-message-id]")?.dataset.messageId;
    await openSplitAsPrimary(id);
    if (id) openImageViewer(id);
    return;
  }
  const quote = event.target.closest(".reply-quote");
  if (quote?.dataset.replyStatus === "available") await openSplitAsPrimary(quote.dataset.replyOriginalId);
});

elements.messageList.addEventListener("click", async event => {
  if (suppressMessageClick) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const hideGlobalChatButton = event.target.closest("[data-hide-global-chat-id]");
  if (hideGlobalChatButton) {
    event.preventDefault();
    event.stopPropagation();
    await setGlobalChatHidden(hideGlobalChatButton.dataset.hideGlobalChatId, true);
    return;
  }
  const imageCopyButton = event.target.closest("[data-copy-image-id]");
  if (imageCopyButton) {
    event.preventDefault();
    event.stopPropagation();
    imageCopyButton.disabled = true;
    try { await copyImageToClipboard(imageCopyButton.dataset.copyImageId); }
    catch (_) { showToast("Image could not be copied", 5000); }
    finally { if (imageCopyButton.isConnected) imageCopyButton.disabled = false; }
    return;
  }
  if (globalViewOpen) {
    const article = event.target.closest("[data-message-id]");
    if (!article || event.target.closest("a")) return;
    if (!event.target.closest("[data-copy-code-index], [data-toggle-message-collapse]")) {
      event.preventDefault();
      selectMessageFromClick(article.dataset.messageId, event);
      return;
    }
  }
  const codeButton = event.target.closest("[data-copy-code-index]");
  if (codeButton) {
    const article = codeButton.closest("[data-message-id]");
    const message = state.messages.find(item => item.id === article?.dataset.messageId);
    const code = codeBlocksFor(message)[Number(codeButton.dataset.copyCodeIndex)]?.code;
    if (code != null) navigator.clipboard.writeText(code).then(() => showToast("Code copied")).catch(() => showToast("Code could not be copied", 5000));
    return;
  }
  const collapseButton = event.target.closest("[data-toggle-message-collapse]");
  if (collapseButton) {
    const article = collapseButton.closest("[data-message-id]");
    const id = article?.dataset.messageId;
    if (!id) return;
    if (expandedMessageIds.has(id)) expandedMessageIds.delete(id); else expandedMessageIds.add(id);
    const expanded = expandedMessageIds.has(id);
    article.classList.toggle("message-expanded", expanded);
    collapseButton.textContent = expanded ? "Show less" : "Read more";
    return;
  }
  const messageArticle = event.target.closest("[data-message-id]");
  const copyTrigger = event.target.closest(".message-copy-trigger");
  if (copyTrigger) {
    event.preventDefault();
    event.stopPropagation();
    const message = state.messages.find(item => item.id === messageArticle?.dataset.messageId);
    if (!message) return;
    navigator.clipboard.writeText(messagePlainText(message)).then(() => {
      copyTrigger.classList.add("copied");
      copyTrigger.setAttribute("aria-label", "Message copied");
      copyTrigger.title = "Copied";
      setTimeout(() => {
        if (!copyTrigger.isConnected) return;
        copyTrigger.classList.remove("copied");
        copyTrigger.setAttribute("aria-label", "Copy message");
        copyTrigger.title = "Copy message";
      }, 1400);
    }).catch(() => showToast("Message could not be copied", 5000));
    return;
  }
  if (hasSelection() && messageArticle && !event.target.closest(".message-menu-trigger")) {
    selectMessageFromClick(messageArticle.dataset.messageId, event);
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
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      selectMessageFromClick(messageElement?.dataset.messageId, event);
      return;
    }
    openImageViewer(messageElement?.dataset.messageId);
    return;
  }
  if (messageArticle && !event.target.closest(".message-menu-trigger")) {
    selectMessageFromClick(messageArticle.dataset.messageId, event);
    return;
  }
  const trigger = event.target.closest(".message-menu-trigger");
  if (!trigger) return;
  const message = trigger.closest("[data-message-id]");
  const rect = trigger.getBoundingClientRect();
  openMessageContextMenu(message, rect.right - 150, rect.bottom + 4);
  event.stopPropagation();
});
elements.messageList.addEventListener("keydown", event => {
  if (!globalViewOpen || !["Enter", " "].includes(event.key)) return;
  const article = event.target.closest("[data-message-id]");
  const message = state.messages.find(item => item.id === article?.dataset.messageId);
  if (!message) return;
  event.preventDefault();
  selectChat(message.chatId, message.id);
});
elements.messageList.addEventListener("contextmenu", event => {
  if (globalViewOpen) return;
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
  if (!event.target.closest("#messageContextMenu, #chatContextMenu")) closeContextMenu();
});
elements.chatContextMenu.addEventListener("click", event => {
  const action = event.target.dataset.chatAction;
  const chatId = contextChatId;
  if (!chatId || event.target.disabled) return;
  if (action === "pin") toggleChatPinned(chatId);
  if (action === "up") moveChatByOffset(chatId, -1);
  if (action === "down") moveChatByOffset(chatId, 1);
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
  if (action === "copy-link") await copyDirectMessageLink(message.id);
  if (action === "star") await toggleMessageFlag(message.id, "starredAt");
  if (action === "pin") await toggleMessageFlag(message.id, "pinnedAt");
  if (action === "title") openMessageTitleDialog(message);
  if (action === "tags") openMessageTagsDialog(message);
  if (action === "duplicate") await duplicateMessage(message.id);
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
    const selectedIds = selectedActionMessageIds();
    const ids = selectedIds.includes(message.id) ? selectedIds : [message.id];
    closeContextMenu();
    openMoveDialog(ids);
  }
  if (action === "delete") {
    closeContextMenu();
    await deleteMessagesWithUndo([message.id]);
  }
});

elements.storageRetryButton.addEventListener("click", () => location.reload());
elements.storageScreen.addEventListener("keydown", event => {
  if (event.key === "Escape") event.preventDefault();
});
document.addEventListener("keydown", event => {
  if (!globalViewOpen && !event.repeat && event.ctrlKey && event.altKey && event.shiftKey && event.key.toLocaleLowerCase() === "p" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    toggleChatPinned(state.activeChatId);
    return;
  }
  if (!event.repeat && event.ctrlKey && !event.altKey && !event.shiftKey && ["[", "]"].includes(event.key) && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    switchChatByOffset(event.key === "]" ? 1 : -1);
    return;
  }
  if (!event.repeat && event.ctrlKey && !event.altKey && !event.shiftKey && /^[1-9]$/.test(event.key) && !document.querySelector("dialog[open]")) {
    const chat = SelfChatAppCore.sortChatsByPinAndActivity(state.chats, state.messages)[Number(event.key) - 1];
    if (chat) { event.preventDefault(); selectChat(chat.id); }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    elements.chatFilterInput.focus();
    elements.chatFilterInput.select();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f" && !document.querySelector("dialog[open]")) {
    if (globalViewOpen) return;
    event.preventDefault();
    $("#messageSearchButton").click();
    return;
  }
  if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (cancelMessageDrag()) {
    event.preventDefault();
    return;
  }
  if (!elements.contextMenu.hidden || !elements.chatContextMenu.hidden) {
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
  if (hasSelection()) {
    event.preventDefault();
    clearMessageSelection();
  }
});
window.addEventListener("hashchange", () => openLinkedMessageFromLocation());
window.addEventListener("pagehide", () => {
  flushDraftsOnExit();
  eventSource?.close();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden" || appBlocked) return;
  clearTimeout(draftSaveTimer);
  void saveState().catch(() => {});
});

async function startApp() {
  if (!await loadFromServer()) return;
  restoreSplitView();
  renderStickerGrid();
  render();
  elements.messageInput.value = state.drafts[state.activeChatId] || "";
  resizeComposer();
  updateComposerState();
  await openLinkedMessageFromLocation();
  elements.messageInput.focus();
  setInterval(() => { if (!appBlocked && document.visibilityState === "visible") void refreshServerStatus(); }, 60000);
}

startApp();

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  void refreshOfflineAppStatus();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  void refreshOfflineAppStatus();
});
window.addEventListener("online", () => void refreshOfflineAppStatus());
window.addEventListener("offline", () => void refreshOfflineAppStatus());

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(async registration => {
        await registration.update().catch(() => {});
        await refreshOfflineAppStatus();
      })
      .catch(error => console.error("Service worker registration failed", error));
  });
}
