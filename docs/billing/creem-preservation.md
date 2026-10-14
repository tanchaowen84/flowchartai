# Creem legacy subscription preservation

Scope: correct the existing production webhook URL, verify signed provider deliveries, and reconcile the one expired subscription whose local record remained active. Do not migrate or cancel contracts, change prices/discounts/periods, or rewrite credit balances and historical ledger entries.

The existing Creem webhook now uses `https://flowchartai.org/api/webhooks/creem`. Its identity, signing secret, enabled status and event filter are retained. A real renewal event was resent from the merchant dashboard; the application received it, with original contract fields, balances and ledger unchanged. Resending a delivery creates a new Creem event ID, so readback uses the new receipt rather than the selected historical event ID.

Creem's current lifecycle also includes `subscription.scheduled_cancel`, `subscription.past_due` and `subscription.paused`. The old handler rejected them with HTTP 400; the production log contained a failed payment-retry delivery. The handler accepts them through the existing subscription update path. Scheduled cancellation keeps access through the original paid period; payment retries keep the existing paid-through access; expiration ends access without changing historical contract dates or balances. Pause/recovery follow the provider's current state.

Retain historical payment metadata and store the provider's `updated_at` as `creem_updated_at`. Ignore older subscription snapshots so delayed retries cannot overwrite a later renewal. Existing billing-event receipts still make identical signed deliveries idempotent.

The mismatched record was an expired subscription with one canceled annual invoice and zero amount paid, rather than a paid annual subscription. Reconciliation changes only that local subscription's state and audit metadata after a fresh provider read. No provider subscription or payment is mutated. Customer identifiers, backups and detailed receipts stay in ignored `.env.creem-*` files.

Verification: eight signed-webhook tests with isolated local Postgres cover payment retries, cancellation at period end, initial insertion, delayed and concurrent out-of-order delivery, expiration, pause/recovery, duplicate delivery and signature rejection. All 259 checks passed (232 unit checks and 27 real database checks). TypeScript and scoped lint passed; the repository excludes its existing payment type/operations files from Biome. Recheck deployed delivery receipts and preserved financial fields after release. No schema migration, additional production service or cron is required.
