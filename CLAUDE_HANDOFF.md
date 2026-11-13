# SelfChat handoff

## Current state

- The visible application version is **v0.9.2**.
- **Milestone 3 is complete** in the current working tree. Version 0.9 added local cross-chat message search, contextual in-chat search navigation, safe clickable HTTP(S) links, message selection, move, Trash, and cancel flows.
- Versions 0.9.1 and 0.9.2 are follow-up storage fixes for attachment self-repair and migration when attachment blobs are missing.
- The working tree contains substantial uncommitted work. The only Git commit is the initial project commit, so the live files—not Git history—are authoritative.

## What remains planned

There is **no documented Milestone 4 or detailed remaining-work roadmap**. Do not infer one.

The only explicit future direction recorded in `DECISIONS.md` is encrypted sync at a later stage. It is not implemented and should not be started without a new explicit request because the current product is browser-local and privacy-first.

An older decision mentions a future Trash interface, but that is superseded by later decisions and the current implementation: recoverable Trash, restore, permanent deletion, and Empty Trash already exist.

Future changes should follow observed use and explicit requests rather than speculative feature expansion.

## Start here

1. Read `AGENTS.md`, `README.md`, and `DECISIONS.md` completely.
2. Treat `index.html`, `styles.css`, `app.js`, `storage.js`, and `storage-core.js` as the current implementation.
3. Preserve the product invariants: self-only chats, local message content, desktop-first behavior, and familiar WhatsApp-like interactions.
4. Before changing anything, inspect the uncommitted working tree and do not discard it.

## Verification baseline

At handoff, these checks passed:

```powershell
node --check app.js
node --check server.js
node --check storage.js
node --check storage-core.js
node --test tests\storage-core.test.js
```

The storage test suite contained 16 passing tests.
