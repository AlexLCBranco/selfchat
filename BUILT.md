# Built — SelfChat

Shipped work only, newest first. Planned work is in `FEATURE_BACKLOG.md`, never here; unplanned ideas are in `IDEAS.md`.
Entries before 2026-11-24 were backfilled from the old status table in `FEATURE_BACKLOG.md`.

## 2026-11-24
- SC-23 — Disk-backed storage rebuild (v3.0.0, branch `storage-rebuild`, not yet the live version)
  The local server is the only writer: every change is a checksum-chained line appended to `Documents\SelfChat Data\log.jsonl` and flushed before it is acknowledged; attachments are hash-named verified files; deletes are explicit; a broken or unreadable data folder shows a blocking error screen, never empty chats; any number of tabs with live updates; dated, verified, never-overwritten backups; import of the existing backup format with matching counts. Cross-device sync (SC-20 foundations) removed.

## Before 2026-11-24 (browser-storage versions)
- SC-20 foundations — local sync substrate, encryption, pairing, attachment packages, key rotation, erasure propagation (v2.5.0–v2.10.0; removed in v3.0.0)
- v2.4.0 — installable manifest, offline app shell, install entry point
- SC-19 — File Explorer-style message selection and drag-to-move (v2.3.1)
- SC-11 — Chat-specific notes; SC-15 — Split chat view (v2.0.0)
- SC-8 — Rename messages; SC-9 — Direct links to messages; SC-10 — Duplicate messages; SC-17 — Optional message tags (v1.7.0)
- SC-12 — Collapse long messages; SC-13 — Code blocks with copy buttons (v1.6.0)
- SC-6 — Media and file gallery; SC-7 — Search by message type; SC-14 — Filter by date range (v1.5.0)
- SC-4 — Star messages; SC-5 — Pin messages (v1.4.0)
- SC-3 — Manually reorder chats; SC-16 — Keyboard chat switcher (v1.3.0)
- SC-2 — Pin favorite chats (v1.2.0)
- SC-1 — Custom chat avatars (v1.1.0)
