# Plausible funnel release — 2026-10-14

Scope is authorized by the user: evaluate and complete Plausible instrumentation, use simple English events matching SpriteFuse, verify and deploy.

## Acceptance contract

1. Keep exactly six operating Goals with corresponding SpriteFuse semantics.
2. Cover new registration, accepted AI generation/edit, successfully applied canvas output, both editors' export entry points, successful checkout URL handoff and confirmed initial paid checkout.
3. Exclude invalid/unauthorized/rejected generation, chat-only answers, render failures, empty-canvas exports, failed checkout, test/trial/free/renewal payments and duplicate payment notifications.
4. Preserve other uncommitted work. No new public features, schema migrations or environment secrets.
5. Analytics failures cannot interrupt auth, generation, downloads, checkout, webhook transactions or credits.
6. Verify tests, types, build, scoped lint, production deployment and dashboard setup. Separate QA observations from real user/payment activity.

## Initial audit

- Production source: `origin/main` at `a35223328b35816d00407d7eee522791f60d3138`.
- Deployment: Vercel `dpl_Atd36mxuXBdjzPanNzCwy1Bmr5hm`, READY, production.
- Production collector: `https://myplausible.app`; domain: `flowchartai.org`.
- Existing code loaded only the Plausible pageview script. Dashboard showed no configured Goals.
- Work isolated at `/Users/tcw/.codex/worktrees/flowchart-plausible-20261014/flowchartai`; resident `codex/agent-internal-architecture` edits are retained.

## Implementation and local evidence

- Six names and three finite properties in `src/analytics/core-goals.ts`.
- New-user hook counts account creation across Better Auth providers. Accepted-generation events run after response; export-ready follows actual canvas application.
- Downloads cover native drawio/SVG/PNG and existing Excalidraw toolbar/modal formats.
- Checkout redirect uses a beacon. Payment telemetry verifies signed live positive paid checkout evidence after business commit and atomically deduplicates by hashed order key.
- Ten initial analytics tests passed; the repository suite passed 211 tests across 47 files before the final beacon test was added.
- `pnpm typecheck`: PASS after generating content collections and restoring the ignored `next-env.d.ts` build artifact.
- `pnpm exec biome check` on all changed TypeScript files: PASS.
- Final analytics suite: 11 tests PASS, including checkout beacon delivery.
- Local `pnpm build` was blocked by TLS/network errors to fonts.googleapis.com; no product/font changes were made. Full production bundling will be verified by Vercel Preview before merge.

## Release evidence

PR #18: https://github.com/tanchaowen84/flowchartai/pull/18. Initial Preview `dpl_6vq5R3Dx2u3VeE8UYMnktDfBDvTE` failed in the pre-existing Google Fonts downloader (font URL extension parsing). The same production font bytes and all 55 font-face declarations were pinned in-repo; font provenance/license files included, all 26 SHA-256 hashes verified.

Pending updated Preview, final local bundle and production/browser/collector/dashboard readback.
