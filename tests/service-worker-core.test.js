const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../service-worker-core.js");

test("offline cache accepts only successful same-origin GET responses", () => {
  const origin = "https://selfchat.example";
  assert.equal(core.shouldCacheResponse(
    { method: "GET", url: `${origin}/app.js` },
    { ok: true },
    origin
  ), true);
  assert.equal(core.shouldCacheResponse(
    { method: "POST", url: `${origin}/app.js` },
    { ok: true },
    origin
  ), false);
  assert.equal(core.shouldCacheResponse(
    { method: "GET", url: `${origin}/missing.js` },
    { ok: false },
    origin
  ), false);
  assert.equal(core.shouldCacheResponse(
    { method: "GET", url: "https://cdn.example/file.js" },
    { ok: true },
    origin
  ), false);
});

test("offline navigation falls back to the cached app shell", () => {
  const navigation = { mode: "navigate", url: "https://selfchat.example/chat" };
  const asset = { mode: "cors", url: "https://selfchat.example/app.js" };
  assert.equal(core.fallbackRequest(navigation), "index.html");
  assert.equal(core.fallbackRequest(asset), asset);
});
