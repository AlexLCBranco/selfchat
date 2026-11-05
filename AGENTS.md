# SelfChat repository instructions

## Purpose

SelfChat is a desktop-first, WhatsApp-like app where every chat contains only the user. Chats separate topics such as NBA, AI tools, and soccer without creating any possibility of messaging another person.

Before changing the project, read `README.md` and `DECISIONS.md`. Treat the live source files and recorded decisions as authoritative; do not infer product requirements from prior chat memory.

## Product invariants

- SelfChat never has recipients, contacts, shared chats, or social features.
- User messages remain local to the current browser. The hosted application must not transmit or persist message content.
- Preserve the fast loop: open a chat, type, press Enter, see the message.
- Keep the product desktop-first until the user explicitly changes that priority.
- Do not add AI responses, accounts, cloud sync, analytics, attachments, or notifications without an explicit request.
- Prefer small improvements driven by observed use over speculative feature expansion.

## Technical shape

- The app is buildless HTML, CSS, and JavaScript.
- `index.html` owns the page structure.
- `styles.css` owns the visual system and desktop layout.
- `app.js` owns state, local persistence, chat/message behavior, search, and backup import/export.
- `server.js` is a dependency-free local static server.
- `service-worker.js` and `manifest.webmanifest` provide offline/installable behavior.
- Browser data uses the `selfchat-data-v1` local-storage key.

## Verification

For every code change, run at least:

```powershell
node --check app.js
node --check server.js
```

For behavior changes, run `node server.js`, exercise the changed flow in a browser, check persistence after reload when relevant, and inspect browser errors. Report only checks that actually ran.

## Context maintenance

- Update `DECISIONS.md` only for material product, architecture, privacy, storage, or deployment decisions.
- Keep recorded decisions concise and include the reason.
- If a new request contradicts an existing decision, flag the conflict and record the replacement after the user decides.
- Do not duplicate temporary progress or ordinary implementation details into durable context.

## External actions

Git pushes, new remote repositories, production deployments, access changes, credentials, and destructive data operations require explicit user authorization. Local reversible implementation and testing do not.
