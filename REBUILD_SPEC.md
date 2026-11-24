# SelfChat rebuild spec

Written 2026-11-24 from a chat with the owner. For a **new Claude Code chat** opened in this repo.
The owner previously built SelfChat with Codex. He is moving it to Claude Code because of data loss.

## 1. Why this exists

The owner's top requirement is durability: SelfChat must never lose a message. The current app (v2.10.0) has lost messages more than once. On 2026-11-24 he opened it and found only the blank default state (an empty "NBA" chat) and had to restore a backup.

He says usability is fine. The problem is storage. Do not redesign the interface.

## 2. Confirmed defects in the current code

Verify each one yourself before relying on it. Line numbers are from commit `e80931f`.

1. **A re-claimed tab loads stale data.** `app.js:365` reads `repository.initialState || await repository.load()`. `initialState` is captured once when the repository opens (`storage.js:415-418`, returned at `storage.js:526`) and never cleared. `claimThisTab()` (`app.js:182`) calls `initializeStorage()` again on a tab that already has a repository, so the tab shows the state from when it first opened. Messages written in another tab since then look deleted, and the startup automatic backup can then be written from that stale state.

2. **Any startup error silently swaps in old or empty data.** The whole of `initializeStorage()` (`app.js:355-400`) is one `try`. On any error it sets `repository = null`, switches to "legacy" mode and loads `loadLegacyState()` (`app.js:275`), which returns `DEFAULT_STATE` (`app.js:29`, the empty NBA / Claude-Codex / Soccer chats) when no v0.9.2 data exists. The only signal is a 6-second toast.

3. **Saving and restoring are destructive.**
   - `saveState()` (`app.js:332`) diffs two in-memory copies and sends `messagesDelete` for anything missing from memory (`stateDiff`, `app.js:302`; applied in `storage.js:192-206`). A wrong in-memory state becomes permanent deletion.
   - `replaceState()` (`storage.js:556-589`) clears the chats, messages, stickers, drafts and trash stores and rewrites them.
   - The automatic backup is one file, `SelfChat automatic backup.json`, overwritten on every run (`app.js:693`).

4. **The browser owns the data.** Everything is in IndexedDB, per origin and per browser profile. The browser can clear it, and the local address and the hosted address are separate datasets. No in-page code can guarantee durability.

The cause of the 2026-11-24 loss is not proven. The blank default state means it was defect 2 or defect 4.

## 3. Goal

The same app from the owner's point of view, on storage that cannot silently lose or hide data.

Out of scope: mobile, audio, video, accounts, cloud hosting of messages, interface redesign.

## 4. Architecture

- **A local Node server is the only writer.** Extend `server.js` (or replace it). It binds to `127.0.0.1` only. `Start SelfChat.cmd` stays the way to launch.
- **Data lives in files on disk**, in a data folder outside the repo. The browser is only the screen and keeps no authoritative copy.
- **Append-only log.** Every change (new message, edit, move, delete, chat change, attachment added) is one record appended to a log file and flushed to disk before the server acknowledges it. Never rewrite or truncate the log in normal operation.
- **Deletes are explicit records** created only by a user action. Never derive a delete from a difference between two states. Never clear-and-rewrite.
- **Attachments are files** in the data folder, named by content hash, written and verified before the message that references them is acknowledged.
- **The interface shows a message as saved only after the server acknowledges it.** If the server is unreachable, the text stays in the composer and the interface says so.
- **Any number of tabs.** Every tab reads from the server and receives live updates. Remove the single-tab lock; it is no longer needed.
- **Fast start** may use a snapshot or index derived from the log, but the log is the source of truth and the snapshot must be rebuildable from it.

## 5. Failure rules

- If the data folder exists but cannot be read, or the log fails its integrity check, the app shows a blocking error screen with the reason and the folder path. It must never show an empty or default state in that situation.
- The built-in default chats may appear only on a verified first run, when the data folder did not exist, and the interface must say that a new empty data folder was created and where.
- On startup, run an integrity check (record count and a checksum chain or equivalent) and show the result, the data folder path, the message count and the last backup time in the data status panel.

## 6. Backups

- Dated backup files in a second folder the owner chooses. Never overwrite an existing backup.
- After writing a backup, re-read it and compare counts with the live data. Report a failed verification in the status panel.
- Keep at least one backup per day for 30 days, plus the most recent few from today. Ask the owner before picking any policy that deletes older backups.
- Keep a manual export command.

## 7. Importing the owner's existing data

This is the gate for switching. The owner has real chats in the current app.

- Import the current JSON backup format: see `buildBackupPayload()` (`app.js:648`) and `backupPayload` in `storage-core.js`. Attachments arrive as data URLs.
- Import merges by stable ID and never deletes.
- After import, print counts of chats, messages, attachments and trash items in the backup and in the new store. They must match.
- The owner switches only after running the import on his real backup and seeing matching counts.

## 8. Feature parity

Every feature marked Implemented in `FEATURE_BACKLOG.md` must keep working and keep its current behavior, including reply/quote, attachments, search, split view, pins, stars, Trash and recovery points.

Before writing code, read `app.js` (4,018 lines, global mutable state) and tell the owner whether you will port the interface onto the new storage or rewrite it, and why. Default to porting, because he is satisfied with the interface.

## 9. Decisions the owner still has to make

Ask these before starting. Do not assume.

1. **The hosted site.** With storage on disk, the app runs only from his PC. The Vercel address (`selfchat-home.vercel.app`) cannot hold his chats any more. Retire it, or leave the old version there read-only?
2. **The cross-device sync code** (`sync-crypto.js`, `sync-backend.js`, pairing, device revocation, the SC-20 milestones). He uses one desktop. Drop it, or keep it?
3. **Where the data folder and the backup folder live.**

## 10. Testing

The owner wants no manual testing where automation is possible. Automate all of these:

- Kill the server process during and immediately after writes, restart, and assert that every acknowledged message is present.
- Two tabs writing in turn: both show everything, nothing disappears.
- Unreadable or corrupted data folder: the error screen appears, the default state does not.
- Import of a fixture backup in the current format, with attachments: counts match, a second import changes nothing.
- A backup run never modifies an existing backup file.
- End to end in a real browser: send a message, reload, restart the server, the message is there.

## 11. Process

- Work on a branch. Leave `main` and the hosted site untouched until the owner switches.
- Follow the tracking format of the owner's other repos (for example `AlexLCBranco/rotationkit`): `BUILT.md` lists only what is built, `FEATURE_BACKLOG.md` lists only what is planned, `IDEAS.md` holds ideas not yet planned. Never mix them.
- Finish with a report: what was built, test results, and the import counts from the owner's real backup.
