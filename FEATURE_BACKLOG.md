# SelfChat feature backlog

This file is the persistent source of truth for SelfChat milestone status and remaining work. It does **not** authorize implementation: all entries start as **Candidate**, only explicit user approval can move an item to **Approved**, and implementation requires a separately authorized, scoped task. Consult `AGENTS.md`, `DECISIONS.md`, `CLAUDE_HANDOFF.md`, and current source before work. Current code is authoritative for actual behavior; this file is authoritative for planning and completion status.

Status flow: Candidate → Approved → Implemented. Use project-prefixed stable IDs (`SC-1`, `SC-2`, etc.) for Codex references; never renumber existing entries. `SC` identifies SelfChat and avoids collisions with other projects.

After every implementation, update the affected milestone status and the active sequence so completed work and remaining work are explicit. Record deployment separately from implementation; an implemented milestone is not necessarily committed, pushed, or deployed.

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

| SC-19 | File Explorer-style message selection and drag-to-move | Click to select one message; drag from empty timeline space to marquee-select multiple messages; drag any selected message or selection onto a sidebar groupchat to move using existing move-message rules. Image messages select and move as one complete message with their image, caption, and metadata. Support selection highlights, translucent marquee, drag-count preview, valid-target highlighting, cancel/invalid-drop safety, and Global View. Preserve text selection, attachments, metadata, timestamps, ordering, and persistence; verify current implementation before coding. | Implemented in v2.3.1 |
| SC-20 | Offline-first storage with automatic cross-device synchronization | Keep local capture fully functional without connectivity, then synchronize chats, messages, organization, Trash, and attachments safely across the user's devices after reconnecting. | Approved; local, security, pairing, remote-application, and encrypted attachment-package foundations implemented through v2.8.0 |
| SC-21 | Installable Windows desktop application | Provide a supported Windows installation and app-like launch experience while preserving SelfChat's local-first behavior and data safeguards. | Approved |
| SC-22 | Installable mobile experience with offline functionality | Make SelfChat installable and usable on supported phones, with a mobile interaction model and reliable offline access to local data. | Approved |

## Active implementation sequence

- **v2.4.0 foundation (implemented, verified, and deployed):** shared browser-installable manifest, offline app-shell hardening, install entry point, and offline-readiness status. Automated and browser verification passed on 2026-11-18. This is prerequisite work for SC-21 and SC-22, but neither feature is complete.
- **SC-20 local foundation (implemented, verified, and deployed in v2.5.0):** `selfchat-unified-v1` schema version 2 preserves existing records and adds a durable random device identity, per-entity immutable operations committed atomically with local changes, Lamport counters, idempotent operation merging, deterministic conflict winners, bootstrap coverage for existing profiles, attachment references without blob duplication, and permanent-erasure cleanup of matching history. Automated, local-browser, authenticated production-fetch, and production-browser verification passed on 2026-11-18. No network, account, authentication, cloud storage, or encryption path exists yet, so SC-20 as a whole remains Approved rather than Implemented.
- **SC-20 security foundation (implemented, verified, and deployed in v2.6.0):** existing profiles receive one durable local AES-256 sync key plus ECDSA signing and ECDH agreement credentials without rewriting content. Signed enrollment requests prove requester key possession; trusted devices issue signed, short-lived grants that wrap the profile key with ephemeral ECDH/HKDF/AES-GCM. Operation batches are encrypted with authenticated headers, signed per device, and reject stale sequences. A contract-checked backend adapter defaults to disabled and no endpoint, account, cloud storage, or data transmission was added. All 74 tests plus local and production browser persistence/error passes passed on 2026-11-18. Deployment `dpl_Degghnk5MmJwMATFSf911hURbe6z` is READY at the stable production URL.
- **SC-20 pairing and remote-application foundation (implemented, verified, and deployed in v2.7.0):** Data settings provides direct-transfer invitation/request/grant pairing with a matching verification code, ten-minute expiry, and authorized-device visibility/local blocking. Users can manually copy signed encrypted operation updates between paired devices. Receipt verifies profile, authorized signer, sequence, immutable operation IDs, store/action/value shape, and device-local metadata boundaries before atomically storing operations, applying deterministic winners, advancing the Lamport clock, and persisting replay cursors. Normal put/delete propagation is covered; automatic transport remains off. All 78 tests plus local and production browser parity/persistence/error passes passed on 2026-11-18. Deployment `dpl_A8HAzkh9MFa6mzUT8m4xYMajhqHx` is READY at the stable production URL.
- **SC-20 encrypted attachment-package foundation (implemented, verified, and deployed in v2.8.0):** an authorized device can explicitly download a signed encrypted package containing its operation envelope plus current attachment bytes in independently authenticated 256 KiB AES-GCM chunks. The outer manifest excludes filenames and MIME types; encrypted integrity metadata binds the reconstructed whole-file hash. Import verifies the authorized signer, profile, reference metadata, chunk order/length, signature, AEAD tags, and whole-file digest before atomically committing winning attachment blobs with operations, materialized records, logical clock, and replay cursor. Damaged or incomplete packages commit nothing. The manual browser flow transferred all 3 local attachments while preserving 8 messages through reload. All 83 automated tests plus local and production browser parity/persistence/error passes passed on 2026-11-18. Deployment `dpl_DBfbxp6KGUERY4iXh2zRd52y7Zr1` is READY at the stable production URL. Automatic transport remains off.
- **SC-20 next milestone:** implement profile-key rotation and durable revocation, explicit cross-device permanent-erasure tombstones, operation compaction/retention, and offline/reconnect integration tests; only then select backend infrastructure and enable automatic synchronization.
- **SC-21:** remains Approved. Windows packaging/support and installation verification remain.
- **SC-22:** remains Approved. Mobile navigation/layout, touch interaction parity, platform installation guidance, and device testing remain.

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
