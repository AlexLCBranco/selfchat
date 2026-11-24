"use strict";
// Shared helpers for tests that run the real server as a child process.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
let nextPort = 48100 + Math.floor(Math.random() * 500);

function tempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `selfchat-${label}-`));
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function startServer({ dataDir, backupDir, port = nextPort++, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
      cwd: ROOT,
      env: { ...process.env, SELFCHAT_PORT: String(port), SELFCHAT_DATA_DIR: dataDir, SELFCHAT_BACKUP_DIR: backupDir, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const onData = chunk => {
      output += chunk;
      if (output.includes("SelfChat is running at")) {
        child.stdout.off("data", onData);
        resolve({ child, port, url: `http://127.0.0.1:${port}`, output: () => output });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", chunk => { output += chunk; });
    child.once("exit", code => reject(new Error(`server exited early (${code}): ${output}`)));
  });
}

function stopServer(server, { hard = false } = {}) {
  return new Promise(resolve => {
    if (!server || server.child.exitCode !== null || server.child.signalCode !== null) return resolve();
    server.child.once("exit", () => resolve());
    // On Windows both signals end the process immediately (TerminateProcess): no cleanup runs.
    server.child.kill(hard ? "SIGKILL" : "SIGTERM");
  });
}

function request(server, method, route, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    const req = http.request({
      host: "127.0.0.1", port: server.port, method, path: route,
      headers: { ...(method === "GET" ? {} : { "X-SelfChat": "1" }), ...(payload && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}), ...headers }
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => {
        const raw = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(raw.toString("utf8")); } catch (_) {}
        resolve({ status: response.statusCode, json, raw, headers: response.headers });
      });
    });
    req.on("error", reject);
    req.end(payload || undefined);
  });
}

function message(id, chatId = "nba", text = `text ${id}`, createdAt = new Date().toISOString()) {
  return { id, chatId, text, createdAt, editedAt: null };
}

module.exports = { ROOT, tempDir, removeDir, startServer, stopServer, request, message };
