# SelfChat

SelfChat is a private, desktop-first message stream organized into multiple chats containing only you.

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
- On the first run of this storage version, v0.9.2 data is copied and count-verified before the unified database activates. The old sources remain in place for this version.
- SelfChat asks the browser for persistent storage. The result is shown in the always-visible data status panel.
- Message content is not sent to Vercel or another backend.
- Each browser profile and origin has its own separate data. In particular, `http://127.0.0.1:47832` and `https://selfchat-home.vercel.app` are separate datasets; opening one does not show or change messages stored by the other.
- A supported browser can remember a user-chosen folder and write a full automatic backup there after significant changes and at least daily. The data status panel warns when folder backup is unavailable.
- Use the in-app export command to create a JSON backup.
- Import and recovery restore merge by stable IDs and never delete data merely because it is absent from the incoming backup.
- Message options can move one or several selected messages to another chat, including the permanent Unsorted chat, without changing message IDs or dates.
- Sidebar search finds chats and message content locally, while in-chat search navigates matches in context.
- Deleting a message or chat moves it to Data settings → Trash. Permanent erasure removes matching browser-local history, recovery, migration, and unreferenced attachment copies after an irreversible-action confirmation.
- Restored messages return to their original chat when it exists, otherwise to Unsorted. Local attachment bytes remain retained while live content, Trash, stickers, recovery points, or safety backups can still reference them.
- Recovery points are point-in-time restores. SelfChat keeps at most one point per day for 30 days.

## Working with Codex

Open `C:\Users\alexc\Documents\Codex\SelfChat` as the project folder. New Codex chats created for this project share the repository files and automatically receive `AGENTS.md` as persistent guidance.

Use separate chats for bounded topics—product decisions, bugs, features, or deployment—while keeping durable facts in `DECISIONS.md` rather than relying on chat memory.

## Project files

- `AGENTS.md` — durable instructions for Codex
- `DECISIONS.md` — product and technical source of truth
- `index.html`, `styles.css`, `app.js` — application source
- `server.js` — local static server
- `service-worker.js`, `manifest.webmanifest`, `icon.svg` — installable app assets
