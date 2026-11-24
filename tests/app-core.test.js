const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../app-core.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function sendHarness() {
  let input = "hello";
  const shown = [];
  const failures = [];
  const save = deferred();
  const send = core.createTextSendController({
    getInput: () => input,
    setInput: value => { input = value; },
    getChatId: () => "topic",
    createId: () => "message-1",
    now: () => "2026-11-13T12:00:00.000Z",
    persist: () => save.promise,
    onSaved: message => shown.push(message),
    onFailure: error => failures.push(error)
  });
  return { send, save, shown, failures, getInput: () => input, setInput: value => { input = value; } };
}

test("the composer keeps the text and nothing is shown until the server saves it", async () => {
  const harness = sendHarness();
  const sending = harness.send();
  assert.equal(harness.getInput(), "hello");
  assert.equal(harness.shown.length, 0);
  harness.save.resolve();
  assert.equal(await sending, true);
  assert.equal(harness.getInput(), "");
  assert.equal(harness.shown.length, 1);
});

test("double Enter while saving sends only once", async () => {
  const harness = sendHarness();
  const first = harness.send();
  const second = await harness.send();
  assert.equal(second, false);
  harness.save.resolve();
  assert.equal(await first, true);
  assert.equal(harness.shown.length, 1);
});

test("a failed save leaves the text in the composer and shows nothing", async () => {
  const harness = sendHarness();
  const sending = harness.send();
  harness.save.reject(new Error("server unreachable"));
  assert.equal(await sending, false);
  assert.equal(harness.getInput(), "hello");
  assert.equal(harness.shown.length, 0);
  assert.equal(harness.failures.length, 1);
});

test("text typed during a slow save survives completion", async () => {
  const harness = sendHarness();
  const sending = harness.send();
  harness.setInput("typed while saving");
  harness.save.resolve();
  assert.equal(await sending, true);
  assert.equal(harness.getInput(), "typed while saving");
});

test("text appended during a slow save stays after the sent part is removed", async () => {
  const harness = sendHarness();
  const sending = harness.send();
  harness.setInput("hello\nmore");
  harness.save.resolve();
  assert.equal(await sending, true);
  assert.equal(harness.getInput(), "more");
});

test("pinned chats stay above unpinned chats while each group follows latest activity", () => {
  const chats = [
    { id: "old-pinned", createdAt: "2026-11-10T10:00:00.000Z", pinnedAt: "2026-11-14T10:00:00.000Z" },
    { id: "recent", createdAt: "2026-11-13T10:00:00.000Z" },
    { id: "recent-pinned", createdAt: "2026-11-11T10:00:00.000Z", pinnedAt: "2026-11-12T10:00:00.000Z" },
    { id: "quiet", createdAt: "2026-11-09T10:00:00.000Z" }
  ];
  const messages = [
    { id: "m1", chatId: "old-pinned", createdAt: "2026-11-12T12:00:00.000Z" },
    { id: "m2", chatId: "recent-pinned", createdAt: "2026-11-14T12:00:00.000Z" },
    { id: "m3", chatId: "recent", createdAt: "2026-11-14T13:00:00.000Z" }
  ];
  assert.deepEqual(core.sortChatsByPinAndActivity(chats, messages).map(chat => chat.id), [
    "recent-pinned", "old-pinned", "recent", "quiet"
  ]);
});

test("global messages are chronological and group only uninterrupted chat runs", () => {
  const chats = [{ id: "nba" }, { id: "ai" }];
  const messages = [
    { id: "m4", chatId: "nba", createdAt: "2026-11-14T12:04:00.000Z" },
    { id: "m2", chatId: "nba", createdAt: "2026-11-14T12:02:00.000Z" },
    { id: "m3", chatId: "ai", createdAt: "2026-11-14T12:03:00.000Z" },
    { id: "m1", chatId: "nba", createdAt: "2026-11-14T12:01:00.000Z" }
  ];
  assert.deepEqual(core.groupGlobalMessages(chats, messages).map(group => ({
    chatId: group.chatId,
    messageIds: group.messages.map(message => message.id)
  })), [
    { chatId: "nba", messageIds: ["m1", "m2"] },
    { chatId: "ai", messageIds: ["m3"] },
    { chatId: "nba", messageIds: ["m4"] }
  ]);
});

test("global messages exclude records whose chat is no longer active", () => {
  const groups = core.groupGlobalMessages([{ id: "active" }], [
    { id: "live", chatId: "active", createdAt: "2026-11-14T12:00:00.000Z" },
    { id: "deleted", chatId: "trashed-chat", createdAt: "2026-11-14T12:01:00.000Z" }
  ]);
  assert.deepEqual(groups.map(group => group.messages.map(message => message.id)), [["live"]]);
});

test("global messages exclude every run from hidden chats without changing chronology", () => {
  const chats = [{ id: "nba" }, { id: "ai" }, { id: "soccer" }];
  const messages = [
    { id: "m4", chatId: "nba", createdAt: "2026-11-14T12:04:00.000Z" },
    { id: "m2", chatId: "ai", createdAt: "2026-11-14T12:02:00.000Z" },
    { id: "m3", chatId: "soccer", createdAt: "2026-11-14T12:03:00.000Z" },
    { id: "m1", chatId: "nba", createdAt: "2026-11-14T12:01:00.000Z" }
  ];
  const groups = core.groupGlobalMessages(chats, messages, new Set(["nba"]));
  assert.deepEqual(groups.map(group => ({
    chatId: group.chatId,
    messageIds: group.messages.map(message => message.id)
  })), [
    { chatId: "ai", messageIds: ["m2"] },
    { chatId: "soccer", messageIds: ["m3"] }
  ]);
});

test("pinning and unpinning update the chat merge timestamp", () => {
  const chat = { id: "topic", createdAt: "2026-11-10T10:00:00.000Z" };
  core.setChatPinned(chat, true, "2026-11-14T10:00:00.000Z");
  assert.equal(chat.pinnedAt, "2026-11-14T10:00:00.000Z");
  assert.equal(chat.updatedAt, "2026-11-14T10:00:00.000Z");
  core.setChatPinned(chat, false, "2026-11-14T11:00:00.000Z");
  assert.equal(chat.pinnedAt, undefined);
  assert.equal(chat.updatedAt, "2026-11-14T11:00:00.000Z");
});

test("chat notes normalize line endings, clear cleanly, and update merge metadata", () => {
  const chat = { id: "topic", createdAt: "2026-11-10T10:00:00.000Z" };
  core.setChatNote(chat, "Plan\r\n- Ship split view", "2026-11-14T12:00:00.000Z");
  assert.equal(chat.note, "Plan\n- Ship split view");
  assert.equal(chat.noteUpdatedAt, "2026-11-14T12:00:00.000Z");
  assert.equal(chat.updatedAt, "2026-11-14T12:00:00.000Z");
  core.setChatNote(chat, "   ", "2026-11-14T13:00:00.000Z");
  assert.equal(chat.note, undefined);
  assert.equal(chat.updatedAt, "2026-11-14T13:00:00.000Z");
});

test("split view chooses a different available chat and repairs stale choices", () => {
  const chats = [{ id: "nba" }, { id: "ai" }, { id: "soccer" }];
  assert.equal(core.resolveSplitChatId(chats, "nba", "soccer"), "soccer");
  assert.equal(core.resolveSplitChatId(chats, "nba", "missing"), "ai");
  assert.equal(core.resolveSplitChatId([{ id: "nba" }], "nba", "ai"), null);
});

test("manual chat order persists within pin groups without crossing the boundary", () => {
  const chats = [
    { id: "p1", pinnedAt: "pin", createdAt: "2026-11-10" },
    { id: "p2", pinnedAt: "pin", createdAt: "2026-11-11" },
    { id: "a", createdAt: "2026-11-12" },
    { id: "b", createdAt: "2026-11-13" },
    { id: "c", createdAt: "2026-11-14" }
  ];
  assert.equal(core.reorderChat(chats, [], "a", "c", "before", "now").length, 3);
  assert.deepEqual(core.sortChatsByPinAndActivity(chats, []).map(chat => chat.id), ["p2", "p1", "a", "c", "b"]);
  assert.deepEqual(core.reorderChat(chats, [], "a", "p1", "before", "later"), []);
  assert.equal(core.moveChatByOffset(chats, [], "b", -1, "later").length > 0, true);
  assert.deepEqual(core.sortChatsByPinAndActivity(chats, []).map(chat => chat.id), ["p2", "p1", "a", "b", "c"]);
});

test("new unranked chats appear first inside an already manually ordered group", () => {
  const chats = [
    { id: "a", orderIndex: 0, createdAt: "2026-11-12" },
    { id: "b", orderIndex: 1, createdAt: "2026-11-13" },
    { id: "new", createdAt: "2026-11-14" }
  ];
  assert.deepEqual(core.sortChatsByPinAndActivity(chats, []).map(chat => chat.id), ["new", "a", "b"]);
});

test("message stars and pins update merge metadata and can be removed independently", () => {
  const message = { id: "m1", createdAt: "2026-11-14T10:00:00.000Z" };
  core.setMessageFlag(message, "starredAt", true, "2026-11-14T11:00:00.000Z");
  core.setMessageFlag(message, "pinnedAt", true, "2026-11-14T12:00:00.000Z");
  assert.equal(message.starredAt, "2026-11-14T11:00:00.000Z");
  assert.equal(message.pinnedAt, "2026-11-14T12:00:00.000Z");
  assert.equal(message.updatedAt, "2026-11-14T12:00:00.000Z");
  core.setMessageFlag(message, "starredAt", false, "2026-11-14T13:00:00.000Z");
  assert.equal(message.starredAt, undefined);
  assert.equal(message.pinnedAt, "2026-11-14T12:00:00.000Z");
  assert.equal(core.setMessageFlag(message, "unsupported", true, "later"), null);
});

test("message retrieval filters combine query, type, links, and inclusive dates", () => {
  const text = { id: "text", text: "Launch notes https://example.com", createdAt: "2026-11-14T10:00:00.000Z" };
  const image = { id: "image", type: "image", caption: "Launch board", createdAt: "2026-11-13T10:00:00.000Z" };
  assert.equal(core.messageMatchesFilters(text, { query: "launch", type: "link", dateFrom: "2026-11-14", dateTo: "2026-11-14" }), true);
  assert.equal(core.messageMatchesFilters(text, { type: "image" }), false);
  assert.equal(core.messageMatchesFilters(image, { query: "launch", type: "image", dateFrom: "2026-11-13", dateTo: "2026-11-13" }), true);
  assert.equal(core.messageMatchesFilters(image, { type: "image", dateFrom: "2026-11-14" }), false);
});

test("date filtering uses the same local calendar day shown in the conversation", () => {
  const message = { id: "late", text: "Late note", createdAt: "2026-11-09T02:30:00.000Z" };
  const date = new Date(message.createdAt);
  const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  assert.equal(core.messageMatchesFilters(message, { dateFrom: localDay, dateTo: localDay }), true);
});

test("fenced code parsing preserves prose, language, code, and unterminated text", () => {
  assert.deepEqual(core.parseFencedCode("Before\n```js\nconst x = 1;\n```\nAfter"), [
    { type: "text", text: "Before\n" },
    { type: "code", language: "js", code: "const x = 1;" },
    { type: "text", text: "\nAfter" }
  ]);
  assert.deepEqual(core.parseFencedCode("```not closed"), [{ type: "text", text: "```not closed" }]);
});

test("message tags normalize and participate in retrieval filters", () => {
  assert.deepEqual(core.normalizeMessageTags(" Work, #ideas, work, , very-long-tag-name-that-is-truncated "), ["Work", "ideas", "very-long-tag-name-that-"]);
  const message = { text: "note", tags: ["Work"], createdAt: "2026-11-14" };
  assert.equal(core.messageMatchesFilters(message, { tag: "work" }), true);
  assert.equal(core.messageMatchesFilters(message, { tag: "personal" }), false);
});

test("message duplication preserves reusable content but clears history and transient markers", () => {
  const original = { id: "old", chatId: "a", text: "reuse", title: "Template", tags: ["work"], createdAt: "old", editedAt: "edit", updatedAt: "update", movedAt: "move", editHistory: [{}], starredAt: "star", pinnedAt: "pin", replyToId: "reply", replyPreview: "preview" };
  assert.deepEqual(core.duplicateMessage(original, "new", "now"), {
    id: "new", chatId: "a", text: "reuse", title: "Template", tags: ["work"], createdAt: "now", editedAt: null
  });
});

test("Undo restores a deleted message and removes its Trash record", () => {
  const message = { id: "m1", chatId: "topic", text: "keep", createdAt: "2026-11-13T12:00:00.000Z" };
  const state = { messages: [message], trash: [], deletedMessageIds: [] };
  const token = core.moveMessagesToTrash(state, [message.id], "2026-11-13T12:01:00.000Z");
  assert.equal(state.messages.length, 0);
  assert.equal(state.trash[0].entityId, message.id);
  const restored = core.undoMessagesToTrash(state, token);
  assert.deepEqual(restored, [message]);
  assert.deepEqual(state.messages, [message]);
  assert.equal(state.trash.length, 0);
  assert.equal(state.deletedMessageIds.includes(message.id), false);
});

test("moveMessages moves the requested records once and preserves identity and creation dates", () => {
  const first = { id: "m1", chatId: "from", text: "first", createdAt: "2026-11-13T12:00:00.000Z" };
  const second = { id: "m2", chatId: "from", text: "second", createdAt: "2026-11-13T12:01:00.000Z" };
  const state = { chats: [{ id: "from" }, { id: "to" }], messages: [first, second] };
  const moved = core.moveMessages(state, [first.id, first.id, "missing"], "to", "2026-11-13T12:02:00.000Z");
  assert.deepEqual(moved, [first]);
  assert.equal(first.id, "m1");
  assert.equal(first.createdAt, "2026-11-13T12:00:00.000Z");
  assert.equal(first.chatId, "to");
  assert.equal(first.movedAt, "2026-11-13T12:02:00.000Z");
  assert.equal(second.chatId, "from");
  assert.deepEqual(core.moveMessages(state, [first.id], "to", "later"), []);
});

test("moveMessages rejects an unavailable destination without changing messages", () => {
  const message = { id: "m1", chatId: "from", createdAt: "2026-11-13T12:00:00.000Z" };
  const state = { chats: [{ id: "from" }], messages: [message] };
  assert.deepEqual(core.moveMessages(state, [message.id], "missing", "2026-11-13T12:01:00.000Z"), []);
  assert.equal(message.chatId, "from");
  assert.equal(message.movedAt, undefined);
});

test("reply keeps a preview when its original is permanently deleted", () => {
  const reply = { id: "r1", chatId: "topic", text: "response", replyToId: "m1", replyPreview: "original text" };
  const state = { messages: [reply], trash: [] };
  assert.deepEqual(core.resolveReply(state, reply), {
    id: "m1", chatId: null, text: "original text", status: "deleted"
  });
});

test("reply resolution follows an edited, moved, or trashed original", () => {
  const reply = { id: "r1", chatId: "topic", text: "response", replyToId: "m1", replyPreview: "old text" };
  const original = { id: "m1", chatId: "topic", text: "edited text", editedAt: "2026-11-13T12:01:00.000Z" };
  const state = { messages: [original, reply], trash: [] };
  assert.equal(core.resolveReply(state, reply).text, "edited text");
  original.chatId = "elsewhere";
  assert.equal(core.resolveReply(state, reply).status, "moved");
  state.messages = [reply];
  state.trash = [{ entityType: "message", entityId: "m1", payload: { message: original } }];
  assert.deepEqual(core.resolveReply(state, reply), {
    id: "m1", chatId: "elsewhere", text: "edited text", status: "trashed"
  });
});

test("copy selected returns clean message text in chronological order", () => {
  const messages = [
    { id: "later", createdAt: "2026-11-13T12:02:00.000Z", type: "file", fileName: "notes.pdf" },
    { id: "first", createdAt: "2026-11-13T12:00:00.000Z", text: "First line" },
    { id: "middle", createdAt: "2026-11-13T12:01:00.000Z", text: "Second line" }
  ];
  assert.equal(core.copySelectedText(messages, ["later", "first", "middle"]), "First line\n\nSecond line\n\nnotes.pdf");
});

test("message copy text preserves newlines and links without changing attachment semantics", () => {
  assert.equal(core.messagePlainText({ text: "First line\nSecond line\nhttps://example.com/path?q=1" }), "First line\nSecond line\nhttps://example.com/path?q=1");
  assert.equal(core.messagePlainText({ type: "image", imageName: "photo.png", caption: "Image caption" }), "Image caption");
  assert.equal(core.messagePlainText({ type: "file", fileName: "notes.pdf" }), "notes.pdf");
  assert.equal(core.messagePlainText({ type: "sticker" }, "Thumbs up"), "Thumbs up");
});

test("attachment batch creates image and file messages with one reply binding", () => {
  let nextId = 0;
  const image = { name: "shot.png", type: "image/png", size: 12 };
  const file = { name: "notes.pdf", type: "application/pdf", size: 34 };
  const batch = core.createAttachmentBatch([image, file], {
    chatId: "topic",
    caption: "context",
    reply: { replyToId: "original", replyPreview: "quoted" },
    createId: () => `id-${++nextId}`,
    now: () => Date.parse("2026-11-13T12:00:00.000Z")
  });
  assert.deepEqual(batch.attachments.map(record => ({ id: record.id, name: record.name })), [
    { id: "id-1", name: "shot.png" },
    { id: "id-3", name: "notes.pdf" }
  ]);
  assert.deepEqual(batch.messages[0], {
    id: "id-2", chatId: "topic", caption: "context", createdAt: "2026-11-13T12:00:00.000Z", editedAt: null,
    replyToId: "original", replyPreview: "quoted", type: "image", imageId: "id-1", imageName: "shot.png", imageType: "image/png"
  });
  assert.deepEqual(batch.messages[1], {
    id: "id-4", chatId: "topic", caption: "", createdAt: "2026-11-13T12:00:00.001Z", editedAt: null,
    type: "file", attachmentId: "id-3", fileName: "notes.pdf", fileType: "application/pdf", fileSize: 34
  });
});
