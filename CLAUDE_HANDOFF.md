# SelfChat handoff

This file is the persistent implementation-continuity record shared across Codex and ChatGPT work. After every implementation, update it with what changed, checks that actually ran, blockers, and concrete next steps. Keep the state labels **Implemented**, **Tested**, **Committed**, **Pushed**, and **Deployed** separate.

## Current state

- The current visible source version is **v2.4.0**.
- v2.4.0 is deployed at `https://selfchat-home.vercel.app` (deployment `dpl_3Xtdmro7xeuhpeFp2L5f3fFT5bSu`). Deployment protection remains enabled.
- v2.4.0 is the first shared implementation milestone for approved SC-21 and SC-22: it adds an in-app browser install entry point, offline-readiness feedback, explicit manifest identity/scope, and a guarded same-origin offline cache policy.
- SC-20, SC-21, and SC-22 remain **Approved**, not Implemented. SC-20 synchronization has not started. Windows-specific support/packaging and the mobile interaction model have not started.
- `FEATURE_BACKLOG.md` retains the approved SC-20 through SC-22 entries; preserve their status unless the user explicitly changes it.

## Delivery state

- **Implemented:** v2.4.0 exists in the current working tree.
- **Tested:** yes. All required syntax checks, 59 automated tests, and the browser parity pass described below passed on 2026-11-18.
- **Committed:** yes. Release commit `4b373c1` contains the v2.4.0 implementation, tests, backlog, and continuity rules.
- **Pushed:** yes. `4b373c1` is on `origin/main`.
- **Deployed:** yes. Deployment `dpl_3Xtdmro7xeuhpeFp2L5f3fFT5bSu` is READY and aliased to the production URL above. Deployment remains an explicit-approval action for future changes.

## Latest continuity update — 2026-11-18

- **Low-interruption development policy:** an explicitly authorized development task now carries standing authorization for autonomous implementation, testing, debugging, documentation, and routine commit/push synchronization to the existing SelfChat GitHub repository. Separate approval remains required for production deployment, destructive or user-data deletion operations, credentials or access changes, security-sensitive changes, unexpected costs, material architectural changes, and work outside the approved scope. Codex permission and sandbox restrictions remain binding.
- **Repository synchronization:** the durable `AGENTS.md` rules now explicitly require milestone backlog updates, implementation-result and next-step handoffs, architectural decision records, approved report-inclusive commits and pushes, successful-push verification before claiming GitHub synchronization, and a strict separation between Git pushes and production deployments.
- **Implemented:** repository guidance now makes `FEATURE_BACKLOG.md` and this handoff the durable cross-session records for development status and implementation continuity. `AGENTS.md`, `README.md`, and `DECISIONS.md` describe the same hierarchy and approval boundaries.
- **Tested:** `git diff --check`, all repository-required syntax checks, all 59 automated tests, and the v2.4.0 browser parity pass passed.
- **Committed:** yes; release commit `4b373c1`.
- **Pushed:** yes; `origin/main` includes `4b373c1`.
- **Deployed:** yes; production deployment `dpl_3Xtdmro7xeuhpeFp2L5f3fFT5bSu` is READY at the stable URL.
- **Blockers:** none for the continuity workflow.
- **Next step:** use these records in every future implementation; automatically commit and push completed, verified work within an explicitly authorized task, and obtain explicit approval before any production deployment or other approval-gated action.

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

The user explicitly approved commit, push, and production deployment for v2.4.0 on 2026-11-18. Future explicitly authorized development tasks carry standing authorization for routine commits and pushes to the existing repository, while every production deployment still requires separate explicit authorization.

## Current blockers and next steps

- No blocker is recorded for maintaining project context.
- v2.4.0 release, push, deployment, and protected-production verification are complete.
- Continue SC-21 and SC-22 only through separately approved scoped work; design SC-20 before implementation as described above.
