# Paywall recovery fixes

Scope confirmed 2026-10-16. Self-review only; no subagents authorized.

- Recover the exact retained request after failed paid continuation, including existing IndexedDB records left by PR #27. Query the owned billing task before retry: missing reuses its ID, released gets a fresh ID, running/ready/committed stays in recovery, unavailable status remains locked. Preserve input, attachments, owner, canvas and expiry safeguards; no automatic retry loop or duplicate charge.
- Offer an explicit retry after recoverable failures and reload. Successful receipt removes the retained operation.
- Allow ordinary native patch edits to remove the final node. Keep visible-content protection for first-diagram delivery and reject empty create/replace results for every account.
- State 20 signup credits consistently in public terms. Preserve issued balances and existing account policy.

Acceptance: targeted RED/GREEN tests for interruption/reload/status reconciliation and final-node deletion; affected financial regression suite on isolated local Postgres; TypeScript; build; scoped Biome; Ego Lite local browser QA where available. No production database, payment provider or billing catalog changes.

Plan: establish failing behavior tests; implement shared reconciliation and retry UI plus scoped server guard; run regression and application checks; self-review; commit and open a reviewable PR.
