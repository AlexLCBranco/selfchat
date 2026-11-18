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

**Superseded by the 2026-11-18 low-interruption development authorization for routine commits and pushes, and by the 2026-11-18 automatic production deployment authorization for qualifying releases.**

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

## 2026-11-14 — Local custom chat avatars

SelfChat supports optional user-selected image avatars for chats while retaining emoji icons as the default and fallback. Avatar images are center-cropped to a compact local raster, stored in the unified attachment store, and included in backup, recovery, Trash restore, and permanent-erasure behavior. Creating and changing an avatar remains separate from the message capture loop.

Reason: visual chat recognition is useful in a topic-heavy desktop sidebar, and the existing local attachment model supports it without adding recipients, network transmission, or capture-time friction.

## 2026-11-14 — Persistent favorite chat pins

SelfChat allows any number of chats to remain pinned at the top of the sidebar until explicitly unpinned. Pinned and unpinned groups each retain latest-activity ordering. Pin state is local, included in backup and recovery data, and restored with a chat from Trash.

Reason: stable access to important topic chats reduces navigation effort without changing the message-capture loop; a local topic organizer does not benefit from WhatsApp's three-chat limit or temporary pin durations.

## 2026-11-14 — Manual chat order and keyboard navigation

Chats can be dragged or moved from their sidebar menu within the pinned or unpinned group. A group's existing activity order remains the default until the user manually arranges it; new chats appear first in a manually arranged unpinned group. `Ctrl+[` and `Ctrl+]` cycle through the visible chat order, while `Ctrl+1` through `Ctrl+9` open a chat directly.

Reason: explicit ordering and direct keyboard navigation make a growing topic list predictable without adding organizational work to message capture.

## 2026-11-14 — Starred and permanently pinned messages

Individual messages can be starred for retrieval from Chat Options or pinned indefinitely to a navigable banner above their chat. Multiple message pins are allowed. Star and pin metadata follows a message when moved, survives full-fidelity Trash restoration, and is included in backups and recovery points.

Reason: stars support later retrieval while pins keep active references immediately visible; both are optional actions after capture and preserve the fast send loop.

## 2026-11-14 — Unified chat retrieval controls

Each chat exposes a local gallery for images, generic files, and safe HTTP(S) links. In-chat search can combine text with message-type and inclusive date-range filters while retaining contextual navigation through the message stream.

Reason: media browsing and structured search solve the same retrieval problem and can share the existing local-only message and attachment model without introducing remote previews or indexing services.

## 2026-11-14 — Long-message and fenced-code presentation

Long text messages collapse automatically in the interface and can be expanded without modifying their stored content. Triple-backtick fenced blocks render as local code panels with optional language labels and copy buttons; the original plain message remains authoritative for editing, copying, backup, and search.

Reason: large prompts and reusable code should remain easy to capture as plain text while becoming faster to scan and reuse afterward.

## 2026-11-14 — Optional post-capture message organization

Messages may receive an optional display title and up to ten local tags after sending. Tags participate in in-chat retrieval. Messages can be duplicated while preserving reusable content, titles, tags, and attachment references but clearing reply, edit-history, star, and pin state. Direct message links use URL fragments so message IDs are not sent to the static host.

Reason: reusable prompts and notes benefit from lightweight organization, but none of it should add fields or decisions to the capture loop.

## 2026-11-14 — Chat notes and paired desktop view

Each chat can store an optional local note outside the message stream. Notes live on the chat record, use the existing local persistence and backup lifecycle, and remain separate from message capture. Desktop split view shows a read-only companion conversation beside the active chat; the companion can be changed, closed, or swapped into the primary composer while preserving the paired view.

Reason: stable project context should not need to masquerade as a message, while side-by-side reference should remain available without duplicating the full composer and attachment workflow or weakening the single active-chat model.

## 2026-11-14 — Derived global message view

SelfChat provides a permanent read-only All Messages view that derives one chronological timeline from the existing messages in active chats. Consecutive messages are grouped by their originating chat, and each message links back to its unchanged source record; Global View is never stored or managed as a chat.

Users may hide individual chats from All Messages through local visibility metadata. Hidden chats remain active and unchanged everywhere else, remain available in the visibility manager, and new chats are visible by default.

Reason: cross-topic review and exact-message navigation should be fast without duplicating local content, changing chat counts, or weakening the existing storage and privacy model.

## 2026-11-17 — File Explorer-style message movement

Messages can be selected individually, by Ctrl/Shift click, or with the existing timeline marquee, then dragged as one set onto a sidebar chat. An image message is selected and moved as one complete message with its image, caption, reply context, timestamp, and metadata; the separate image-copy control remains available for copying only the image. Dragging reuses the established move operation, preserves message IDs, timestamps, metadata, and persistence, and also works from All Messages without changing its derived-view model. This narrowly replaces the earlier “read-only” description of All Messages: it still owns no records and has no composer, but may invoke the same explicit move action on source messages.

Reason: moving captured thoughts between topic chats should be as direct and predictable as moving selected files between folders, without adding permanent controls or changing storage semantics.

## 2026-11-17 — Shared installable offline app foundation

SelfChat uses its web app manifest and service worker as the shared installable offline shell for the approved Windows and mobile initiatives. Installation reuses the browser-local data for the same origin and does not introduce synchronization, accounts, or message transmission. Platform packaging and mobile interaction work remain separate milestones.

Reason: strengthening the existing buildless PWA foundation is reversible and preserves local capture while avoiding premature platform forks or a privacy-boundary change.

## 2026-11-18 — Repository-native development continuity

**Updated by the 2026-11-18 low-interruption development authorization and the later automatic production deployment authorization.** Routine commits, pushes, and qualifying deployments for an explicitly authorized development task no longer require separate approval.

`FEATURE_BACKLOG.md` is the persistent source of truth for milestone status and remaining work, while `CLAUDE_HANDOFF.md` is the persistent source of truth for implementation details, verification results, blockers, next steps, and production verification. Live source remains authoritative for actual behavior, and this file remains authoritative for material product, architecture, privacy, storage, and deployment decisions. Every implementation updates both continuity files and reports Implemented, Tested, Committed, Pushed, Deployed, and Production verified as separate states.

Reason: Codex and ChatGPT sessions must be able to continue from repository history without the user manually transferring implementation reports or risking confusion between local work and released work.

## 2026-11-18 — Low-interruption authorized development

An explicitly authorized development task authorizes autonomous implementation, testing, debugging, documentation, and routine commits and pushes to the existing SelfChat GitHub repository. Separate confirmation is not required for ordinary commits or pushes within that scope. This standing authorization does not approve new features, production deployment, destructive operations, deletion of existing user data, credentials or access changes, security-sensitive changes, unexpected costs, material architectural changes, or bypassing Codex permission and sandbox restrictions.

This decision's requirement for separate production-deployment approval is superseded by the automatic production deployment authorization below. GitHub synchronization may be reported only after a successful push and remote-branch verification.

Reason: approved milestones should proceed without repetitive workflow interruptions while preserving deliberate approval boundaries for scope expansion, risk, cost, architecture, sensitive access, data loss, and production release.

## 2026-11-18 — Automatic production deployment authorization

An explicitly authorized SelfChat development task authorizes Codex to implement the approved scope, run all required automated and browser checks, fix discovered issues, update the backlog and handoff, commit and push verified changes, deploy the completed milestone to the existing SelfChat Vercel production project, and verify production. Routine qualifying deployments do not require separate approval.

Automatic deployment is permitted only when all required tests pass, existing functionality and user data are preserved, no unresolved critical defects remain, the release stays within the explicitly approved feature or milestone, and the target is the existing SelfChat Vercel project. A deployment failure must be reported without replacing the last working production version.

Separate approval remains required for destructive or irreversible operations; changes that may erase, corrupt, or incompatibly migrate existing user data; authentication, encryption, security, or privacy-boundary changes; enabling cloud synchronization or transmitting existing message content; new infrastructure, credentials, paid services, or unexpected costs; material architectural changes; and work outside the authorized scope. Safe local work may continue for these exceptions, but Codex must report the approval needed rather than deploy automatically.

Every task report and persistent GitHub handoff distinguishes Implemented, Tested, Committed, Pushed, Deployed, and Production verified. This decision supersedes the prior requirement for separate approval of every production deployment and does not authorize unrequested features.

Reason: the production app is the user's working copy, and routine verified releases should reach it without an extra approval round while data, privacy, security, cost, architecture, and scope changes retain deliberate gates.

## 2026-11-18 — SC-20 local synchronization foundation

`selfchat-unified-v1` remains the active local source of truth and advances non-destructively to IndexedDB schema version 2. Each browser profile and origin receives one random local device ID and a monotonic Lamport counter. Entity puts and deletes for chats, messages, stickers, drafts, Trash, attachment references, and synchronized organization preferences append immutable operations in the same transaction as the materialized local records. Existing profiles receive a one-time bootstrap operation set without rewriting their content.

Operation IDs combine device ID and counter. Merge is idempotent by operation ID; total order is counter, then binary device ID, then operation ID. The highest ordered operation for the same store and entity is the deterministic conflict winner. Attachment operations contain only reference metadata; blob bytes remain in the attachment store. Explicit permanent erasure also removes matching local operation history.

This milestone adds no backend, transport, account, authentication, device enrollment, encryption, remote-operation application, or blob transfer. Active-chat selection and backup bookkeeping remain device-local. SC-20 remains incomplete until those privacy and transport boundaries are separately implemented and verified.

Reason: durable local causality and deterministic convergence must exist before network synchronization, while preserving current data, offline capture, the unified transactional model, and the existing privacy boundary.

## 2026-11-18 — SC-20 encrypted envelope and enrollment boundary

Each local profile receives one random 256-bit sync key plus per-device P-256 signing and key-agreement credentials. Enrollment is authorization by an already trusted device: the requester signs its profile-bound request, the authorizer verifies possession, wraps the profile key using ephemeral ECDH with HKDF-SHA-256 and AES-256-GCM, and signs a short-lived grant. The accepting device must verify the grant against an independently trusted authorizer signing key.

Operation batches use AES-256-GCM with the profile key, authenticate profile ID, device ID, sequence, creation time, and operation IDs as additional data, and carry a device signature over the complete encrypted envelope. Receivers reject wrong-profile, invalid-signature, mismatched-content, and stale-sequence envelopes before application.

The backend boundary is a transport-neutral interface for encrypted envelopes and encrypted attachment chunks. It is unconfigured and disabled by default. Version 2.6.0 adds no endpoint, backend instance, account, pairing UI, remote operation application, blob transfer, or message transmission. Local plaintext storage remains unchanged; the sync key and private credentials stay inside the same browser-local privacy boundary until explicit pairing is implemented.

Reason: encryption and device authorization must be specified, persisted, and adversarially tested before any backend can receive user data or any remote operation can modify the local projection.

## 2026-11-18 — SC-20 direct pairing and transactional remote application

SelfChat exposes a direct-transfer pairing ceremony in Data settings. An existing device creates a signed ten-minute invitation and verification code; the joining device returns a signed request; the existing device returns a short-lived encrypted grant. The user compares the same code on both devices. Pairing text moves only through an explicit user copy/paste action, and no application transport or account is introduced.

Paired devices can manually exchange signed encrypted operation envelopes for testing. On receipt, SelfChat verifies the profile, authorized unblocked signer, monotonic envelope sequence, immutable operation identity, supported stores and actions, entity/value consistency, and the exclusion of device-local metadata. It then stores fresh operations, applies only deterministic conflict winners, advances the Lamport clock, and commits the replay cursor in one IndexedDB transaction. Normal record deletion propagates through the same winner rule.

Device blocking is intentionally local in v2.7.0 and is labeled as such. It rejects future envelopes on that browser but does not claim cryptographic revocation because the blocked device still knows the shared profile key. Automatic transport, key rotation, attachment chunks, permanent-erasure tombstones, and compaction remain disabled or unimplemented.

Reason: the enrollment and remote-application boundary must be usable and transactionally testable before backend selection, while revocation limitations must stay explicit rather than creating a false security guarantee.

## 2026-11-18 — SC-20 encrypted attachment packages

Attachment transfer is first exposed as an explicit local file package rather than automatic network transport. A package combines the existing signed encrypted operation envelope with current winning attachment references from that device. Blob bytes are split into independently authenticated AES-256-GCM chunks, and the device signs the manifest, sealed whole-file integrity metadata, and every ciphertext chunk. Filenames and MIME types remain inside the encrypted operation envelope rather than the outer chunk manifest.

Import accepts only the authorized unblocked device and matching sync profile, requires exactly one bundle for every current attachment put reference, verifies chunk count, order, length, AEAD authentication, signature, reference size, and reconstructed SHA-256 digest, and performs no IndexedDB mutation until all bundles pass. Winning blobs then commit atomically with operations, materialized records, logical clock, and replay cursor. Version 2.8.0 adds no endpoint, account, background transfer, or automatic transport.

Reason: attachment integrity and transactional no-partial-commit behavior must be proven independently of backend selection, while an explicit direct-transfer package lets paired-device behavior be exercised without expanding the hosted application's transmission boundary.

## 2026-11-18 — SC-20 profile-key rotation and durable revocation

Device revocation advances the existing sync profile to a strictly monotonic key epoch and generates a signed rotation package. The new random AES-256 profile key is wrapped independently through ephemeral ECDH, HKDF-SHA-256, and AES-GCM for each retained authorized device. Revoked and previously blocked devices receive no wrapped grant. Rotation packages preserve the existing profile ID and trusted device identities, reject unknown, omitted, substituted, revoked, stale, or skipped-epoch device state, and can be accepted only when signed by a currently authorized unblocked device.

Operation envelopes and attachment bundles authenticate the profile-key epoch and are rejected when they use an older or different epoch. Enrollment grants carry the current epoch so a newly paired device joins the active key generation. Rotation metadata and durable revocation state persist locally without rewriting chats, messages, attachments, Trash, snapshots, or operation history. Distribution remains an explicit copy/paste action; automatic transport and backend infrastructure remain disabled.

Reason: local blocking did not remove a device's knowledge of the shared key. Per-device wrapping of a replacement key creates actual forward revocation while retaining the existing direct-transfer privacy boundary and non-destructive local storage model.
