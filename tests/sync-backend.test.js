const test = require("node:test");
const assert = require("node:assert/strict");
const backend = require("../sync-backend.js");

test("the default backend boundary cannot transmit data", async () => {
  const boundary = backend.createBackendBoundary();
  assert.equal(boundary.configured, false);
  await assert.rejects(boundary.pushEnvelopes([{ header: {}, iv: "iv", ciphertext: "encrypted", signature: "signature" }]), /not configured/);
  await assert.rejects(boundary.pullEnvelopes(null), /not configured/);
});

test("configured backend adapters are contract-checked and pull pages are validated", async () => {
  assert.throws(() => backend.createBackendBoundary({}), /missing pushEnvelopes/);
  const calls = [];
  const encrypted = { header: { version: 1 }, iv: "iv", ciphertext: "encrypted", signature: "signature" };
  const boundary = backend.createBackendBoundary({
    async pushEnvelopes(envelopes) { calls.push(envelopes); return { accepted: envelopes.length }; },
    async pullEnvelopes() { return { envelopes: [encrypted], cursor: "next" }; },
    async putAttachmentChunk() {},
    async getAttachmentChunk() { return null; }
  });
  assert.deepEqual(await boundary.pushEnvelopes([encrypted]), { accepted: 1 });
  assert.deepEqual(await boundary.pullEnvelopes(null), { envelopes: [encrypted], cursor: "next" });
  await assert.rejects(boundary.pushEnvelopes([{ operations: [{ id: "plaintext" }] }]), /encrypted envelopes only/);
  assert.equal(calls.length, 1);
});
