# Paywall recovery verification

Base: production main `7acc7e6b957cb45b955217ca2b6c28e0dccf3ec1`. Isolated branch `codex/paywall-recovery-fix`; resident checkout left untouched. Self-review only; no independent agent was authorized.

## Regression evidence

- RED: missing/released task recovery returned restore instead of retry; the real chat HTTP stream rejected a valid remove-last-node patch before readyTask. Three target behavior assertions failed; empty first-diagram rejection and visible first delivery already passed.
- GREEN: 68 test files, 344 tests passed with both BILLING_TEST_DATABASE_URL and DEVELOPER_TEST_DATABASE_URL pointing to a fresh local PostgreSQL database at 127.0.0.1:55469/flowchart_paywall_test. Nothing skipped. This includes registration/first delivery, reserve/refund, settled empty edits, duplicate receipt/replay, checkout ownership/fulfilled grant checks, and API/MCP financial/authorization regressions. Models and payment providers are fixtures in this suite.
- Release review caught an additional boundary: ordinary empty create/replace generations must still fail. Two HTTP tests and two real-Postgres tests first failed, then passed with the tightened guard. Empty generations release all reserved credits and record no successful usage or debit; the intentional remove-last-node patch still delivers and settles once.
- Recovery tests cover 404, released, running, ready, committed, transport failure, unauthorized/forbidden/server errors, unreadable/unknown/mismatched responses, original attachments, ID reuse/rotation, and owner/canvas/expiry guards.
- Changed TypeScript files pass scoped Biome; git diff --check passes.
- Generated terms contain 20-credit trial and no 200-credit trial promise. Existing issued grants and wallet policy are unchanged.

## Application checks

- Final pnpm typecheck and pnpm build passed. The production bundle regenerated all 25 content documents.
- Ego Lite local production runtime: the application itself paused a zero-balance modification, retaining its original native XML, selection, prompt and task ID. A local paid-checkout fixture was fulfilled with its matching credit grant; no external cashier/provider was called.
- The page issued exactly one automatic continuation. A one-shot browser fetch interruption rejected that POST before server task creation. The real task lookup returned 404; the retained IndexedDB record kept the exact request body, released resumeStartedAt, consumed checkoutId and exposed Retry request.
- Reload preserved Retry request without repeating the automatic continuation.
- A local launch inherited an unrelated test OpenRouter key and its first model attempt returned 401. The task released without a debit; the UI rotated only its task ID and preserved the body. The final runtime explicitly loaded the existing local application environment.
- Explicit retry then completed with the real model: the last node was removed, the empty canvas saved, the task committed for 3 credits, and the local debit ledger contained exactly one entry totaling 3. The retained IndexedDB operation and retry entry were cleared after the successful receipt.
- The final rendered terms consistently promise 20 credits.

Receipts: [browser-receipt.json](browser-receipt.json). Screenshots: [failed continuation with retry](failed-continuation-retry.png), [successful retry with empty canvas](retried-empty-diagram.png).

## Environment

Pinned draw.io v32.0.2 assets were reused from the existing local installation. An initial content build failed while fetching unchanged historical blog images; copying the existing content-collections cache allowed all 25 documents to regenerate, including the changed terms. A typecheck started before generation lacked content-collections declarations; the final check runs after generation. No product configuration was changed to suppress those checks.

No production database/provider/catalog changes, real-card charges, or new webhook-transport claims.
