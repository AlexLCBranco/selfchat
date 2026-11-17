const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../storage-core.js");

const fallback = { activeChatId: "unsorted", chats: [], messages: [], customStickers: [], deletedChatIds: [], deletedMessageIds: [], drafts: {} };

test("migration operations replay without duplicates", () => {
  const source = core.normalizeState({
    activeChatId: "topic",
    chats: [{ id: "topic", name: "Topic", emoji: "T", createdAt: "2026-01-02T00:00:00.000Z" }],
    messages: [{ id: "m1", chatId: "topic", text: "hello", createdAt: "2026-01-02T00:00:01.000Z" }],
    customStickers: [], deletedChatIds: [], deletedMessageIds: [], drafts: { topic: "draft" }
  }, fallback);
  const operations = core.migrationOperations(source);
  const replayed = core.replayOperations([...operations, ...operations], fallback);
  assert.equal(replayed.chats.filter(chat => chat.id === "topic").length, 1);
  assert.equal(replayed.messages.filter(message => message.id === "m1").length, 1);
  assert.equal(replayed.drafts.topic, "draft");
});

test("merge is additive and missing records never delete", () => {
  const current = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A", createdAt: "2026-01-01" }], messages: [{ id: "m1", chatId: "a", text: "one", createdAt: "2026-01-01" }] }, fallback);
  const imported = core.normalizeState({ activeChatId: "b", chats: [{ id: "b", name: "B", createdAt: "2026-01-02" }], messages: [{ id: "m2", chatId: "b", text: "two", createdAt: "2026-01-02" }] }, fallback);
  const merged = core.mergeStates([current, imported], current, fallback);
  assert.deepEqual(new Set(merged.messages.map(message => message.id)), new Set(["m1", "m2"]));
  assert.deepEqual(new Set(merged.chats.map(chat => chat.id)), new Set(["unsorted", "a", "b"]));
});

test("repeated merge remains idempotent", () => {
  const imported = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A", createdAt: "2026-01-01" }], messages: [{ id: "m1", chatId: "a", text: "one", createdAt: "2026-01-01" }] }, fallback);
  const once = core.mergeStates([core.normalizeState({}, fallback), imported], imported, fallback);
  const twice = core.mergeStates([once, imported], once, fallback);
  assert.equal(twice.messages.length, once.messages.length);
  assert.equal(twice.chats.length, once.chats.length);
});

test("validation catches broken references and missing attachments", () => {
  const state = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A", createdAt: "2026-01-01" }], messages: [{ id: "m1", chatId: "a", type: "image", imageId: "missing", createdAt: "2026-01-01" }] }, fallback);
  const result = core.validateState(state, new Set());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /unavailable image/);
});

test("validation reports a missing custom chat avatar", () => {
  const state = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A", avatarImageId: "avatar-missing" }], messages: [] }, fallback);
  const result = core.validateState(state, new Set());
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingAttachments, [{ entityType: "chat", entityId: "a", attachmentId: "avatar-missing" }]);
});

test("migration validation can preserve structurally valid messages while attachments await repair", () => {
  const state = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A" }], messages: [{ id: "m1", chatId: "a", type: "image", imageId: "missing" }] }, fallback);
  const result = core.validateState(state, new Set(), { allowMissingAttachments: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingAttachments, [{ entityType: "message", entityId: "m1", imageId: "missing" }]);
});

test("interrupted replay can restart from the same deterministic log", () => {
  const state = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A", createdAt: "2026-01-01" }], messages: [{ id: "m1", chatId: "a", text: "one", createdAt: "2026-01-01" }] }, fallback);
  const operations = core.migrationOperations(state);
  const interrupted = core.replayOperations(operations.slice(0, 1), fallback);
  assert.equal(interrupted.messages.length, 0);
  const retried = core.replayOperations(operations, fallback);
  assert.equal(retried.messages.length, 1);
});

function baseOperations() {
  const chat = { id: "a", name: "A", emoji: "A", createdAt: "2026-01-01T00:00:00.000Z" };
  const message = { id: "m1", chatId: "a", text: "one", createdAt: "2026-01-01T00:00:01.000Z", editHistory: [{ text: "old", editedAt: "2026-01-01T00:00:00.500Z" }] };
  return {
    chat, message,
    operations: [
      { id: "chat-a", type: "chat.upsert", entityId: "a", payload: chat, createdAt: chat.createdAt },
      { id: "message-m1", type: "message.upsert", entityId: "m1", payload: message, createdAt: message.createdAt }
    ]
  };
}

test("message moves preserve IDs and creation dates and remain idempotent", () => {
  const { message, operations } = baseOperations();
  const moved = { ...message, chatId: "unsorted" };
  const move = { id: "move-m1", type: "message.move", entityId: "m1", payload: moved, createdAt: "2026-01-02" };
  const result = core.replayOperations([...operations, move, move], fallback);
  assert.equal(result.messages[0].id, "m1");
  assert.equal(result.messages[0].chatId, "unsorted");
  assert.equal(result.messages[0].createdAt, message.createdAt);
});

test("message Trash retains content, metadata, history and restores to original chat", () => {
  const { message, operations } = baseOperations();
  const deletion = { id: "delete-m1", type: "message.delete", entityId: "m1", createdAt: "2026-01-03", payload: { message, originalChatId: "a" } };
  const trashed = core.replayOperations([...operations, deletion], fallback);
  assert.equal(trashed.messages.length, 0);
  assert.deepEqual(trashed.trash[0].payload.message, message);
  const restore = { id: "restore-m1", type: "message.restore", entityId: "m1", createdAt: "2026-01-04", payload: { message, targetChatId: "a" } };
  const restored = core.replayOperations([...operations, deletion, restore, restore], fallback);
  assert.equal(restored.messages.filter(item => item.id === "m1").length, 1);
  assert.equal(restored.messages[0].chatId, "a");
  assert.equal(restored.trash.length, 0);
});

test("message restore can target Unsorted when its original chat is gone", () => {
  const { message, operations } = baseOperations();
  const deleteMessage = { id: "delete-m1", type: "message.delete", entityId: "m1", createdAt: "2026-01-03", payload: { message, originalChatId: "a" } };
  const deleteChat = { id: "delete-a", type: "chat.delete", entityId: "a", createdAt: "2026-01-04", payload: { chat: operations[0].payload, messages: [] } };
  const restore = { id: "restore-m1", type: "message.restore", entityId: "m1", createdAt: "2026-01-05", payload: { message, targetChatId: "unsorted" } };
  const result = core.replayOperations([...operations, deleteMessage, deleteChat, restore], fallback);
  assert.equal(result.messages[0].chatId, "unsorted");
});

test("chat Trash and restore recover messages once without duplicates", () => {
  const { chat, message, operations } = baseOperations();
  const deletion = { id: "delete-a", type: "chat.delete", entityId: "a", createdAt: "2026-01-03", payload: { chat, messages: [message], draft: "draft" } };
  const restore = { id: "restore-a", type: "chat.restore", entityId: "a", createdAt: "2026-01-04", payload: { chat, messages: [message], draft: "draft" } };
  const trashed = core.replayOperations([...operations, deletion], fallback);
  assert.equal(trashed.chats.some(item => item.id === "a"), false);
  assert.equal(trashed.trash[0].payload.messages.length, 1);
  const restored = core.replayOperations([...operations, deletion, restore, restore], fallback);
  assert.equal(restored.chats.filter(item => item.id === "a").length, 1);
  assert.equal(restored.messages.filter(item => item.id === "m1").length, 1);
  assert.equal(restored.drafts.a, "draft");
});

test("permanent deletion and Empty Trash require explicit operations", () => {
  const { message, operations } = baseOperations();
  const deletion = { id: "delete-m1", type: "message.delete", entityId: "m1", createdAt: "2026-01-03", payload: { message } };
  const purge = { id: "purge-m1", type: "message.purge", entityId: "m1", createdAt: "2026-01-04", payload: {} };
  assert.equal(core.replayOperations([...operations, deletion], fallback).trash.length, 1);
  assert.equal(core.replayOperations([...operations, deletion, purge, purge], fallback).trash.length, 0);
  const empty = { id: "empty", type: "trash.empty", entityId: "trash", createdAt: "2026-01-05", payload: {} };
  assert.equal(core.replayOperations([...operations, deletion, empty], fallback).trash.length, 0);
});

test("attachment references include live, Trash, stickers, and recovery states", () => {
  const ids = core.referencedAttachmentIds({
    chats: [{ id: "live-chat", avatarImageId: "live-avatar" }],
    messages: [{ imageId: "live" }, { attachmentId: "live-file" }], customStickers: [{ imageId: "sticker" }],
    trash: [{ payload: { chat: { avatarImageId: "trash-avatar" }, message: { imageId: "trash-message" }, messages: [{ imageId: "trash-chat" }] } }]
  }, [{ chats: [{ id: "old-chat", avatarImageId: "recovery-avatar" }], messages: [{ imageId: "recovery" }] }]);
  assert.deepEqual(ids, new Set(["live-avatar", "live", "live-file", "sticker", "trash-avatar", "trash-message", "trash-chat", "recovery-avatar", "recovery"]));
});

test("targeted erasure redacts live, Trash, tombstone, draft, and chat payload state", () => {
  const state = core.normalizeState({
    activeChatId: "a",
    chats: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    messages: [{ id: "m1", chatId: "a", text: "erase" }, { id: "m2", chatId: "b", text: "keep" }],
    trash: [
      { id: "message:m1", entityId: "m1", entityType: "message", payload: { message: { id: "m1", chatId: "a", text: "erase" } } },
      { id: "message:m2", entityId: "m2", entityType: "message", payload: { message: { id: "m2", chatId: "b", text: "keep" } } }
    ],
    deletedChatIds: ["old-chat"], deletedMessageIds: ["old-message"], drafts: { a: "erase", b: "keep" }
  }, fallback);
  const redacted = core.redactState(state, {
    entityIds: new Set(["a", "m1", "old-chat", "old-message"]), chatIds: new Set(["a", "old-chat"]), messageIds: new Set(["m1", "old-message"])
  }, fallback);
  assert.equal(redacted.chats.some(chat => chat.id === "a"), false);
  assert.equal(redacted.messages.some(message => message.id === "m1"), false);
  assert.equal(redacted.trash.some(item => item.entityId === "m1"), false);
  assert.equal(redacted.deletedChatIds.includes("old-chat"), false);
  assert.equal(redacted.deletedMessageIds.includes("old-message"), false);
  assert.equal(redacted.drafts.a, undefined);
  assert.equal(redacted.messages.some(message => message.id === "m2"), true);
  assert.equal(redacted.trash.some(item => item.entityId === "m2"), true);
  assert.equal(redacted.drafts.b, "keep");
});

test("attachment repair selects only required missing or corrupt blobs from the migration backup", () => {
  const blob = size => ({ size });
  const records = core.recoverableAttachmentRecords(
    new Set(["healthy", "missing", "corrupt", "unrelated"]),
    [{ id: "healthy", blob: blob(10) }, { id: "corrupt", blob: blob(0) }],
    [
      { id: "healthy", blob: blob(10) },
      { id: "missing", blob: blob(20) },
      { id: "corrupt", blob: blob(30) },
      { id: "not-required", blob: blob(40) },
      { id: "unrelated", blob: blob(0) }
    ]
  );
  assert.deepEqual(records.map(record => record.id), ["missing", "corrupt"]);
});

test("interrupted delete transaction leaves the previous replay intact and retry is deterministic", () => {
  const { message, operations } = baseOperations();
  const deletion = { id: "delete-m1", type: "message.delete", entityId: "m1", createdAt: "2026-01-03", payload: { message } };
  assert.equal(core.replayOperations(operations, fallback).messages.length, 1);
  const retried = core.replayOperations([...operations, deletion, deletion], fallback);
  assert.equal(retried.messages.length, 0);
  assert.equal(retried.trash.length, 1);
});

test("merge-only import retains current content and imports Trash records idempotently", () => {
  const current = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A" }], messages: [{ id: "m1", chatId: "a", text: "current" }] }, fallback);
  const trashItem = { id: "message:m2", entityType: "message", entityId: "m2", deletedAt: "2026-01-03", payload: { message: { id: "m2", chatId: "a", text: "deleted" } } };
  const imported = core.normalizeState({ activeChatId: "a", chats: [{ id: "a", name: "A" }], messages: [], trash: [trashItem], deletedMessageIds: ["m2"] }, fallback);
  const merged = core.mergeStates([current, imported, imported], current, fallback);
  assert.equal(merged.messages.some(item => item.id === "m1"), true);
  assert.equal(merged.trash.filter(item => item.id === "message:m2").length, 1);
});
