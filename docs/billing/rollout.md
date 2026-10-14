# Billing V1 release notes and safe cutover

Status: local implementation; production remains unchanged. Independent review has not been authorized; checks are self-review plus automated/local database tests.

## Old customers

- Keep Creem keys, webhook URLs and original products. Retire them only from new-sale UI; never delete a plan, rename an old payment ID or cancel a subscription during migration.
- Keep original charge amounts, discounts, billing periods, fixed request quotas (Hobby 100/month; Professional retains its existing allowance (9999 is the previous internal limit, not a new user-facing restriction)), cancellation grace period, and original refund promises. Manual memberships are included.
- Frozen `payment.legacy_plan` preserves recognition after an environment product ID changes. `scripts/audit-legacy-billing.ts` is read-only unless both `--apply --confirm-target` are supplied. Review all unknown product IDs first, providing a product-to-plan JSON mapping. An unresolved valid old plan receives Professional access temporarily instead of being downgraded.
- Original `user.credits` is imported as a permanent `legacy` bucket on first wallet use, under the same user lock. No old ledger row is edited or recreated. Subsequent Creem credit purchases use unique permanent sources. Configure any historical one-time product amounts with server-only `LEGACY_CREEM_CREDIT_PRODUCTS` (JSON product-ID to credits); client metadata cannot set credits. There is no automatic subscription-to-credit conversion.
- Old subscribers use their original successful AI request count, including text analysis, generation and edits, with no Token credit debit while the allowance remains. Entry checks and reservation use the same counter. Each successful user task counts once, including after receipt retries. After their included quota is used, they can spend their existing credit balance. They may buy permanent credit packs, but a second Waffo subscription is refused while the old contract is valid. Let the customer end the old renewal and choose a new plan after expiry.

## Settings (server and browser must be enabled together)

`BILLING_V1_ENABLED=true`, `NEXT_PUBLIC_BILLING_V1_ENABLED=true` enable the new version. Both were set for the staged production deployment on 2026-10-14; the prior immutable deployment remains unchanged until domain promotion. `BILLING_V1_START_AT=2026-10-14T10:11:41.669Z` is the configured registration cutoff, so a registration-grant retry cannot award every historical account a new trial. Record the actual domain promotion time separately.

`WAFFO_ENVIRONMENT=test|prod`, `WAFFO_MERCHANT_ID`, `WAFFO_PRIVATE_KEY`, `WAFFO_STORE_ID`. Server-only product mappings: `WAFFO_TEST_PRODUCT_STARTER_MONTH`, `STARTER_YEAR`, `PRO_MONTH`, `PRO_YEAR`, `PACK_SMALL`, `PACK_LARGE` with the same prefix. Production uses `WAFFO_PROD_PRODUCT_*`. The webhook checks SDK signature, environment, store, internal checkout, identity, local offer, price snapshot, and period. Configure product prices from the approved local catalog, trial off, and a subscription product group. Portal plan changes must use next-period timing, or disable portal plan-change controls and use the app's explicit next-period checkout links.

Subscribe webhook to: `order.completed`, `subscription.activated`, `subscription.payment_succeeded`, `subscription.renewed`, `subscription.recovered`, `subscription.canceling`, `subscription.uncanceled`, `subscription.canceled`, `subscription.past_due`, `subscription.plan_changed`, `subscription.plan_change_scheduled`, `subscription.plan_change_failed`, `refund.succeeded`, `refund.failed`.

Payment receipts do not own billing periods. Signed activation/renewed/recovered/plan_changed events own them. Scheduled/failed plan-change events leave the current membership intact. Yearly cancellation continues monthly grants through the paid year.

## Task settlement

All successful model HTTP calls are collected, including Skill steps; reasoning is already part of output. A complete server-validated result is stored as `ready`, with fixed server-owned usage and charge. The client applies the diagram (or presents the completed text), then acknowledges that exact result hash. This receipt settles the reserved credits; it cannot change rates, tokens or amount. Application failure/cancellation releases the reservation. Pending receipt acknowledgement retries after reconnect without another debit; a ready result can be restored without another model call. Unacknowledged abandoned reservations expire after 20 minutes. Client `usage/record` no longer controls billing or quota in V1. A failed server/format/tool repair is platform-funded, with provider receipts retained. Over-cap compute is absorbed, never debited above the reservation. Estimated credit budgets do not hard-stop the Agent between steps: its existing step/time limits govern execution, so complex results can complete. No added server/cron is needed; balance reads/task initiation expire buckets, recover abandoned reservations and grant only the current subscription month.

Pending checkout links are reused for their session lifetime. Buying in a new window keeps the diagram and input; returning refreshes the trusted balance and does not submit a generation automatically. Same-model provider price caps and verified cached-price endpoint lists keep cost within the versioned credit policy, without switching to a cheaper model. The endpoint snapshot is dated; review it when changing rates/providers.

## Refund operations

New Waffo first purchases: request within 7 days, all purchase-source credits unused, no in-flight reservation; keep legacy 14-day promises. Refund original payment through Waffo; separately cancel renewal when requested. Revoke only that payment's correlated credit source after a signed successful refund, and retain old ledger entries/results. Partial refunds require manual source-specific reconciliation; do not revoke the full wallet. The initial UI directs refund requests to support rather than promising an unimplemented automatic refund button.

## Release procedure

1. Backup and compare old paid contracts, prices, periods, balances and ledger counts; review unknown IDs with the read-only audit. No bulk contract migration.
2. Apply additive Drizzle migrations with both flags OFF; freeze reviewed legacy IDs; verify no history/balance changes. RLS blocks browser Data API access to the new financial tables.
3. Configure the FlowchartAI sandbox store/products and finish real hosted subscription+pack settlement. Re-deliver callbacks and check single grants; verify old Creem portal and signed renewal.
4. The owner approved the final merchant submission and fee schedule. Read back actual Approved, then verify the approved pricing/refund copy and production catalog before enabling new checkout. This approval and catalog verification completed on 2026-10-14.
5. Enable both flags in one Vercel deployment; inspect old member+new member balance and core diagram workflow. Keep Creem renewal and management enabled.
6. Rollback by keeping the additive tables and historical records, closing new checkout and reverting the UI/Agent flags together. Do not erase paid Waffo contracts: continue provider fulfillment and resolve their access before any rollback; a blanket billing-off rollback is unsafe after new subscribers exist.

## Sandbox evidence recorded before production preparation

Read-only legacy audit found 20 effective entitlement records (15 Hobby, 5 Professional), including manual memberships; this is not a count of paying customers. No unresolved product IDs. No production balance, ledger or contract was written. See `legacy-entitlement-audit.json`.

A dedicated Waffo test store, six sandbox products and test webhook were created with owner authorization. Hosted Pro monthly and permanent 1500-credit pack payments both succeeded; signed callbacks produced 6200 then 7700 credits in the isolated local database. No production catalog was published and no real card charge occurred. The owner subsequently approved the exact final merchant package and fee schedule; application `TKT_1HztXEGuGjxLvmaOODdC0W` was submitted and read back after reload as Under Review (`pending`). See `waffo-review.md` for the submission record and `verification.md` for the exact distinction between real sandbox and fixture checks.

Sold offer keys must retain their original price and credit allowance. Future pricing changes use new offer keys while preserving old mappings, including paid yearly contracts. Administrative credit gifts use unique `grantBucket` sources rather than editing the materialized balance directly.

Sandbox yearly renewal/plan-change/refund cycles have fixture coverage; they were not executed as hosted payments this turn. Verify those provider lifecycle payloads before formally offering the corresponding operations.

## Production preparation · 2026-10-14

Merchant application `TKT_1HztXEGuGjxLvmaOODdC0W` was read back as `approved`, reviewed at `2026-10-14T09:28:13.811Z`. Store `STO_5I2J4YK9UUolwABxwPIhYa` is active with `prodEnabled=true`. Six live products match the approved prices and allowances. The live webhook targets `https://flowchartai.org/api/webhooks/waffo` with the 14 events above. Portal plan-change controls are disabled; the application requests next-period changes explicitly.

Only additive migrations 0007–0009 were applied; older schema migrations were not rerun against the already existing tables. New financial tables have RLS and no browser-role grants. A private backup and post-migration comparison confirm no changes to 55,663 original balances, 113 original contracts or 2 original ledger rows. Twenty reviewed effective legacy records were frozen; unknown IDs: zero. See `production-baseline-receipt.json`, `production-migration-receipt.json` and `production-preservation-receipt.json`.

Production configuration preserves the original authentication, database, AI provider and Creem secrets. Deployment `dpl_F8EwWaBDFT7MBV52hEtPQR4j7C1J` (source `249ca357575698740d28b7b3fd235f0153adee2f`) was promoted to `flowchartai.org` after staging checks. Domain and user paths were verified on 2026-10-14. No real card payment was made during release QA.

The existing owner account retained its Professional entitlement and 1,000 historical credits. A real generation and follow-up edit both committed once at zero credits, while its original monthly request count changed from 10 to 12. The editable result has two swimlanes, 18 vertices and 19 edges with no missing endpoints; download and reload succeeded. The original Creem portal opened, duplicate subscription checkout was rejected with 409, and the live Waffo $10 / 1,500-credit cashier opened with the refund policy visible. See `production-release-receipt.json`.
