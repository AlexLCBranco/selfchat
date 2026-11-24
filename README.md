# SelfChat

SelfChat v3.0.0 is a private, desktop-first message stream organized into multiple chats containing only you.

It supports fast text entry, a derived chronological All Messages view with per-chat visibility controls, chat-specific notes, a two-chat desktop split view, pinned and manually ordered chats, titled/tagged/duplicated messages, direct message links, starred and permanently pinned messages, collapsible long messages, fenced code blocks with copy controls, media/link/file galleries, type and date-filtered search, keyboard chat switching, custom chat avatars, replies with quoted context, images, stickers, generic file attachments, File Explorer-style message selection and drag-to-move, recoverable Trash, daily recovery points, dated automatic backups, and backup import/export. It has no recipients, accounts, AI replies, analytics, or cloud sync.

## Run

Double-click `Start SelfChat.cmd`, or run:

```powershell
node server.js
```

Then open <http://127.0.0.1:47832>. Any number of tabs can be open; they all show the same data and update live.

## Where the data lives

- **Data folder:** `Documents\SelfChat Data` (override with the `SELFCHAT_DATA_DIR` environment variable). It holds `log.jsonl` (the message log), `attachments\` (files named by their SHA-256 hash), and `selfchat-data.json`.
- **Backup folder:** `Documents\SelfChat Backups` by default; change it in Settings → Choose automatic backup folder.
- The local server (`server.js`) is the only writer and listens on `127.0.0.1` only. The browser keeps no copy of your data.

## How saving works

- Every change (a message, edit, move, delete, chat change, attachment) is one line appended to `log.jsonl` and flushed to disk before the server replies. A message shows in the chat only after that reply. If the server is unreachable, the text stays in the composer and the app says so.
- The log is never rewritten. Each line carries a SHA-256 checksum chained to the previous line. On every start the whole chain is checked, and the result, the data folder, the message count and the last backup time are shown in the status panel under the chat list.
- Deletes are explicit records made only by a user action. Saving never turns "missing from the screen" into a delete.
- Attachments are written, flushed and re-read for verification before the message that uses them is accepted.
- If the data folder exists but cannot be read, or the checksum chain is broken, SelfChat shows a blocking error screen with the reason and the folder path. It never shows an empty or default chat list in that case. The built-in NBA / Claude-Codex / Soccer chats appear only when the data folder did not exist, and the status panel then says a new data folder was created and where.
- "Delete permanently" and "Empty Trash" remove items from SelfChat and from future backups. The text stays in the log on this PC and in earlier backup files.
- Recovery points come from the log: the state at the start of each active day (30 days) and the state just before each restore.

## Backups

- A dated file (`SelfChat backup YYYY-MM-DD HH-MM-SS.json`) is written when the server starts (if anything changed since the last one) and at most once an hour while there are changes. Existing backup files are never modified.
- After writing, the file is re-read and its counts and attachment hashes are compared with the live data; a failure shows in the status panel.
- Retention: the newest backup of each of the last 30 days plus the newest 5 from today. Only files with SelfChat's backup name are ever deleted.
- Settings → Export backup downloads the same format on demand. Backups use the existing SelfChat JSON format (schemaVersion 4, attachments as data URLs).

## Importing a backup

From Settings → Import backup, or from a terminal:

```powershell
node import-backup.js "C:\path\to\selfchat-backup.json"
```

Add `--data "C:\some\folder"` to import into a different data folder (for a trial run), or `--dry-run` to see the counts without writing. Import merges by stable ID and never deletes. It prints the number of chats, messages, attachments and Trash items in the backup and in the store, and ends with `RESULT: MATCH` when every item in the backup is in the store.

## Tests

```powershell
npm test
```

Runs the unit, integration, crash (server killed mid-write), import, backup and Playwright end-to-end tests against throwaway data folders.

## Project files

- `AGENTS.md` — durable instructions; `DECISIONS.md` — decisions; `BUILT.md` — what is built; `FEATURE_BACKLOG.md` — what is planned; `IDEAS.md` — unplanned ideas; `CLAUDE_HANDOFF.md` — continuity notes
- `index.html`, `styles.css`, `app.js`, `app-core.js` — interface and application behavior
- `server.js` — local server and HTTP API; `store.js` — append-only log store; `store-core.js` — shared change operations; `transfer.js` — import/export; `backup.js` — dated backups and retention; `import-backup.js` — import command
- `storage-core.js` — pure state normalization used by the interface
- `service-worker.js`, `service-worker-core.js`, `manifest.webmanifest`, `icon.svg` — installable app shell (never caches data)
- `tests/` — all automated tests

## The hosted site

<https://selfchat-home.vercel.app> still runs the previous browser-storage version (v2.10.0) and was not changed by this rebuild. Its data is separate from the data folder on this PC.
