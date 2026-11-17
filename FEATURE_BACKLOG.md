# SelfChat feature backlog

This is a list of product ideas for discussion, **not authorization to implement**. All entries start as **Candidate**. Only explicit user approval can move an item to **Approved**; implementation requires a separately authorized, scoped task. Consult `AGENTS.md`, `DECISIONS.md`, and current source before work. Current code is authoritative for behavior; the descriptions below are proposals, not verified specifications.

Status flow: Candidate → Approved → Implemented. Use project-prefixed stable IDs (`SC-1`, `SC-2`, etc.) for Codex references; never renumber existing entries. `SC` identifies SelfChat and avoids collisions with other projects.

| ID | Feature | Intended benefit | Status |
|---|---|---|---|
| SC-1 | Custom chat avatars | Upload a chat image rather than choosing only a preset emoji; optional during creation, editable later. | Implemented in v1.1.0 |
| SC-2 | Pin favorite chats | Keep frequently used chats readily accessible in the sidebar. | Implemented in v1.2.0 |
| SC-3 | Manually reorder chats | Arrange chats independently of latest-message order. | Implemented in v1.3.0 |
| SC-4 | Star/bookmark messages | Retrieve important prompts, documents, and ideas quickly. | Implemented in v1.4.0 |
| SC-5 | Pin messages permanently | Keep important reference messages accessible within a chat. | Implemented in v1.4.0 |
| SC-6 | Media and file gallery | Browse images, documents, and attachments without scrolling through chat history. | Implemented in v1.5.0 |
| SC-7 | Search by message type | Filter search results to files, images, links, or text. | Implemented in v1.5.0 |
| SC-8 | Rename individual messages | Give long prompts recognizable labels without altering their contents. | Implemented in v1.7.0 |
| SC-9 | Direct links to messages | Jump to a specific message inside SelfChat. | Implemented in v1.7.0 |
| SC-10 | Duplicate messages | Reuse earlier prompts or notes without changing originals. | Implemented in v1.7.0 |
| SC-11 | Chat-specific notes | Keep project reference information outside the chronological message stream. | Implemented in v2.0.0 |
| SC-12 | Collapse long messages | Reduce screen space consumed by large prompts while preserving expandability. | Implemented in v1.6.0 |
| SC-13 | Code blocks with copy buttons | Improve reading and reuse of stored code snippets. | Implemented in v1.6.0 |
| SC-14 | Filter by date range | Find messages from a remembered day or period. | Implemented in v1.5.0 |
| SC-15 | Split chat view | Reference two conversations side by side. | Implemented in v2.0.0 |
| SC-16 | Keyboard chat switcher | Jump between chats quickly without using the mouse. | Implemented in v1.3.0 |
| SC-17 | Optional message tags | Organize messages after capture, without mandatory categorization. | Implemented in v1.7.0 |
| SC-18 | Named timeline sections | Insert optional named or unnamed dividers within a chat to separate trains of thought without creating subchats. V1 proposal: create at end or before an existing message; rename/delete dividers without affecting messages; preserve chronological timeline, composer, date separators, and Global View. Exclude auto-sections, collapsing, nested sections, and section-specific navigation/search. | Candidate |

| SC-19 | File Explorer-style message selection and drag-to-move | Click to select one message; drag from empty timeline space to marquee-select multiple messages; drag any selected message or selection onto a sidebar groupchat to move using existing move-message rules. Support selection highlights, translucent marquee, drag-count preview, valid-target highlighting, cancel/invalid-drop safety, and Global View. Preserve text selection, attachments, metadata, timestamps, ordering, and persistence; verify current implementation before coding. | Implemented in v2.3.0 |

## Strongest candidates from the initial discussion

- #6 — Media and file gallery
- #4 — Message bookmarks
- #16 — Keyboard chat switcher
- #12 — Collapsible long messages

These are discussion priorities, **not approvals or an implementation order**.

## Product evaluation guardrails

- Preserve the fast capture loop: switch chat, paste/type, Enter.
- Avoid mandatory categorization, forms, titles, statuses, or extra clicks.
- Distinguish capture friction from retrieval friction.
- Prefer capabilities that solve observed problems over speculative feature expansion.
- Do not treat the word “missing” as meaning WhatsApp lacks the feature; some ideas already exist in WhatsApp.
- Verify actual SelfChat behavior in current source before claiming any candidate is absent.
- Discuss scope and tradeoffs before implementation. Do not modify code merely because a candidate appears here.
