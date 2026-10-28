# Shared experiments

Production setup completed on 2026-10-28: deployment `dpl_2HyhGZMgxspa8FA41itAPt8vowyS`, source `cdb17ec`, migration 0013, scoped server key and connected capability manifest. The production adapter flag is enabled; no experiments exist or were started. Canonical-domain authenticated quote-null/default-price checks passed without creating a checkout. Full release and rollback evidence is in the companion private Site Insights repository's `docs/UNIFIED-EXPERIMENTS-RELEASE.md`. The source default remains off for new sites.

Default off: `SITE_INSIGHTS_EXPERIMENTS_ENABLED` must be explicitly set to `true` to enable server page decisions and credit-pack quote requests. Installing, registering or deploying code does not start an experiment. Do not start a production experiment in this release.

## Setup

1. Install pinned `vendor/site-insights-sdk-0.2.0.tgz`. Its source is the private Site Insights repository `sdk/`; do not edit a separate copied browser implementation.
2. Apply additive `src/db/migrations/0013_experiment_quotes.sql` through the normal deployment migration process. Existing orders keep NULL quote snapshots and the original billing policy.
3. Server configuration: `SITE_INSIGHTS_ENDPOINT` (including `/insights`), `SITE_INSIGHTS_SITE_ID=flowchart`, scoped `SITE_INSIGHTS_WRITE_KEY`, `SITE_INSIGHTS_ENVIRONMENT=production` for the production Waffo environment. Test/staging environments must use their own site credential and test provider.
4. Browser: existing `NEXT_PUBLIC_SITE_INSIGHTS_ENABLED=true`, optional `NEXT_PUBLIC_SITE_INSIGHTS_SITE_ID` and `NEXT_PUBLIC_SITE_INSIGHTS_ENDPOINT`. `NEXT_PUBLIC_SITE_INSIGHTS_LOCAL=true` is only for isolated localhost verification. Never include write credentials in public variables.
5. Run `pnpm exec tsx scripts/register-insights-experiments.ts` with the intended environment. It registers capabilities only. Create a draft in Insights; leave it unstarted until separately authorized.

## Supported targets

- `homepage-headline`: existing plain text.
- `homepage-layout`: English homepage, reorder existing registered modules. All original modules are required in this first adapter; no content injection or new component code.
- `credit-pack-price`: authenticated first-time buyers, one-time `pack_small`, USD. Existing Waffo product mapping stays in place; server priceSnapshot controls amount and immutable checkout quote controls credit quantity. Subscriptions, legacy contracts and the large pack retain existing behavior.

Quotes expire after 10 minutes before checkout initiation. The resulting provider order has its own expiry and immutable snapshot. Refresh expired pricing explicitly. Pause/stop prevents new quotes; previously issued unexpired quotes remain honored while the feature is enabled. Turn the site feature off to block experimental checkout initiation, while all already-created orders continue to fulfill from their stored snapshot.

QA mode from `?insights_qa=1` persists in the site's QA cookie so SSR and later pricing requests share the classification. Trusted `SITE_INSIGHTS_QA_USER_IDS` always remain QA. `?insights_qa=0` clears ordinary browser QA mode, without reclassifying an already-QA assignment. Staging exposure uses the server-issued assignment's environment and its own registered origin; no browser environment override is accepted. The legacy general browser analytics feed remains production-only.

The browser submits only `quote_id`; authentication fixes the owner. The server resolves the quote, checks eligibility under the existing wallet lock and stores the snapshot. Provider retry uses the same checkout and idempotency key. Confirmed signed payments grant snapshot credits once; price changes never alter existing orders. Real revenue/refunds continue through the existing trusted payment feed.

## Reuse boundary

The package does not import Next.js, Drizzle, Supabase, D1 or Waffo. Each site supplies a component registry, cookie/SSR adapter, authenticated quote route, eligibility check, immutable order storage and provider fulfillment adapter. React bindings are optional. Existing modules and one-time offers become configurable; new interaction components or billing models require one adapter update.
