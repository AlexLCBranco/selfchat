# SelfChat repository instructions

## Purpose

SelfChat is a desktop-first, WhatsApp-like app where every chat contains only the user. Chats separate topics such as NBA, AI tools, and soccer without creating any possibility of messaging another person.

Before changing the project, read `README.md` and `DECISIONS.md`. Treat the live source files and recorded decisions as authoritative; do not infer product requirements from prior chat memory.

## Product invariants

- SelfChat never has recipients, contacts, shared chats, or social features.
- User messages remain local to the current browser. The hosted application must not transmit or persist message content.
- Preserve the fast loop: open a chat, type, press Enter, see the message.
- Keep the product desktop-first until the user explicitly changes that priority.
- Do not add AI responses, accounts, cloud sync, analytics, notifications, audio, or video without an explicit request. Images, stickers, and generic file attachments are established features.
- Prefer small improvements driven by observed use over speculative feature expansion.
- WhatsApp Desktop is the interaction baseline for familiar chat behaviors. When adding or changing messages, media, composer actions, search, menus, or keyboard flows, implement the ordinary expected interaction—not only a visual resemblance—and proactively check adjacent basic affordances before handoff.

## Technical shape

- The app is buildless HTML, CSS, and JavaScript.
- `index.html` owns the page structure.
- `styles.css` owns the visual system and desktop layout.
- `app.js` owns browser interaction, chat/message behavior, search, and backup workflows.
- `app-core.js` owns testable app behavior such as optimistic text sending, reply resolution, attachment-message construction, Trash undo, and selected-message copy formatting.
- `storage.js` owns the unified IndexedDB repository, migration, atomic changed-record commits, daily snapshots, and permanent erasure.
- `storage-core.js` owns pure storage normalization, merge, validation, backup, attachment-reference, and redaction logic.
- `server.js` is a dependency-free local static server.
- `service-worker.js` and `manifest.webmanifest` provide offline/installable behavior.
- The `selfchat-unified-v1` IndexedDB database is the active source of truth for chats, messages, drafts, Trash, snapshots, and attachment blobs. Legacy v0.9.2 sources remain migration and rollback inputs for this storage version; explicit permanent erasure also redacts matching legacy copies.
- Message content stays inside the current browser profile and origin. Automatic folder backups and manual JSON exports are user-initiated local writes, not network transmission.

## Verification

For every code change, run at least:

```powershell
node --check app.js
node --check app-core.js
node --check server.js
node --check storage.js
node --check storage-core.js
node --check service-worker.js
npm test
```

For behavior changes, run `node server.js`, exercise the changed flow in a browser, check persistence after reload when relevant, and inspect browser errors. Report only checks that actually ran.

Before handing off a familiar WhatsApp-like interaction, perform a brief parity pass for obvious click, keyboard, close/cancel, preview, and reload behavior so the user does not have to identify basic usability omissions.

## Reporting

- Include the current visible SelfChat version in every implementation or verification report to the user.
- Read the version from the live source rather than relying on prior chat memory.
- After every application change, include a clickable link to the deployed SelfChat version. Clearly say when a change has not been deployed yet; do not present the production link as containing an undeployed build.

## Context maintenance

- Update `DECISIONS.md` only for material product, architecture, privacy, storage, or deployment decisions.
- Keep recorded decisions concise and include the reason.
- If a new request contradicts an existing decision, flag the conflict and record the replacement after the user decides.
- Do not duplicate temporary progress or ordinary implementation details into durable context.

## External actions

Git pushes, new remote repositories, production deployments, access changes, credentials, and destructive data operations require explicit user authorization. Local reversible implementation and testing do not.
