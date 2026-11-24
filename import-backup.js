#!/usr/bin/env node
"use strict";
// Imports a SelfChat JSON backup into the disk store and prints matching counts.
//
//   node import-backup.js "C:\path\to\selfchat-backup.json"                 (into the running app, or the default data folder)
//   node import-backup.js "C:\path\to\selfchat-backup.json" --data "C:\Temp\SelfChat Test Data"
//   add --dry-run to see what would be imported without writing anything.

const fs = require("fs");
const http = require("http");
const path = require("path");
const { DataStore } = require("./store");
const { importBackup, formatReport } = require("./transfer");
const { defaultDataDir } = require("./server");

function parseArgs(argv) {
  const args = { file: null, data: null, dryRun: false, port: Number(process.env.SELFCHAT_PORT) || 47832 };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--data") args.data = argv[++i];
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--port") args.port = Number(argv[++i]);
    else if (!args.file) args.file = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  if (!args.file) throw new Error("Usage: node import-backup.js <backup.json> [--data <folder>] [--dry-run]");
  return args;
}

function request(port, method, route, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: route, headers: { "Content-Type": "application/json", "X-SelfChat": "1" } }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    if (body) req.end(body); else req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = fs.readFileSync(path.resolve(args.file), "utf8");
  const raw = JSON.parse(text);
  let report;
  let target;
  const running = args.data ? null : await request(args.port, "GET", "/api/status").catch(() => null);
  if (running?.body?.ok) {
    target = `${running.body.dataDir} (through the running SelfChat app on port ${args.port})`;
    const result = await request(args.port, "POST", `/api/import${args.dryRun ? "?dryRun=1" : ""}`, text);
    if (result.status !== 200) throw new Error(result.body?.error?.message || `Import failed with HTTP ${result.status}`);
    report = result.body.report;
  } else if (running && running.body && !running.body.ok) {
    throw new Error(`The running SelfChat app reports a data folder problem: ${running.body.error?.message}`);
  } else {
    const dataDir = path.resolve(args.data || defaultDataDir());
    target = dataDir;
    const store = new DataStore({ dataDir, createDefaults: false });
    store.open();
    try {
      report = importBackup(store, raw, { dryRun: args.dryRun, origin: "import-cli" });
    } finally {
      store.close();
    }
  }
  console.log(`Backup:      ${path.resolve(args.file)}`);
  console.log(`Data folder: ${target}`);
  console.log(args.dryRun ? "Mode:        dry run (nothing written)\n" : "");
  console.log(formatReport(report));
  if (!args.dryRun && !report.verification?.ok) process.exitCode = 2;
}

main().catch(error => {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
});
