# Developer boundary

Owns external API credentials, OAuth grants, daily developer budgets, durable operation receipts and adapters. Website login, payment ownership, offers and the Credits ledger remain with their existing modules.

| File | Input -> output / responsibility |
| --- | --- |
| scopes.ts | Browser-safe permission names; no server imports |
| contract.ts | Strict requests, principals, errors, hash/secret helpers and canonical resource |
| access.ts | Hashed key / resource token -> active scoped principal; rotation, expiry and rate limits |
| oauth.ts | DCR, consent, one-time PKCE code, rotating resource tokens and revocation |
| management.ts | Website cookie owner -> key policies, connection controls and usage; strict same-origin writes |
| service.ts | Principal + stable idempotency key -> task; atomic native save + existing wallet settlement |
| runner.ts | Website native Agent -> validated document and all provider-call receipts; no raw provider logs |
| diagrams.ts | Owned saved file -> summaries, content versions, snapshots and native exports |
| rest.ts / mcp.ts | Transport adapters calling the same services; no website-session impersonation |
| http.ts / openapi.ts | Bounded private responses and the real versioned REST contract |

Data: `src/db/developer-schema.ts`, additive migration 0010. Limits reset at 00:00 UTC. A key and OAuth grant are revocation fences. Keys are never passed to Better Auth. API OAuth access tokens work only at `/api/mcp` and are never accepted as REST keys or website cookies. Server secrets never reach client bundles; UI imports only scopes.ts.

Native generation is synchronous and bounded at 240 seconds inside a 300-second Vercel function. Durable receipts recover prepared delivery without a second model call; interrupted executions become terminal on read after six minutes. There is no standalone SSE notification stream (authenticated GET/DELETE return 405). No Queue, worker scheduler, cross-product credentials or Codex automation is used.

Safety suites: access, OAuth and service integration tests use only `127.0.0.1:55449/flowchart_developer_test`. Runtime evidence and remaining acceptance items live in `docs/build-state/API_MCP.md` and `API_MCP_LANDING.md`. `DEVELOPER_API_ENABLED=false` closes external authentication without changing website login or payments.
