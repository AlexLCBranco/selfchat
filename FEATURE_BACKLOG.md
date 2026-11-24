# Feature backlog — SelfChat

Planned work only, nothing built. Shipped items move to `BUILT.md`; ideas that are not planned live in `IDEAS.md`.
IDs are SC-1, SC-2, ... (never reused or renumbered). Status: Candidate → Approved. Only the owner approves.

## Next

- **SC-23 switch-over (owner step):** import the real backup into `Documents\SelfChat Data` with `node import-backup.js`, confirm `RESULT: MATCH`, then merge branch `storage-rebuild` into `main`. Until then `main` and the hosted site stay on v2.10.0.

## Approved

| ID | Feature | Notes |
|---|---|---|
| SC-21 | Installable Windows desktop application | Supported Windows install and app-like launch. Now also needs the local server to start with the app. |
| SC-22 | Installable mobile experience with offline functionality | Out of scope for the storage rebuild; with disk storage on the PC this needs a new design before work starts. |

## Candidate

| ID | Feature | Notes |
|---|---|---|
| SC-18 | Named timeline sections | Optional named or unnamed dividers inside a chat; rename/delete without affecting messages; no auto-sections, collapsing, nesting, or section search. |

## Product evaluation guardrails

- Preserve the fast capture loop: switch chat, paste/type, Enter.
- Avoid mandatory categorization, forms, titles, statuses, or extra clicks.
- Prefer capabilities that solve observed problems over speculative feature expansion.
- Verify actual SelfChat behavior in current source before claiming any candidate is absent.
