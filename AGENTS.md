# SelfChat repository instructions

## Purpose

SelfChat is a desktop-first, WhatsApp-like app where every chat contains only the user. Chats separate topics such as NBA, AI tools, and soccer without creating any possibility of messaging another person.

Before changing the project, read `README.md`, `DECISIONS.md`, `FEATURE_BACKLOG.md`, and `CLAUDE_HANDOFF.md`. Treat live source as authoritative for implemented behavior, `DECISIONS.md` as authoritative for durable product and architecture decisions, `FEATURE_BACKLOG.md` as authoritative for milestone status and remaining work, and `CLAUDE_HANDOFF.md` as authoritative for implementation continuity. Do not infer project state from prior chat memory.

## Product invariants

- SelfChat never has recipients, contacts, shared chats, or social features.
- User messages stay on this PC: the local SelfChat server writes them to the data folder on disk. Nothing transmits or persists message content anywhere else.
- Durability comes first: a change is saved only once the server has flushed it to disk; never show a blank or default state when data exists or cannot be read; deletes are explicit user actions, never derived from a difference.
- Preserve the fast loop: open a chat, type, press Enter, see the message.
- Keep the product desktop-first until the user explicitly changes that priority.
- Do not add AI responses, accounts, cloud sync, analytics, notifications, audio, or video without an explicit request. Images, stickers, and generic file attachments are established features.
- Prefer small improvements driven by observed use over speculative feature expansion.
- WhatsApp Desktop is the interaction baseline for familiar chat behaviors. When adding or changing messages, media, composer actions, search, menus, or keyboard flows, implement the ordinary expected interaction—not only a visual resemblance—and proactively check adjacent basic affordances before handoff.

## Technical shape

- The app is buildless HTML, CSS, and JavaScript.
- `index.html` owns the page structure.
- `styles.css` owns the visual system and desktop layout.
- `app.js` owns browser interaction, chat/message behavior, search, and the client side of saving (explicit operations sent to the server, live updates over server-sent events).
- `app-core.js` owns testable app behavior such as text sending (saved before shown), reply resolution, attachment-message construction, Trash undo, and selected-message copy formatting.
- `server.js` is the local server (127.0.0.1 only) and the only writer of the data folder; it serves the app and the `/api/` routes.
- `store.js` owns the append-only, checksum-chained log (`log.jsonl`), hash-named attachment files, the integrity check, the single-writer lock, and recovery points derived from the log.
- `store-core.js` owns the change operations shared by the server and the browser; `operationsForChange` refuses removals that no user action declared.
- `transfer.js` owns export and import of the JSON backup format; `backup.js` owns dated, verified, never-overwritten backups and retention; `import-backup.js` is the import command.
- `storage-core.js` owns pure state normalization used by the interface.
- `service-worker.js` and `manifest.webmanifest` provide the installable app shell; `/api/` requests are never cached.
- The data folder (default `Documents\SelfChat Data`) is the only source of truth. The browser keeps no authoritative copy. Backups go to the owner's chosen folder (default `Documents\SelfChat Backups`).

## Verification

For every code change, run at least:

```powershell
node --check app.js
node --check app-core.js
node --check server.js
node --check store.js
node --check store-core.js
node --check transfer.js
node --check backup.js
node --check import-backup.js
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
- Clearly distinguish whether work is implemented, tested, committed, pushed, and deployed. Never imply that one state guarantees another.

## Context maintenance

- After every implementation milestone, update `FEATURE_BACKLOG.md` with completed milestones and remaining work.
- After every implementation milestone, update `CLAUDE_HANDOFF.md` with implementation results, checks that actually ran, blockers, and next steps.
- Record material architectural decisions in `DECISIONS.md`; also update it for material product, privacy, storage, or deployment decisions.
- Keep recorded decisions concise and include the reason.
- If a new request contradicts an existing decision, flag the conflict and record the replacement after the user decides.
- Keep temporary narration out of durable context, but preserve the implementation facts needed for another Codex or ChatGPT session to continue without manual transfer.

## External actions

For an explicitly authorized development task or milestone, proceed autonomously through implementation, testing, debugging, documentation, and routine Git synchronization. Do not request repeated approval for routine steps already covered by the task, do not pause between independently necessary technical steps, and do not require separate confirmation for ordinary commits or pushes. After the work is complete and verified, automatically commit and push the approved implementation and its updated backlog, handoff, and applicable decisions to the existing SelfChat GitHub repository.

This standing authorization covers routine development, GitHub synchronization, and production deployment to the existing SelfChat Vercel project. It does not authorize new features or work outside the user's approved scope. Never claim GitHub is synchronized unless the push succeeds and the remote branch is verified at the pushed commit. Keep Git commits, pushes, deployments, and production verification as separate reported states.

After an explicitly authorized development task is complete, automatically deploy it to the existing SelfChat Vercel production project without requesting separate deployment approval only when all required tests pass, existing functionality and user data are preserved, no unresolved critical defects remain, and the deployment stays within the approved feature or milestone scope. Verify the production deployment and report its status. If deployment fails, report the failure and preserve the last working production version.

Require explicit approval for destructive or irreversible operations; changes that may erase, corrupt, or incompatibly migrate existing user data; authentication, encryption, security, or privacy-boundary changes; enabling cloud synchronization or transmitting existing message content; new infrastructure, credentials, paid services, or unexpected costs; material architectural changes; new remote repositories; and work outside the authorized feature or milestone. For these exceptions, complete safe local work and report the approval needed instead of deploying automatically. Respect Codex's actual permission and sandbox restrictions and never attempt to bypass them.
