# API/MCP verification receipts

2026-10-15, FlowchartAI only. Scope: `flowchart-api-mcp-v1`.

## Code and regression

- Base: origin/main `a7cd7d671c3888ec72770b09a944ed2d40ea0f3a`; isolated branch `codex/flowchart-api-mcp`. Resident checkout remains untouched.
- Full suite: **60 files / 294 tests passed**, no skipped tests, with two independent local Postgres clusters. Developer tests used port 55449; historical wallet/Creem tests used a newly initialized, separate cluster on 55438 and stopped it after completion.
- Follow-up edit-scope regression: **15/15 service tests** pass after reproducing the missing-read-permission case. The full runnable suite after this fix passes **265 tests** with 30 historical billing cases intentionally skipped because their separate cluster was already stopped; those 30 passed in the earlier full 294-test run.
- `pnpm typecheck`, scoped Biome and `git diff --check`: pass.
- `pnpm build`: pass. Local build reused the existing project's cached Google font CSS/WOFF resources because external font downloads were unreliable. No substitute application logic or placeholder font was introduced.
- Editing an existing diagram explicitly requires diagrams:read as well as generate/write, before its contents can be sent to the model.
- Self-review only; no independent reviewer/subagent was authorized.
- Migration 0010 creates eight developer tables and their indexes/FKs. No historical balance, payment, subscription or ledger updates. New timestamps use `timestamptz`; schema and snapshot are aligned.

## Actual application/provider checks

All fixtures below belong to an isolated local database; provider calls use FlowchartAI's own configured model service. No other product's account or billing resources are used.

| Surface | Evidence | Result |
| --- | --- | --- |
| REST prompt generation | `a88bb216-71c9-4e85-880b-4237cd9a5f45` | saved native output; 5 Credits |
| REST native edit | `6c13e141-daf1-41a9-a1ca-9b083b511fab` | saved revision; 6 Credits |
| MCP six-node onboarding | `01aa63ad-2a0f-4db4-9208-d27f190e95de` | saved native file; 4 Credits |
| MCP final same-file edit | `a3102734-cf0b-4d98-bcb4-ac663fa52758` | welcome email added after activation; 5 Credits |
| Website save/reopen | Ego Lite, original and revised native file | Save response 200, revision 3, activation/welcome preserved after reopen; actual PNG downloads inspected |
| REST image + skill read | `bc56edea-a423-44f1-aa78-2795807a9754` | **two model calls**, both have provider usage receipts; budget 58, settled once at 4 Credits; exact replay returns the same task |
| Low per-task cap | real production bundle + cap 1 | 409 `max_credits_too_low`, `required_credits:41`; balance 1180 before/after; no generation |
| Key lifecycle via website management HTTP | 1-day key; account:read; 80 Credits/day, 3 AI tasks/day, 20 requests/minute | create 200 on account; rotate old 401/new 200; expiry preserved; revoke 401; management read excludes full secret/hash |
| Website login isolation | API key on Better Auth get-session | null session |
| Custom-header MCP | official SDK **1.32.1** | 11 tools; account, native read and draw.io export pass |
| Browser OAuth | earlier official SDK + Ego consent | code/PKCE, discovery and consent completed; 11 tools/account pass |
| Final OAuth protocol | official SDK **1.32.1**, isolated cookie management approval over HTTP | REDIRECT -> AUTHORIZED; 11 tools/account pass; refresh rotates; superseded access 401; refreshed access authenticated (GET intentionally 405); revocation blocks access and refresh (401) |

The provider credentials inherited from the desktop shell initially differed from the project's env. Failed requests were not charged. Final servers explicitly load the project's own env. This was a local environment issue; production credentials were not changed.

Two earlier local edit probes were visually rejected (overlap and poor routing), then refunded through additive local QA grants. They are not billed-success examples. The final public images use the accepted six-node creation and seven-node edit above. The external Agent now rejects near-complete overlap of newly added process nodes inside its existing tool, allowing a platform-funded correction. Website defaults are unchanged.

Public product-owned assets (HTTP 200 verified):

- https://cdn.flowchartai.org/developer/2026-10-15/api-onboarding-01aa63ad.webp (410×676)
- https://cdn.flowchartai.org/developer/2026-10-15/mcp-onboarding-a3102734.webp (410×824)

## Remaining release gates

- Final browser acceptance of the same built version at 390/1440/1920 px, header/Pricing navigation, keyboard focus, FAQ/images, and key create/reveal/dismiss/rotate/revoke UI.
- Ego Lite initially worked for actual canvas/editor/export and consent. Later its Node runtime bootstrap and reconnect timed out even for a minimal console script; native Ego observation also timed out. No Playwright or external DevTools fallback was used. HTTP receipts above do not substitute for responsive UI acceptance.
- Production migration/deployment, production endpoint acceptance and Registry publish/readback remain pending. `mcp-publisher validate` passes but is not a publication receipt. Namespace: `org.flowchartai/flowchartai`, version 1.0.0; FlowchartAI-only Ed25519 key and public domain proof prepared. Private key remains outside Git.
- ChatGPT/Claude web clients have not completed real login/connection acceptance. Official SDK success is recorded separately.
