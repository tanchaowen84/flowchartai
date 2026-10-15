# FlowchartAI API / MCP delivery

SPEC ID: flowchart-api-mcp-v1. Status: LOCKED scope from the explicit implementation handoff on 2026-10-15. Risk: HIGH (authorization, usage budgets, billing). Implementation, browser/production acceptance and Registry publication complete. Main-agent review only.

## 1. Goal

Ship developer key management, versioned REST, remote OAuth MCP, public integration pages and an official Registry entry with real acceptance receipts.

## 2. Constraints

Preserve existing login providers, historical balances, Creem ownership and current Waffo offers. Keys/tokens cannot create website sessions. No subagents. Browser: Ego Lite. Protect the resident dirty branch; isolated worktree from origin/main a7cd7d6. Product credentials and resources remain isolated. No pricing changes or Codex business scheduler.

## 3. Scope

- Owner dashboard: create (show once), scope, expiry, revoke/rotate, usage, rate and daily account/key budgets; OAuth connections and revoke.
- REST /api/v1: capabilities, account, tasks, diagrams list/read/create/save, native AI generation/edit, native file/JSON export. Native diagrams open in the existing /canvas/:id editor. Existing legacy files remain readable; native AI editing requires native format. PNG/SVG rendering remains in the website editor until a matching server renderer exists.
- Shared domain services for REST and MCP; no route-to-route impersonation. Opaque hashed keys and OAuth tokens; PKCE S256, exact redirects, resource binding, one-time code, rotating refresh tokens and family revocation.
- Synchronous bounded execution with durable task records and stable idempotency keys. At most one model task per owner, shared with website billing. Do not blindly retry an interrupted provider call. Persist validated result before settlement; recover delivery from persisted receipt without regenerating.
- Independent Header API/MCP links, /flowchart-api, /mcp, /developers, /developers/docs, OpenAPI, SEO/sitemap/llms, FlowchartAI domain Registry proof.

## 4. Acceptance

Real isolated Postgres tests for ownership, scopes, expiry/revocation/rotation, OAuth code/PKCE/resource/replay, refresh reuse, account/key budgets, rate limits, duplicate/concurrent submission, full-task usage, free repair and wallet preservation. Types/build/scoped Biome. Real provider generation -> edit -> saved website reopen -> native export; key script/custom-header MCP/OAuth SDK independently. Desktop/mobile landing/dashboard checks. Merge/deployment/public Registry receipts. Web ChatGPT/Claude acceptance stays distinct from SDK acceptance.

## 5. Technical context

Production verified via GitHub deployment 7069207024: Vercel, SHA a7cd7d6; flowchartai.org pricing confirms current Waffo Credits. Auth: Better Auth, email/password+email OTP+Google+GitHub. Native engine: src/lib/drawio; Agent: src/lib/mastra/drawio-agent.ts; usage collector and wallet: src/lib/billing. Saved native document is JSON in flowcharts.content. Billing V1 sums all provider receipts, caps settlement at reservation, and preserves legacy request entitlements. Existing shared wallet owns ledger mutations.

Commands: pnpm test, pnpm typecheck, pnpm build, pnpm exec biome check <changed files>. Local developer DB isolated on 127.0.0.1:55449/flowchart_developer_test; never use resident task test data.

## Plan / evidence log

1. Audit and isolate (complete). Main is ahead of resident checkout; no resident changes imported.
2. Key/OAuth schema and service contracts + RED tests.
3. Shared diagram execution, persisted receipts, budgets and REST/MCP adapters (complete). Full-context reservation is independent of caller cap; insufficient cap returns 409/required_credits before model execution.
4. Dashboard, consent, OpenAPI/Quickstart, landing content/assets/SEO (complete; browser acceptance recorded).
5. Local integration and real provider/browser acceptance (complete; see API_MCP_VERIFICATION.md).
6. PR, production migration/deployment, Registry publication and readback (complete; see API_MCP_VERIFICATION.md).

Independent reviewer/evaluator: not run; user has not authorized subagents. Main-agent self-review and automated/real tests are recorded separately.
