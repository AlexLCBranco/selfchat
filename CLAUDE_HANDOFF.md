# SelfChat handoff

Implementation-continuity record. Keep the states **Implemented**, **Tested**, **Committed**, **Pushed**, **Deployed** separate. Earlier history (v0.9.2–v2.10.0, IndexedDB and SC-20 sync) is in git history of this file (`e80931f`).

## Current state (2026-11-24)

- Branch `storage-rebuild` holds **v3.0.0**: the disk-backed storage rebuild from `REBUILD_SPEC.md` (SC-23). `main` and `https://selfchat-home.vercel.app` remain **v2.10.0**, untouched.
- Owner decisions (2026-11-24): leave the hosted site as-is for now; drop sync; data folder `Documents\SelfChat Data`; backup folder `Documents\SelfChat Backups`; Delete permanently = hide only (text stays in the log); backups at start + hourly if changed; retention newest per day for 30 days + newest 5 today; version 3.0.0.
- The interface was ported, not rewritten. Storage-related text changed: data status panel (data folder, integrity, message count, last backup), "Saved on this PC", Settings copy, backup-folder dialog (path entry replaces the browser folder picker), Delete-permanently wording, recovery-preview wording, error/loading screen replacing the single-tab screen. The pairing dialog and sync section were removed.
- Sending: the text stays in the composer until the server acknowledges the save, then the message appears (previously optimistic).

## Delivery state

- **Implemented:** yes, on `storage-rebuild`.
- **Tested:** yes, `npm test` (unit, integration, crash, import, backup, Playwright end-to-end) and the `node --check` list in `AGENTS.md`, on 2026-11-24. See `BUILT.md` and the final report for counts.
- **Committed / Pushed:** see git; the branch is pushed to `origin/storage-rebuild`. Not merged to `main`.
- **Deployed:** no, and not deployable to Vercel as-is: the app needs the local server.

## Not yet done / next steps

1. Owner imports the real backup (`node import-backup.js "<backup.json>"`) and confirms `RESULT: MATCH`. Optionally first with `--data` into a trial folder.
2. Owner switches: merge `storage-rebuild` into `main`. Decide then whether to retire the hosted site (needs explicit approval; changing Vercel settings is not covered by standing authorization).
3. The old browser data in IndexedDB at `http://127.0.0.1:47832` is not read or changed by v3.0.0; it stays as a fallback until the owner decides otherwise.

## Known limits

- Power-loss durability relies on `fsync` (Windows `FlushFileBuffers`); process kills are tested automatically, power cuts cannot be.
- Recovery points and startup replay read the whole log; fine for years of personal use, but a snapshot could be added later if startup gets slow (the spec allows one, rebuildable from the log).
- `npm test` needs Playwright's Chromium (`npx playwright install chromium` on a new machine).
