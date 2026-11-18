# SelfChat handoff

This file is the persistent implementation-continuity record shared across Codex and ChatGPT work. After every implementation, update it with what changed, checks that actually ran, blockers, and concrete next steps. Keep the state labels **Implemented**, **Tested**, **Committed**, **Pushed**, and **Deployed** separate.

## Current state

- The current visible source version is **v2.4.0**.
- v2.4.0 is deployed at `https://selfchat-home.vercel.app` (deployment `dpl_EREJxjhSToG8EG9YpnHXRTq3A59w`). Deployment protection remains enabled.
- v2.4.0 is the first shared implementation milestone for approved SC-21 and SC-22: it adds an in-app browser install entry point, offline-readiness feedback, explicit manifest identity/scope, and a guarded same-origin offline cache policy.
- SC-20, SC-21, and SC-22 remain **Approved**, not Implemented. SC-20 synchronization has not started. Windows-specific support/packaging and the mobile interaction model have not started.
- `FEATURE_BACKLOG.md` had pre-existing uncommitted approval entries for SC-20 through SC-22. Preserve them.

## Delivery state

- **Implemented:** v2.4.0 exists in the current working tree.
- **Tested:** yes. All required syntax checks, 59 automated tests, and the browser parity pass described below passed on 2026-11-18.
- **Committed:** pending the approved release commit.
- **Pushed:** pending the approved push to `origin/main`.
- **Deployed:** v2.4.0 is recorded as deployed at the production URL and deployment identifier above. Deployment remains an explicit-approval action for future changes.

## Latest continuity update — 2026-11-18

- **Implemented:** repository guidance now makes `FEATURE_BACKLOG.md` and this handoff the durable cross-session records for development status and implementation continuity. `AGENTS.md`, `README.md`, and `DECISIONS.md` describe the same hierarchy and approval boundaries.
- **Tested:** `git diff --check`, all repository-required syntax checks, all 59 automated tests, and the v2.4.0 browser parity pass passed.
- **Committed:** pending the approved release commit.
- **Pushed:** pending the approved push.
- **Deployed:** the existing production deployment is unchanged until the approved release deployment completes.
- **Blockers:** none for the continuity workflow.
- **Next step:** use these records in every future implementation, and obtain explicit approval before any commit, push, or deployment.

## Architecture and privacy boundary

- `selfchat-unified-v1` remains the only active data source. This milestone changes no IndexedDB schema or records.
- The installed app uses the same browser profile and origin data. It does not copy, upload, or synchronize message content.
- `service-worker-core.js` owns the small testable cache-policy decisions. `service-worker.js` owns browser service-worker lifecycle and fetching.
- Failed responses and cross-origin responses are not added to the offline cache. Navigation failures fall back to the cached app shell.
- Before SC-20 implementation, document and approve encryption, device identity, conflict resolution, attachment handling, deletion semantics, backend boundaries, and migration.

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

The user explicitly approved commit, push, and production deployment on 2026-11-18. Future releases still require explicit authorization.

## Current blockers and next steps

- No blocker is recorded for maintaining project context.
- Complete the approved v2.4.0 commit, push, and production deployment, then record their identifiers here.
- Continue SC-21 and SC-22 only through separately approved scoped work; design SC-20 before implementation as described above.
