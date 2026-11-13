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
