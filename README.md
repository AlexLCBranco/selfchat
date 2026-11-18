# SelfChat

SelfChat v2.7.0 is a private, desktop-first message stream organized into multiple chats containing only you.

It supports fast text entry, a derived chronological All Messages view with per-chat visibility controls, chat-specific notes, a two-chat desktop split view, pinned and manually ordered chats, titled/tagged/duplicated messages, direct message links, starred and permanently pinned messages, collapsible long messages, fenced code blocks with copy controls, media/link/file galleries, type and date-filtered search, keyboard chat switching, custom local-image chat avatars, replies with quoted context, images, stickers, generic file attachments, local search, File Explorer-style message selection and drag-to-move, selected-message copy and move, recoverable Trash, daily recovery points, and local backup import/export. It has no recipients, accounts, AI replies, analytics, or cloud sync.

The first three SC-20 implementation milestones add the local synchronization substrate, its security boundary, and a manual pairing/test path: durable device and sync-profile identities, atomic entity operations, authenticated short-lived device enrollment, signed AES-GCM envelopes, authorized-device controls, transactional remote application, and replay cursors. The backend adapter remains unconfigured, so SelfChat still does not transmit data automatically. Attachment transfer, key rotation, compaction, and a deployed backend remain future SC-20 work.

## Run locally

Double-click `Start SelfChat.cmd`, or run:

```powershell
node server.js
```

Then open <http://127.0.0.1:47832>.

## Production

The stable Vercel production URL is:

<https://selfchat-home.vercel.app>

The domain is attached to the project and follows future production deployments automatically. Vercel deployment protection is currently enabled. The local `.vercel/project.json` links this folder to the existing Vercel project and is intentionally ignored by Git.

## Data and privacy

- Chats, messages, drafts, Trash, recovery points, images, and attachments are stored in one transactional IndexedDB database.
- Messages and attachment blobs commit atomically. Ordinary saves write only changed records.
- Each local entity change commits an immutable operation and logical clock update in the same transaction. Existing unified data is preserved and receives a one-time bootstrap history when schema version 2 opens.
- Device identity is random and local to the current browser profile and origin. A local sync profile key and per-device signing/key-agreement credentials are created once and retained without changing message data.
- Enrollment requests prove possession of the requesting device key. A trusted device can sign a short-lived grant and transfer the profile key through ephemeral ECDH plus HKDF; operation envelopes use AES-256-GCM and device signatures, with authenticated sequence metadata for replay rejection.
- Data settings provides a direct-transfer pairing ceremony with matching verification codes. Authorized devices can exchange encrypted update text manually; received operations are validated and applied atomically, with deterministic conflicts and durable replay rejection.
- Blocking a device currently prevents its future envelopes from applying on that browser only. It does not rotate the shared profile key, so the interface states this limitation explicitly.
- The backend boundary accepts encrypted envelopes and attachment chunks only, but no adapter, endpoint, account, or transport is configured. Attachment operations still track blob references and metadata without duplicating blob bytes.
- Optional custom chat avatars are locally cropped and stored with other attachment blobs; emoji icons remain available as fallbacks.
- On the first run of this storage version, v0.9.2 data is copied and count-verified before the unified database activates. The old sources remain in place for this version.
- SelfChat asks the browser for persistent storage. The result is shown in the always-visible data status panel.
- Message content is not sent to Vercel or another backend.
- Each browser profile and origin has its own separate data. In particular, `http://127.0.0.1:47832` and `https://selfchat-home.vercel.app` are separate datasets; opening one does not show or change messages stored by the other.
- A supported browser can remember a user-chosen folder and write a full automatic backup there after significant changes and at least daily. The data status panel warns when folder backup is unavailable.
- Use the in-app export command to create a JSON backup.
- Backup import merges by stable IDs and never deletes data merely because it is absent from the incoming backup. Recovery points replace the active local projection with the selected historical state after preserving the current day when needed.
- Message options can move one or several selected messages to another chat, including the permanent Unsorted chat, without changing message IDs or dates.
- Replies keep a quoted preview and follow the original when it is edited or moved; they remain understandable when the original is in Trash or permanently deleted.
- Images and generic files can be chosen, pasted, or dropped. Files show their name and size and can be opened or downloaded locally. Attachments are included in manual and automatic backups.
- Selected messages can be copied as clean chronological text without names or timestamps.
- Sidebar search finds chats and message content locally, while in-chat search navigates matches in context.
- Each chat can keep a separate local note outside its message stream. Notes are included in backups, recovery, Trash restore, and permanent erasure with the chat.
- Split view can keep a second chat visible beside the active composer. The companion pane is read-only and can be swapped into the primary pane without losing the paired view.
- Deleting a message or chat moves it to Data settings → Trash. Permanent erasure removes matching browser-local history, recovery, migration, and unreferenced attachment copies after an irreversible-action confirmation.
- Restored messages return to their original chat when it exists, otherwise to Unsorted. Local attachment bytes remain retained while live content, Trash, stickers, recovery points, or safety backups can still reference them.
- Recovery points are point-in-time restores. SelfChat keeps at most one point per day for 30 days.

## Working with Codex

Open `C:\Users\alexc\Documents\Codex\SelfChat` as the project folder. New Codex chats created for this project share the repository files and automatically receive `AGENTS.md` as persistent guidance.

Use separate chats for bounded topics—product decisions, bugs, features, or deployment—while keeping durable state in the repository rather than relying on chat memory. `FEATURE_BACKLOG.md` tracks milestone status and remaining work, `CLAUDE_HANDOFF.md` carries implementation continuity and verification results, and `DECISIONS.md` records material product and technical decisions.

## Project files

- `AGENTS.md` — durable instructions for Codex
- `DECISIONS.md` — product and technical source of truth
- `FEATURE_BACKLOG.md` — milestone status and remaining-work source of truth
- `CLAUDE_HANDOFF.md` — implementation, verification, blocker, and next-step handoff
- `index.html`, `styles.css`, `app.js`, `app-core.js` — interface and application behavior
- `storage.js`, `storage-core.js` — unified IndexedDB repository and pure storage logic
- `sync-crypto.js`, `sync-backend.js` — encrypted-envelope, device-enrollment, and disabled transport-boundary primitives
- `tests/` — app, storage, migration, backup, and durability regression tests
- `server.js` — local static server
- `service-worker.js`, `service-worker-core.js`, `manifest.webmanifest`, `icon.svg` — installable offline app assets and testable cache policy
