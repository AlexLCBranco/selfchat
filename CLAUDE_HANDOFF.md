# SelfChat handoff

This file is the persistent implementation-continuity record shared across Codex and ChatGPT work. After every implementation, update it with what changed, checks that actually ran, blockers, and concrete next steps. Keep the state labels **Implemented**, **Tested**, **Committed**, **Pushed**, and **Deployed** separate.

## Current state

- The current visible source version is **v2.5.0**. Production remains **v2.4.0** at `https://selfchat-home.vercel.app` (deployment `dpl_3Xtdmro7xeuhpeFp2L5f3fFT5bSu`); v2.5.0 has not been deployed.
- v2.5.0 is the first safe implementation milestone for SC-20. It adds only the local synchronization substrate: device identity, logical ordering, durable atomic entity operations, idempotent merge, deterministic conflict selection, and non-destructive schema upgrade/bootstrap.
- SC-20 remains **Approved / in progress**, not fully Implemented. There is no backend, account, authentication, device enrollment, encryption, network transport, remote-operation application, or attachment transfer.
- SC-21 and SC-22 remain **Approved**. Windows-specific support/packaging and the mobile interaction model have not started.
- `FEATURE_BACKLOG.md` retains the approved SC-20 through SC-22 entries; preserve their status unless the user explicitly changes it.

## Delivery state

- **Implemented:** v2.5.0 local SC-20 foundation exists in the current working tree.
- **Tested:** yes. All required syntax checks, 68 automated tests, `git diff --check`, and the browser persistence/error pass described below passed on 2026-11-18.
- **Committed:** yes. Implementation commit `7267ab4` contains the v2.5.0 source, tests, decisions, backlog, and initial handoff report.
- **Pushed:** yes. `origin/main` was verified at full commit `7267ab45ecfb95598c603ac758c6664d9d49cb37` after the push.
- **Deployed:** no. Production intentionally remains v2.4.0; deployment requires explicit authorization.

## SC-20 local foundation — 2026-11-18

- **Storage upgrade:** `selfchat-unified-v1` advances from schema version 1 to 2 by adding an indexed `operations` store. The upgrade leaves all existing chats, messages, drafts, Trash, snapshots, stickers, attachments, and metadata in place.
- **Identity and bootstrap:** first open creates one random browser-profile/origin device ID and a logical counter. Existing local entities receive per-entity bootstrap operations; reopening is idempotent and does not regenerate identity or duplicate history.
- **Atomic tracking:** ordinary local puts/deletes and their operation records share one IndexedDB transaction. Operations cover chats, messages, stickers, drafts, Trash, attachment references, and All Messages visibility. Attachment operations omit blob bytes. Concurrent local commits are serialized so IDs and counters remain unique.
- **Ordering and conflict rule:** operation IDs are device ID plus counter. Operations deduplicate by ID and sort by Lamport counter, binary device ID, then operation ID. The greatest operation for a store/entity key wins deterministically, including delete-versus-update conflicts.
- **Data lifecycle:** point-in-time state replacement emits operations; explicit permanent erasure removes matching operation history as well as existing local and legacy copies.
- **Privacy boundary:** no network call, cloud storage, account, authentication, encryption, remote ingest, or attachment transfer was added.
- **Checks:** `node --check app.js`, `app-core.js`, `server.js`, `storage.js`, `storage-core.js`, and `service-worker.js`; all 68 automated tests; and `git diff --check` passed. Browser verification at `http://127.0.0.1:47832` loaded v2.5.0 over the existing local profile, preserved all 8 visible messages and the persisted-storage status after reload, and showed no console warnings or errors. The pass made no user-data changes.
- **Remaining risks:** the deterministic last-writer rule is defined but remote validation/application is not implemented; unbounded operation retention and future compaction are unresolved; attachment bytes need encrypted chunk transfer and integrity checks; cross-device permanent-deletion propagation needs an encrypted tombstone design that does not conflict with local permanent-erasure guarantees.
- **Next recommended step:** design and implement encrypted operation envelopes, authenticated device enrollment, and a minimal backend boundary before adding any transport. Keep remote application disabled until envelope validation, replay protection, deletion semantics, and attachment integrity tests pass.

## Automatic deployment policy — 2026-11-18

- Explicitly authorized SelfChat development tasks now carry standing authorization through implementation, required automated and browser verification, fixes, continuity updates, commit, push, deployment to the existing SelfChat Vercel production project, and production verification.
- Automatic deployment is allowed only after all required tests pass, existing functionality and user data are preserved, no unresolved critical defects remain, and the release stays within the approved scope and existing production target.
- Separate approval remains required for destructive or irreversible work; potentially erasing, corrupting, or incompatible data migrations; authentication, encryption, security, or privacy-boundary changes; cloud sync or transmission of existing messages; new infrastructure, credentials, paid services, unexpected costs, material architecture changes, and out-of-scope work.
- Every persistent handoff must distinguish **Implemented**, **Tested**, **Committed**, **Pushed**, **Deployed**, and **Production verified**. A failed deployment must be reported while preserving the last working production version.
- This policy supersedes the prior requirement for separate approval of each production deployment and does not authorize unrequested features.

## Prior continuity update — 2026-11-18

- **Low-interruption development policy:** an explicitly authorized development task carries standing authorization for autonomous implementation, testing, debugging, documentation, and routine commit/push synchronization to the existing SelfChat GitHub repository. Its separate-deployment-approval rule is superseded by the automatic deployment policy above for qualifying releases. Codex permission and sandbox restrictions remain binding.
- **Repository synchronization:** the durable `AGENTS.md` rules now explicitly require milestone backlog updates, implementation-result and next-step handoffs, architectural decision records, approved report-inclusive commits and pushes, successful-push verification before claiming GitHub synchronization, and a strict separation between Git pushes and production deployments.
- **Implemented:** repository guidance now makes `FEATURE_BACKLOG.md` and this handoff the durable cross-session records for development status and implementation continuity. `AGENTS.md`, `README.md`, and `DECISIONS.md` describe the same hierarchy and approval boundaries.
- **Tested:** `git diff --check`, all repository-required syntax checks, all 59 automated tests, and the v2.4.0 browser parity pass passed.
- **Committed:** yes; release commit `4b373c1`.
- **Pushed:** yes; `origin/main` includes `4b373c1`.
- **Deployed:** yes; production deployment `dpl_3Xtdmro7xeuhpeFp2L5f3fFT5bSu` is READY at the stable URL.
- **Blockers:** none for the continuity workflow.
- **Next step:** use these records in every future implementation; automatically commit, push, deploy, and production-verify completed qualifying work within an explicitly authorized task, while obtaining explicit approval for the listed safeguard exceptions.

## Architecture and privacy boundary

- `selfchat-unified-v1` remains the only active data source. Source v2.5.0 uses IndexedDB schema version 2 and adds operation/history metadata without replacing or clearing existing records.
- Device ID is local random metadata, not an account or authentication credential. Lamport order is deterministic but does not claim wall-clock chronology.
- Operation payloads remain local plaintext inside the existing browser privacy boundary. Attachment operations contain references and metadata, while blob bytes stay in `attachments`.
- The installed app uses the same browser profile and origin data. It does not copy, upload, or synchronize message content.
- `service-worker-core.js` owns the small testable cache-policy decisions. `service-worker.js` owns browser service-worker lifecycle and fetching.
- Failed responses and cross-origin responses are not added to the offline cache. Navigation failures fall back to the cached app shell.
- Before network synchronization, define encryption/key recovery, authenticated device enrollment, backend retention and access boundaries, remote validation/application, attachment transfer/integrity, compaction, and cross-device deletion semantics.

## Verification baseline

Run the complete repository-required checks after every code change:

```powershell
node --check app.js
node --check app-core.js
node --check server.js
node --check storage.js
node --check storage-core.js
node --check service-worker.js
npm test
```

The 2026-11-18 v2.4.0 browser pass served `http://127.0.0.1:47832` and confirmed:

- Data settings opens and closes through both its Done button and Escape.
- The offline app shell reports ready while online.
- Reload succeeds with the local server stopped, with all 8 existing messages and 3 attachments still available from browser-local storage/cache.
- Reload succeeds again after the local server restarts.
- No browser console warnings or errors were present.

The user explicitly approved commit, push, and production deployment for v2.4.0 on 2026-11-18. Future explicitly authorized development tasks carry standing authorization for routine commits, pushes, qualifying production deployments to the existing SelfChat Vercel project, and production verification.

## Current blockers and next steps

- No blocker is recorded for maintaining project context.
- v2.4.0 release, push, deployment, and protected-production verification are complete.
- v2.5.0 implementation, verification, commit, and push are complete. Do not deploy without explicit authorization.
- Continue SC-20 with encrypted envelopes, device enrollment, and backend-boundary design; do not add transport before those safeguards and tests exist.
