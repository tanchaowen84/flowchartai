# Paywall release verification

Verified 2026-10-16. Changes were implemented in an isolated worktree and self-reviewed; no independent reviewer was used.

## Automated checks

- 312 unique tests passed: the main run passed 283 and skipped the 29 developer financial integration tests, then a separate isolated run passed those 29.
- TypeScript and the production Next.js build passed. Changed application files pass Biome; the pre-existing mixed-format database schema was left intact except for the added column.
- Integration tests cover original registration grants, capped first delivery, failures, text-only clarification, saved-document ownership, duplicate receipts, trial remainder, checkout ownership, and confirmation only after the matching grant exists.
- Existing API/MCP financial tests passed. First-diagram protection is explicitly enabled only for the native website editor.

## Real application acceptance

- A new local user generated an editable, saved four-step diagram using the real model. The agent needed a platform repair; the task charged zero credits and retained the trial balance.
- A blocked modification opened the purchase modal once. Closing it and retrying kept an inline purchase entry without a second automatic modal.
- Monthly, yearly and one-time choices update the selected plan and CTA. Yearly choices show $7/$15 per month and Billed $84/$180 yearly, with $24/$48 savings against monthly payment.
- After sandbox fulfillment, the exact paused modification continued automatically on the original canvas, added the requested branch and charged 5 credits. No Continue request click was needed.
- Desktop and 390 × 844 mobile checks passed. The purchase button remains visible in the mobile modal, Escape closes it, and focus returns to the purchase entry.

## Payment evidence and limits

The real hosted Waffo sandbox cashier displayed Payment Successful. No real money was charged. A temporary tunnel could not deliver the public sandbox callback. The successful event was retrieved from Waffo's authenticated canonical delivery log and reconciled through the existing application event processor against the isolated local database. Repeating that event did not grant credits twice. This verifies the sandbox cashier, canonical event reconciliation and automatic continuation; it does not claim a successful new public-webhook transport test. The raw production webhook receiver is unchanged, and its existing signature/regression tests passed.

The test and production catalogs were read back after publishing the versioned $84/$180 annual offers. Existing $90/$190 offers were preserved for sold contracts. The production database migration adds only the first_diagram metadata column; no balance or subscription data was rewritten. See the adjacent JSON receipts for exact evidence.

## First-diagram limits

This safeguard confirms a valid editable native result saved to the user's account before settlement. Failures and platform repairs are free; first-result charges are capped at 20 credits. It cannot guarantee that every description produces a subjectively satisfactory diagram. Existing model limits remain, with at most two tool repairs, five protected attempts per 24 hours and a 120-credit soft compute limit checked between calls.
