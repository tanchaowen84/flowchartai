# API/MCP verification receipts

2026-10-15, FlowchartAI only. Scope: `flowchart-api-mcp-v1`.

## Code and regression

- Base: origin/main `a7cd7d671c3888ec72770b09a944ed2d40ea0f3a`; isolated branch `codex/flowchart-api-mcp`. Resident checkout remains untouched.
- Final full suite at OAuth fix commit `84b3d51`: **62 files / 303 tests passed**, zero skips. Two task-owned local Postgres clusters supplied developer and historical wallet/Creem tests; both were stopped after the final run.
- `pnpm typecheck`, scoped Biome and `git diff --check`: pass. Vercel's production build/type checks also pass.
- `pnpm build`: pass. Local build reused the existing project's cached Google font CSS/WOFF resources because external font downloads were unreliable. No substitute application logic or placeholder font was introduced. Hosted previews compile with the normal Vercel environment.
- Public-domain OAuth regression uses actual NextRequest and next-intl. Next.js 15 normalizes loopback literals in query values; native Request URL access plus `skipMiddlewareUrlNormalize` and original-search preservation fix exact callbacks, opaque state and nested login returns. Tests failed before the fix. Hosted preview returns the exact loopback callback and valid consent.
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

## Final browser acceptance

Ego Lite recovered after the user restored availability. At application commit 7c7dafe:

- API/MCP pages passed actual 390/1440/1920 rendering and image inspection, with extra header checks at 1024/1280. No horizontal overflow, each primary CTA is in the viewport; word counts and FAQ/schema match the landing contract.
- Desktop and mobile API/MCP/Pricing navigation pass. Native Tab produces visible focus and Enter navigates. FAQ keyboard expansion passes.
- A fresh isolated website account showed the empty key/task state. Browser UI saved account budgets 700 Credits/70 AI tasks per day and created a 1-day key with only account:read, 80 Credits/day, 3 AI tasks/day and 20 requests/minute. Account read succeeds; diagram list correctly returns 403. Full secret is shown once, copied, dismissed and absent after reload.
- Browser rotation preserves the exact expiry; old key 401/new key 200; browser revocation makes the rotated key 401. Dashboard at 390px has no root overflow.
- Official SDK **1.32.1** completed real **390px browser consent** with PKCE, discovery, 11 tools and get_account. Refresh rotated both tokens; refreshed get_account succeeds; old access returns 401. Browser revocation then makes both access and refresh return 401. Consent has no horizontal overflow.
- UI screenshots are public product pages with no secrets: API desktop and MCP mobile links in the landing contract. Test secrets stay in ignored local receipts.

## Production release

- Feature PR [#24](https://github.com/tanchaowen84/flowchartai/pull/24) merged at `598cf9d`. OAuth correction PR [#25](https://github.com/tanchaowen84/flowchartai/pull/25) merged at `829b4f1`.
- Production migration `0010_developer_access` applied at 2026-10-15T05:06:46Z, journal head `1792032497752`; all eight developer tables exist. Historical financial rows were not changed by the migration.
- Initial production deployment `dpl_5DrL4FKZQihMUsnGRDLJpweCfvBa` is READY and mapped to flowchartai.org. Public pages, docs/OpenAPI, authorization/resource metadata and Registry proof pass; unauthenticated MCP returns 401 with the resource metadata challenge.
- Real REST creation task `0d15b013-81f6-4877-a563-6ee10382abdc` and official SDK API-key MCP edit task `49f4c09f-c1b9-47ea-9d7e-9d363a55086d` succeeded. Exact replay returns the same task. Each task has one provider call and one committed usage receipt. This existing production account has a legacy allowance: both tasks charge zero wallet Credits and consume that allowance normally.
- Native draw.io XML and JSON export return 200. Ego Lite opened the generated native file, saved the title "API MCP production acceptance", verified a new version through REST, reopened the five-node diagram and downloaded an actual 182×562 PNG. Low-cap and stale-version probes return 409 before generation.
- OAuth correction deployment `dpl_FjzABEP7b86fQ66KGaEp2HTdiWRe` is READY at source `829b4f1` and aliased to flowchartai.org. Public authorize returns 302 preserving `http://127.0.0.1:3051/callback` exactly. Real 390px Ego consent followed by SDK **1.32.1** code/PKCE exchange passes: 11 tools, get_account, refresh issuance. SDK refresh rotates tokens; new get_account succeeds, old access returns 401. A read-only grant cannot generate (`insufficient_scope`) and leaves the two-task usage count unchanged.
- Browser revoked both temporary production credentials: `FlowchartAI production acceptance` OAuth grant and `Production acceptance 2026-10-15` API key. Follow-up access, refresh and key authentication return 401; the key cannot create a website session. Daily account defaults remain unchanged.
- Official Registry publication succeeded (HTTP 200) at **2026-10-15T06:06:54Z**. Public [version record](https://registry.modelcontextprotocol.io/v0.1/servers/org.flowchartai%2Fflowchartai/versions/1.0.0) returns 200, namespace `org.flowchartai/flowchartai`, version `1.0.0`, status `active`, `isLatest: true`, remote `https://flowchartai.org/api/mcp`. This confirms Registry publication, not search-engine indexing or a specific web client's catalog refresh.
- Registry ownership uses FlowchartAI's public HTTPS proof and a dedicated Ed25519 key outside Git. No global publisher token store or another product's signing key was used.

## Client acceptance boundaries

- Official SDK acceptance is independent from hosted web clients. ChatGPT web was not signed in; the current Claude account was on hold. Neither web client completed a real connector connection in this session. No account changes or messages were made.
- REST/MCP provide native draw.io XML and JSON. PNG/SVG rendering uses the existing website editor.
