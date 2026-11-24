"use strict";
// SelfChat local server: serves the app and is the only writer of the data folder.
// Binds to 127.0.0.1 only.

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DataStore, StoreError } = require("./store");
const { BackupScheduler } = require("./backup");
const { backupPayload, importBackup } = require("./transfer");

const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json; charset=utf-8" };
const STATIC_FILES = new Set(["index.html", "styles.css", "app.js", "app-core.js", "storage-core.js", "store-core.js", "service-worker.js", "service-worker-core.js", "icon.svg", "manifest.webmanifest"]);
const MAX_BODY = 1024 * 1024 * 1024;

function defaultDataDir() {
  return path.join(os.homedir(), "Documents", "SelfChat Data");
}

function defaultBackupDir() {
  return path.join(os.homedir(), "Documents", "SelfChat Backups");
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request is too large"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const body = await readBody(request);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch (_) {
    throw Object.assign(new Error("Request body is not valid JSON"), { status: 400 });
  }
}

function createSelfChatServer(options = {}) {
  const port = options.port ?? (Number(process.env.SELFCHAT_PORT) || 47832);
  const dataDir = options.dataDir || process.env.SELFCHAT_DATA_DIR || defaultDataDir();
  const fallbackBackupDir = options.backupDir || process.env.SELFCHAT_BACKUP_DIR || defaultBackupDir();
  const backupIntervalMs = options.backupIntervalMs ?? (Number(process.env.SELFCHAT_BACKUP_INTERVAL_MS) || 60 * 60 * 1000);
  const backupCheckMs = options.backupCheckMs ?? (Number(process.env.SELFCHAT_BACKUP_CHECK_MS) || 60 * 1000);
  const log = options.log || (message => console.log(message));
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  let store = null;
  let storeError = null;
  let scheduler = null;
  const clients = new Set();

  function backupDir() {
    return store?.index.meta.get("backupDir") || fallbackBackupDir;
  }

  function openStore() {
    const candidate = new DataStore({ dataDir });
    try {
      candidate.open();
      store = candidate;
      store.onRecord(record => {
        const payload = `id: ${record.seq}\ndata: ${JSON.stringify(record)}\n\n`;
        clients.forEach(client => client.write(payload));
      });
      scheduler = new BackupScheduler({ store, getDir: backupDir, intervalMs: backupIntervalMs, checkMs: backupCheckMs, log }).start();
      log(`SelfChat data folder: ${store.dataDir} (${store.seq} records, integrity OK)`);
    } catch (error) {
      storeError = { code: error.code || "UNREADABLE", message: error.message, dataDir: error.dataDir || path.resolve(dataDir) };
      log(`SelfChat data folder error: ${storeError.message}`);
    }
  }

  function status() {
    if (!store) return { ok: false, error: storeError, dataDir: storeError?.dataDir || path.resolve(dataDir) };
    const last = scheduler?.last || null;
    return {
      ok: true,
      dataDir: store.dataDir,
      backupDir: backupDir(),
      integrity: { ok: true, records: store.seq, lastHash: store.lastHash, checkedAt: store.status.checkedAt, repair: store.status.repair },
      firstRun: store.status.firstRun,
      defaultsCreated: store.status.defaultsCreated,
      counts: store.counts(),
      seq: store.seq,
      lastBackup: last ? { at: last.at, file: last.file, verified: last.verified, error: last.error, fromDisk: Boolean(last.fromDisk) } : null,
      recoveryPoints: store.recoveryPoints().length
    };
  }

  function requireStore() {
    if (!store) throw Object.assign(new Error(storeError?.message || "Data folder unavailable"), { status: 503, code: storeError?.code || "UNAVAILABLE" });
    return store;
  }

  async function handleApi(request, response, url) {
    const method = request.method;
    const route = url.pathname;
    if (!allowedHosts.has(request.headers.host || "")) return sendJson(response, 403, { error: { message: "Unexpected host" } });
    if (method !== "GET" && method !== "HEAD") {
      // Blocks cross-site form posts: a custom header forces a CORS preflight we never approve.
      if (request.headers["x-selfchat"] !== "1") return sendJson(response, 403, { error: { message: "Missing SelfChat header" } });
      const origin = request.headers.origin;
      if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ""))) return sendJson(response, 403, { error: { message: "Unexpected origin" } });
    }

    if (method === "GET" && route === "/api/status") return sendJson(response, store ? 200 : 503, status());
    if (method === "GET" && route === "/api/state") {
      if (!store) return sendJson(response, 503, { error: storeError, status: status() });
      return sendJson(response, 200, { seq: store.seq, state: store.state(), status: status() });
    }
    if (method === "GET" && route === "/api/records") {
      const after = Number(url.searchParams.get("after")) || 0;
      return sendJson(response, 200, { records: requireStore().recordsAfter(after) });
    }
    if (method === "GET" && route === "/api/events") {
      requireStore();
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      response.write(`retry: 1000\n\n`);
      const after = Math.max(Number(url.searchParams.get("after")) || 0, Number(request.headers["last-event-id"]) || 0);
      store.recordsAfter(after).forEach(record => response.write(`id: ${record.seq}\ndata: ${JSON.stringify(record)}\n\n`));
      clients.add(response);
      const heartbeat = setInterval(() => response.write(`: keep-alive\n\n`), 20000);
      request.on("close", () => { clearInterval(heartbeat); clients.delete(response); });
      return;
    }
    if (method === "POST" && route === "/api/commit") {
      const body = await readJson(request);
      const record = requireStore().commit(body.ops, { origin: body.origin, label: body.label });
      return sendJson(response, 200, { record });
    }
    if (method === "POST" && route === "/api/attachments") {
      const buffer = await readBody(request);
      const result = requireStore().addAttachment({
        id: url.searchParams.get("id"),
        name: url.searchParams.get("name") || "",
        type: url.searchParams.get("type") || request.headers["content-type"] || "",
        buffer,
        origin: url.searchParams.get("origin")
      });
      return sendJson(response, 200, result);
    }
    const attachmentMatch = /^\/api\/attachments\/([^/]+)$/.exec(route);
    if (method === "GET" && attachmentMatch) {
      const found = requireStore().attachmentFile(decodeURIComponent(attachmentMatch[1]));
      if (!found) return sendJson(response, 404, { error: { message: "Attachment not found" } });
      response.writeHead(200, { "Content-Type": found.attachment.type || "application/octet-stream", "Content-Length": found.attachment.size, "Cache-Control": "private, max-age=31536000, immutable" });
      fs.createReadStream(found.file).pipe(response);
      return;
    }
    if (method === "GET" && route === "/api/recovery-points") return sendJson(response, 200, { points: requireStore().recoveryPoints() });
    const pointMatch = /^\/api\/recovery-points\/(\d+)$/.exec(route);
    if (method === "GET" && pointMatch) {
      const seq = Number(pointMatch[1]);
      const current = requireStore();
      if (seq > current.seq) return sendJson(response, 404, { error: { message: "Recovery point not found" } });
      return sendJson(response, 200, { seq, state: current.stateAt(seq) });
    }
    if (method === "GET" && route === "/api/export") {
      const payload = backupPayload(requireStore());
      const body = JSON.stringify(payload, null, 2);
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="selfchat-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store"
      });
      response.end(body);
      return;
    }
    if (method === "POST" && route === "/api/import") {
      const body = await readJson(request);
      const report = importBackup(requireStore(), body, { dryRun: url.searchParams.get("dryRun") === "1", origin: "import" });
      return sendJson(response, 200, { report, seq: store.seq });
    }
    if (method === "POST" && route === "/api/backup") {
      requireStore();
      const result = scheduler.run("manual");
      return sendJson(response, result.verified ? 200 : 500, { backup: result });
    }
    if (method === "POST" && route === "/api/settings/backup-dir") {
      const body = await readJson(request);
      const target = typeof body.path === "string" ? body.path.trim() : "";
      if (!target || !path.isAbsolute(target)) throw Object.assign(new Error("Enter a full folder path, for example C:\\Users\\you\\Documents\\SelfChat Backups"), { status: 400 });
      const resolved = path.resolve(target);
      if (path.relative(requireStore().dataDir, resolved) === "" || !path.relative(store.dataDir, resolved).startsWith("..")) {
        throw Object.assign(new Error("The backup folder must be outside the data folder"), { status: 400 });
      }
      fs.mkdirSync(resolved, { recursive: true });
      const record = store.commit([{ op: "meta", key: "backupDir", value: resolved }], { origin: body.origin });
      const backup = scheduler.run("folder-changed");
      return sendJson(response, 200, { record, backup, status: status() });
    }
    return sendJson(response, 404, { error: { message: "Unknown API route" } });
  }

  function handleStatic(request, response, url) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    if (!STATIC_FILES.has(relative)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const filename = path.join(root, relative);
    response.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(filename).pipe(response);
  }

  const server = http.createServer(async (request, response) => {
    let url;
    try {
      url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    } catch (_) {
      response.writeHead(400);
      response.end();
      return;
    }
    if (!url.pathname.startsWith("/api/")) return handleStatic(request, response, url);
    try {
      await handleApi(request, response, url);
    } catch (error) {
      const statusCode = error.status || (error instanceof StoreError && ["MISSING_ATTACHMENT", "INVALID", "CONFLICT"].includes(error.code) ? 400 : 500);
      if (!response.headersSent) sendJson(response, statusCode, { error: { code: error.code || null, message: error.message } });
      else response.end();
    }
  });

  function listen() {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        openStore();
        resolve(server.address().port);
      });
    });
  }

  function close() {
    scheduler?.stop();
    clients.forEach(client => client.end());
    clients.clear();
    store?.close();
    return new Promise(resolve => server.close(() => resolve()));
  }

  return { server, listen, close, get store() { return store; }, get scheduler() { return scheduler; }, get storeError() { return storeError; } };
}

module.exports = { createSelfChatServer, defaultDataDir, defaultBackupDir };

if (require.main === module) {
  const app = createSelfChatServer();
  app.listen().then(port => {
    console.log(`SelfChat is running at http://127.0.0.1:${port}`);
  }).catch(error => {
    if (error.code === "EADDRINUSE") process.exit(0);
    console.error(error);
    process.exit(1);
  });
  const shutdown = () => app.close().finally(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
