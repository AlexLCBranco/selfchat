# SelfChat

SelfChat is a private, desktop-first message stream organized into multiple chats containing only you.

## Run locally

Double-click `Start SelfChat.cmd`, or run:

```powershell
node server.js
```

Then open <http://127.0.0.1:47831>.

## Production

The current Vercel production alias is:

<https://swift-oxygen-23pz0zc-alexlcbrancos-projects.vercel.app>

Vercel deployment protection is currently enabled. The local `.vercel/project.json` links this folder to the existing Vercel project and is intentionally ignored by Git.

## Data and privacy

- Messages and chats are stored in browser local storage.
- Message content is not sent to Vercel or another backend.
- Each browser profile and origin has its own separate data.
- Use the in-app export command to create a JSON backup.
- Import replaces the current browser's SelfChat data.

## Working with Codex

Open `C:\Users\alexc\Documents\Codex\SelfChat` as the project folder. New Codex chats created for this project share the repository files and automatically receive `AGENTS.md` as persistent guidance.

Use separate chats for bounded topics—product decisions, bugs, features, or deployment—while keeping durable facts in `DECISIONS.md` rather than relying on chat memory.

## Project files

- `AGENTS.md` — durable instructions for Codex
- `DECISIONS.md` — product and technical source of truth
- `index.html`, `styles.css`, `app.js` — application source
- `server.js` — local static server
- `service-worker.js`, `manifest.webmanifest`, `icon.svg` — installable app assets
