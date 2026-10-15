# Paywall and first-diagram delivery · LOCKED

Source: owner approval on 2026-10-16. Risk: HIGH (credits, payment, automatic execution).

## Goal
Ship the approved two-card purchase modal and first usable diagram safeguard. Paid requests continue automatically after confirmed fulfillment.

## Constraints
Preserve all historical grants and contracts, including $90/$190 yearly offers. New annual offers charge $84/$180 ($7/$15 per month equivalent); annual allowances remain monthly. No real-card QA charge. Work in an isolated checkout; no delegation authorized.

## Scope
New registrations receive 20 credits once, valid 30 days. First-diagram admission is funded separately from normal reservation; user charge capped at 20, failures and platform repair free. One concurrent task, bounded compute and repairs. A real applied, validated and saved native result precedes first settlement. Text-only clarification does not consume the first-diagram right. Modal uses Monthly/Yearly/One-time tabs, two selectable cards, one CTA, adjacent annual billed total. Automatic modal at most once per browser session; subsequent blocks inline. Keep inputs/attachments/canvas. Fulfilled checkout resumes the exact pending request once, with a 1.5s toast; canceled or changed canvas never auto-runs. Free editing/save/export remain available.

## Acceptance
Test new versus historical grants; first task with 0/20 credits; failure/refund, text-only and save failure; over-20 charge subsidy; receipt/concurrency idempotency. Validate old/new provider offers and annual price snapshots, checkout ownership, confirmation-before-resume, repeated callbacks/refresh and stale canvas protection. Desktop/mobile modal, all tabs, keyboard/close, real hosted cashier, sandbox fulfillment, local typecheck/build/tests. Publish only after applicable checks pass; verify READY production SHA and live UI.

## Technical context and plan
Next.js 15, React, Mastra, Postgres/Drizzle, Waffo, Vercel. Extend existing billing task rather than create a new wallet. Additive migration only. Implement policy/presentation and test; wallet/delivery safeguard and transaction tests; contextual modal and checkout/pending-operation controller; real QA; versioned provider catalog/config; deploy and smoke. Run pnpm test, pnpm typecheck, pnpm build, changed-file Biome. Review is self-review; no independent agent authorized.

## Validated trial remainder
After a protected diagram that was platform-repaired and charged zero, any remaining registration credits can fund a native website request even when the conservative reservation estimate exceeds that remainder. Final charge is capped at the remainder; existing compute bounds still apply. Paid wallets and developer API reservation rules are unchanged.
