# SelfChat decisions

This file records material decisions that future chats must preserve unless the user explicitly replaces them.

## 2026-11-04 — Initial product

- SelfChat imitates the familiar two-column WhatsApp desktop layout.
- Every chat contains only the user; chats exist to separate topics, not people.
- The initial examples are NBA, Claude / Codex, and Soccer.
- The primary experience is desktop and keyboard-first.

Reason: the user already rambles to himself in WhatsApp Desktop and wants the same low-friction interaction without any risk of sending a message to another person.

## 2026-11-04 — Version 0.1 scope

**Superseded for media and attachments by the 2026-11-05 image decisions and the 2026-11-13 v1.0 interaction decision.** The historical v0.1 scope remains recorded below.

Version 0.1 includes chat creation, renaming and deletion; text message creation, editing and deletion; current-chat search; local persistence; and JSON backup/restore.

Version 0.1 excludes other users, AI replies, accounts, cloud sync, voice notes, images, reactions, reminders, analytics, and elaborate organization.

Reason: real usage should generate improvement ideas organically. The first version should remain small enough to evaluate honestly.

## 2026-11-04 — Local-first storage

**Superseded by the 2026-11-13 unified local database decision.** `selfchat-data-v1` remains only a legacy migration and rollback source for this storage version.

Chats and messages live in browser local storage under `selfchat-data-v1`. Vercel hosts only static application assets and does not receive message content.

Reason: privacy and simplicity matter more than cross-device sync for the first version.

## 2026-11-04 — Buildless implementation

The app uses plain HTML, CSS, and JavaScript with a dependency-free Node static server.

Reason: the codebase should remain easy to understand, modify, and deploy without framework or package-management overhead.

## 2026-11-05 — Persistent Codex project

The authoritative project folder is `C:\Users\alexc\Documents\Codex\SelfChat`. Multiple Codex chats may work from this folder, while `AGENTS.md` and this file preserve shared context.

Reason: repository files are a more reliable source of truth than expecting separate AI conversations to remember prior decisions.

## 2026-11-05 — Local image stickers and sticker creation

SelfChat supports a small built-in sticker pack plus stickers created by choosing, pasting, or dropping an image. Sticker image bytes live in the same local attachment store as image messages, and JSON backups include both. The original statement that sticker metadata remains in `selfchat-data-v1` is superseded by the 2026-11-13 unified local database decision. The hosted application does not upload or transmit sticker content.

This replaces the earlier emoji, caption, and color sticker creator, which did not match the user's meaning of WhatsApp stickers.

Reason: the intended workflow is saving and sending expressive image stickers made from personal images and memes, like WhatsApp.

## 2026-11-05 — Local image messages

SelfChat supports image messages from the file picker, clipboard/screenshot paste, and drag-and-drop. Clicking a sent image opens it in a full-screen viewer. Image bytes and message metadata are stored in the unified browser IndexedDB database; JSON backups include the image data. The original split-storage statement is superseded by the 2026-11-13 unified local database decision. Nothing is uploaded or transmitted by the hosted application.

This replaces the earlier version 0.1 exclusion of images and the later statement that general image attachments remain out of scope.

Reason: screenshots and images are part of the user's everyday self-chat workflow, and IndexedDB provides enough local capacity without weakening the privacy boundary.

## 2026-11-05 — Local development port

The authoritative local SelfChat URL is `http://127.0.0.1:47832`.

Reason: an older process continued serving a stale build on the previous port, preventing the current image-message interface from reaching the browser.

## 2026-11-05 — Stable production domain

The canonical production URL is `https://selfchat-home.vercel.app`. It is attached to the Vercel project so future production deployments automatically update the same URL.

Reason: users need a memorable browser URL that consistently points to the latest production version rather than a deployment-specific address.

## 2026-11-05 — Ongoing production deployment authorization

The user explicitly authorizes deploying requested SelfChat implementation changes to `https://selfchat-home.vercel.app` as part of normal handoff, unless the user revokes that authorization or a deployment would include a materially different external action.

Reason: the live website is the user's working copy, and requiring a separate deployment confirmation for every completed change wastes time and makes ordinary refreshes appear ineffective.

## 2026-11-05 — WhatsApp interaction baseline

For familiar chat interactions, WhatsApp Desktop is the default usability baseline. SelfChat should include the ordinary expected click, keyboard, preview, navigation, and close behavior unless a product invariant or explicit decision says otherwise.

Reason: familiar behavior should work without requiring the user to discover and report each missing basic affordance.

## 2026-11-07 — Single active tab and recovery snapshot

Only the newest SelfChat tab is interactive; another open tab must explicitly take over before it can be used. State writes merge with a local recovery snapshot and deletion tombstones so a stale or older tab cannot silently erase newer messages.

Reason: multiple independently writable tabs can overwrite browser-local state with an older in-memory copy.

## 2026-11-07 — Rolling on-device recovery points

**Superseded by the 2026-11-13 unified local database decision.** SelfChat now keeps at most one point per day for 30 days instead of 25 per-change points.

SelfChat keeps up to 25 automatic recovery points in browser IndexedDB and exposes recent points in Data settings. Message and chat deletion retains associated local image bytes so a recovery point can restore the complete message. Import preserves existing local image records and creates a pre-import recovery point. Manual JSON export remains the protection against clearing all browser site data.

Reason: a single mirrored local-storage value cannot recover earlier state after an accidental deletion, bad import, or corrupted write.

## 2026-11-08 — Transactional local data foundation

**Superseded by the 2026-11-13 unified local database decision.** The append-only operation log and materialized-projection architecture were removed; the historical design remains recorded below.

SelfChat uses the versioned `selfchat-local-v1` IndexedDB database for chats, messages, per-chat drafts, attachment references, materialized projections, deletion records, and an append-only operation log. Migration creates and verifies a complete on-device backup, builds deterministic projections, validates IDs and attachment availability, and activates the database only after all checks pass. The legacy `selfchat-data-v1` value, image database, and recovery snapshots are not cleared or destructively rewritten and remain rollback sources.

Reason: transactional writes and immutable operations prevent fragile whole-state overwrites while preserving a safe, repeatable fallback path.

## 2026-11-08 — Merge-only import and recovery

JSON import and recovery restore merge records by stable entity IDs. Repeated imports are idempotent, and records missing from an import are never interpreted as deleted. Moving and deletion remain distinct operation types, with deletion records retained for a future Trash interface.

Reason: backups and interrupted workflows must not erase newer local data or create duplicates.

## 2026-11-08 — Local plaintext now, encrypted sync later

SelfChat data remains plaintext inside the current browser profile and is not transmitted by the hosted application. Future encrypted sync is planned but is not implemented in this milestone.

Reason: this milestone strengthens local durability without expanding the privacy boundary or introducing network storage.

## 2026-11-08 — Explicit authorization for deployment and pushes

Git pushes and production deployments require explicit user authorization. This replaces the 2026-11-05 standing production deployment authorization.

Reason: external changes must remain deliberate while the storage rebuild is validated locally.

## 2026-11-08 — Recoverable deletion and explicit permanent deletion

**Partially superseded by the 2026-11-13 unified local database decision.** Recoverable Trash behavior remains authoritative, but deletion no longer depends on an append-only operation log.

Message and chat deletion creates a full-fidelity Trash record through a distinct append-only operation. Restore, move, individual permanent deletion, and Empty Trash are separate explicit operations; missing imported records never imply deletion. Restores keep stable IDs and creation dates, use the original chat when available, and otherwise place individual messages in the permanent Unsorted chat. Attachment bytes are retained conservatively while any live message, Trash item, sticker, recovery point, or migration backup can reference them.

Reason: ordinary organization must remain reversible, transactionally durable, and safe across retries, imports, reloads, and interrupted operations.

## 2026-11-08 — Milestone 3 retrieval and data trust

Version 0.9 adds local cross-chat message search, contextual in-chat result navigation, safe clickable HTTP(S) links without remote previews, and complete selection controls for move, Trash, and cancel. Social messaging features remain excluded.

Reason: finding and organizing existing self-chat content is an ordinary desktop workflow and should not require cloud services or expand the privacy boundary.

## 2026-11-08 — Point-in-time recovery

Recovery points replace the active local projection with the selected historical state after first saving the current state as a new recovery point. Backup import remains merge-only and idempotent.

This replaces the 2026-11-08 decision that recovery, as well as import, is merge-only.

Reason: the previous recovery action claimed to restore a point in time while tombstones and newer records could prevent that restoration. The interface and storage behavior must agree.

## 2026-11-08 — Targeted permanent device erasure

**Updated by the 2026-11-13 unified local database decision.** The permanent-erasure guarantee remains authoritative, but matching operation-log removal no longer applies because the operation log was removed.

Permanent deletion removes the selected chat or message from live data, Trash, matching operation history, recovery points, legacy rollback sources, migration backups, and unreferenced local attachment bytes. Append-only history remains the default for ordinary changes but does not override an explicit permanent-erasure request.

This narrows the append-only and legacy-retention decisions for explicitly purged entities.

Reason: a control labeled permanent deletion must not silently retain plaintext copies elsewhere in the browser.

## 2026-11-09 — Attachment self-repair

Version 0.9.1 checks attachment references at startup and restores only missing or corrupt local blobs from the verified on-device migration backup. Healthy attachment records are never replaced, and repair does not transmit content or change message metadata.

Reason: migration preserved a complete local image backup, so an unavailable live image should recover automatically when that verified copy still exists.

## 2026-11-09 — Missing attachments do not block migration

Version 0.9.2 migrates structurally valid chats and messages even when an attachment blob is unavailable, then runs attachment repair after transactional storage activates. IndexedDB schema upgrades also reconcile missing stores and indexes from incomplete earlier setup attempts.

Reason: rejecting the complete transactional migration leaves SelfChat permanently in legacy fallback and prevents the verified attachment backup from being consulted. Preserving message metadata while repairing blobs is safer than blocking all transactional storage.

## 2026-11-13 — Unified local database and backup model

The `selfchat-unified-v1` IndexedDB database is the active source of truth for chats, messages, drafts, Trash, daily snapshots, stickers, and attachment blobs. Message metadata and new attachment blobs commit in one transaction. Saves write changed records only, and recovery keeps at most one point per day for 30 days. The operation log and per-change recovery model are removed.

First-run migration copies and count-verifies v0.9.2 data before activation. Legacy sources remain untouched for this storage version and are used only for migration, rollback, attachment repair, and targeted permanent erasure. Manual JSON backups remain compatible with v0.9.2, while supported browsers can also write full local folder backups after significant changes and at least daily.

Reason: one transactional source of truth reduces split-storage failure modes and write amplification while preserving zero-loss migration, local privacy, recoverability, and backward-compatible backups.

## 2026-11-13 — Version 1.0 interaction scope

SelfChat supports replies with quoted context, generic local file attachments through picker, paste, and drag-and-drop, and clean chronological copying of selected messages. Reply previews track edited and moved originals and remain informative when the original is in Trash or permanently deleted. Files show name and size and offer local open and download actions; their bytes are stored and backed up with other attachments. Audio and video receive no special players.

This supersedes the earlier blanket exclusion of attachments while preserving the exclusions for other users, AI replies, accounts, cloud sync, analytics, and notifications.

Reason: these are familiar WhatsApp-like self-chat workflows that improve context and local information capture without expanding the privacy boundary or adding social features.
