# SelfChat decisions

This file records material decisions that future chats must preserve unless the user explicitly replaces them.

## 2026-11-04 — Initial product

- SelfChat imitates the familiar two-column WhatsApp desktop layout.
- Every chat contains only the user; chats exist to separate topics, not people.
- The initial examples are NBA, Claude / Codex, and Soccer.
- The primary experience is desktop and keyboard-first.

Reason: the user already rambles to himself in WhatsApp Desktop and wants the same low-friction interaction without any risk of sending a message to another person.

## 2026-11-04 — Version 0.1 scope

Version 0.1 includes chat creation, renaming and deletion; text message creation, editing and deletion; current-chat search; local persistence; and JSON backup/restore.

Version 0.1 excludes other users, AI replies, accounts, cloud sync, voice notes, images, reactions, reminders, analytics, and elaborate organization.

Reason: real usage should generate improvement ideas organically. The first version should remain small enough to evaluate honestly.

## 2026-11-04 — Local-first storage

Chats and messages live in browser local storage under `selfchat-data-v1`. Vercel hosts only static application assets and does not receive message content.

Reason: privacy and simplicity matter more than cross-device sync for the first version.

## 2026-11-04 — Buildless implementation

The app uses plain HTML, CSS, and JavaScript with a dependency-free Node static server.

Reason: the codebase should remain easy to understand, modify, and deploy without framework or package-management overhead.

## 2026-11-05 — Persistent Codex project

The authoritative project folder is `C:\Users\alexc\Documents\Codex\SelfChat`. Multiple Codex chats may work from this folder, while `AGENTS.md` and this file preserve shared context.

Reason: repository files are a more reliable source of truth than expecting separate AI conversations to remember prior decisions.
