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
  const messages = [];
  const save = deferred();
  const send = core.createTextSendController({
    getInput: () => input,
    setInput: value => { input = value; },
    getChatId: () => "topic",
    createId: () => "message-1",
    now: () => "2026-11-13T12:00:00.000Z",
    addOptimistic: message => messages.push(message),
    persist: () => save.promise,
    rollback: message => messages.splice(messages.findIndex(item => item.id === message.id), 1)
  });
  return { send, save, messages, getInput: () => input, setInput: value => { input = value; } };
}

test("double Enter sends a cleared composer only once", async () => {
  const harness = sendHarness();
  const first = harness.send();
  const second = await harness.send();
  assert.equal(harness.getInput(), "");
  assert.equal(harness.messages.length, 1);
  assert.equal(second, false);
  harness.save.resolve();
  assert.equal(await first, true);
});

test("text typed during a slow save survives completion", async () => {
  const harness = sendHarness();
  const sending = harness.send();
  harness.setInput("typed while saving");
  harness.save.resolve();
  assert.equal(await sending, true);
  assert.equal(harness.getInput(), "typed while saving");
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
