const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { tempDir, removeDir, startServer, stopServer, request, message } = require("./helpers");

function setup(t) {
  const root = tempDir("durability");
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  let server = null;
  t.after(async () => {
    await stopServer(server, { hard: true });
    removeDir(root);
  });
  return {
    dirs,
    async start() { server = await startServer(dirs); return server; },
    async kill() { await stopServer(server, { hard: true }); }
  };
}

async function storedMessageIds(server) {
  const response = await request(server, "GET", "/api/state");
  assert.equal(response.status, 200, `the restarted server must open the data folder: ${JSON.stringify(response.json?.error)}`);
  return new Set(response.json.state.messages.map(item => item.id));
}

test("killing the server during writes never loses an acknowledged message", async t => {
  const harness = setup(t);
  const acknowledged = [];
  for (let round = 0; round < 5; round += 1) {
    const server = await harness.start();
    let stop = false;
    const writers = Array.from({ length: 6 }, async (_, writer) => {
      for (let i = 0; !stop; i += 1) {
        const id = `r${round}-w${writer}-${i}`;
        try {
          const response = await request(server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: message(id, "nba", `round ${round} message ${i} ${"x".repeat(200)}`) }] });
          if (response.status === 200) acknowledged.push(id);
        } catch (_) {
          return;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 150 + round * 70));
    await harness.kill();
    stop = true;
    await Promise.allSettled(writers);
  }
  const server = await harness.start();
  const stored = await storedMessageIds(server);
  const missing = acknowledged.filter(id => !stored.has(id));
  assert.ok(acknowledged.length > 50, `expected many acknowledged writes, got ${acknowledged.length}`);
  assert.deepEqual(missing, [], `${missing.length} acknowledged messages were lost`);
});

test("killing the server immediately after an acknowledged write keeps it", async t => {
  const harness = setup(t);
  for (let round = 0; round < 3; round += 1) {
    const server = await harness.start();
    const id = `immediate-${round}`;
    const response = await request(server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: message(id) }] });
    assert.equal(response.status, 200);
    await harness.kill();
    const again = await harness.start();
    assert.ok((await storedMessageIds(again)).has(id), `${id} must survive a kill right after its acknowledgement`);
    await harness.kill();
  }
});

test("an acknowledged attachment and its message survive a kill byte-for-byte", async t => {
  const harness = setup(t);
  const server = await harness.start();
  const bytes = Buffer.from(Array.from({ length: 50000 }, (_, i) => i % 251));
  const upload = await request(server, "POST", "/api/attachments?id=file-1&name=data.bin&type=application/octet-stream", bytes, { "Content-Type": "application/octet-stream" });
  assert.equal(upload.status, 200);
  const commit = await request(server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: { id: "file-message", chatId: "nba", type: "file", attachmentId: "file-1", fileName: "data.bin", fileSize: bytes.length, createdAt: new Date().toISOString() } }] });
  assert.equal(commit.status, 200);
  await harness.kill();
  const again = await harness.start();
  assert.ok((await storedMessageIds(again)).has("file-message"));
  const download = await request(again, "GET", "/api/attachments/file-1");
  assert.equal(download.status, 200);
  assert.ok(download.raw.equals(bytes));
});

test("the server refuses writes that would reference a missing attachment", async t => {
  const harness = setup(t);
  const server = await harness.start();
  const response = await request(server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: { id: "img", chatId: "nba", type: "image", imageId: "nope", createdAt: new Date().toISOString() } }] });
  assert.equal(response.status, 400);
  assert.equal((await storedMessageIds(server)).has("img"), false);
});

test("cross-site requests cannot write", async t => {
  const harness = setup(t);
  const server = await harness.start();
  const noHeader = await request(server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: message("evil") }] }, { "X-SelfChat": "" });
  assert.equal(noHeader.status, 403);
  const foreignOrigin = await request(server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: message("evil") }] }, { Origin: "https://evil.example" });
  assert.equal(foreignOrigin.status, 403);
  const foreignHost = await request(server, "GET", "/api/state", undefined, { Host: "evil.example" });
  assert.equal(foreignHost.status, 403);
  assert.equal((await storedMessageIds(server)).has("evil"), false);
});
