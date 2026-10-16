# Paywall analytics — 2026-10-16

Status: LOCKED. Source: user requested instrumentation for the paywall and entry to Waffo checkout. Risk: STANDARD; financial fulfillment remains outside this change.

## 1. Goal
Measure the paywall exposure → checkout handoff → existing confirmed payment funnel in the existing Plausible site.

## 2. Constraints
Use the existing production-only tracker. Send no prompts, canvas content, identities, checkout URLs or payment IDs. Analytics failure must not interrupt checkout or pending-task continuation. Preserve concurrent resident-checkout work.

## 3. Scope
Add `Paywall Viewed` once per modal opening, without additional events for tab/plan changes. Complete `Checkout Handoff` for Waffo popup and fallback links on the modal and pricing page. Deduplicate repeat handoffs for the same URL within a mounted checkout component. Add only the finite `source` property (`paywall` / `pricing`) to identify the entry point. Keep existing payment confirmation semantics and purchase UI.

## 4. Acceptance
Opening/reopening the modal emits exposure; rerendering or changing plans does not. Failed checkout creation, closed/blocked popup and failed navigation emit no automatic handoff. A real fallback link click emits handoff once; a previously tracked popup does not count again. Production gates and analytics failure isolation hold. Verify targeted tests, types, build, changed-file lint, deployment SHA, collector receipts and dashboard Goals. Distinguish QA activity from customer conversion; no real payment for QA.

## 5. Technical context and plan
Use `core-goals.ts`, `plausible-browser.ts`, `pricing-modal.tsx`, `use-credit-checkout.ts`, `credit-plan-selector.tsx`, and `credit-pricing.tsx`. First add contract/checkout tests, then implement the two events and share checkout handling, update docs, self-review, validate, configure Goals, release and exercise the production path. No subagents used or authorized. Run affected Vitest tests, `pnpm typecheck`, `pnpm build`, and scoped Biome.
