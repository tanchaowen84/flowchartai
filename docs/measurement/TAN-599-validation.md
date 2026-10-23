# TAN-599 validation sample

Validated on 2026-10-23 against implementation `cadf1a73`, using Ego Lite,
`http://127.0.0.1:3199`, and a dedicated PostgreSQL 17 database on port 55499.
No production database, real customer account, paid generation, or payment was
used. The browser and server measurement flags were enabled locally; the
existing public/server billing flags were also enabled for checkout UI testing.

## Browser actions and business readback

| Action | Observed result |
| --- | --- |
| Anonymous landing with `utm_source=tan599_qa&utm_medium=controlled` | The observer captured a signed first touch before account creation. After authenticated return, the same account had `kind=campaign`, source `tan599_qa`, medium `controlled`, entry `/`. |
| Browser signup and authenticated return | The real signup API persisted an account, then returned 500 because the isolated environment had no mail sender. Only that local QA account was marked verified in the database; the real sign-in API returned 200. The observer bound acquisition on reload. This does **not** validate email delivery, the signup UI, or OAuth. |
| Missing first-touch context | A second account was created without another landing capture. Authenticated bind returned 204 and persisted `unknown`, entry `/unknown`, empty capture key. It was not recategorized as direct. |
| Empty-referrer landing before a third signup | Actual browser context had no UTM and `document.referrer === ''`. Capture preceded account creation; authenticated return persisted `direct_observed`, entry `/`. Referrer stripping remains indistinguishable from actual direct navigation. |
| Owned result creation and acknowledgement | Browser POST to `/api/flowcharts` returned 201 with a nonempty two-node native document. A local ready-task fixture supplied the delivery receipt; browser POST to `/api/billing/task` returned 200, state `committed`, charged 0. The server wrote `result_delivered` with the same task/file/owner. AI generation itself was substituted by the fixture. |
| Native editor Download → editable diagram | A real browser download completed with no failure. The saved 786-byte XML contained the two expected visible nodes. The database recorded `export_initiated`, format `drawio`, for that same file and owner. General product semantics remain export initiation, not proof of every user's disk write. |
| Native editor node-label edit → Save | The changed label was visible, the UI showed Saved, and the database held revision 2 with the changed content plus a later `save_succeeded` event for the same file. |
| Buy credits → paywall | The actual modal displayed Starter/Pro and the monthly CTA. The same account received a `paywall_viewed` observation with source `paywall`. |
| Monthly CTA → owned checkout fixture | The real checkout endpoint returned the pre-existing pending **test-mode** checkout, and the browser popup navigated to its example-domain URL. The hook wrote `checkout_handoff` with that owned checkout ID and source `paywall`. Provider acceptance, cashier rendering, and payment were not tested. |

The main sample's persisted UTC order was:

| Milestone | UTC time on 2026-10-23 |
| --- | --- |
| First-touch capture | 02:35:04.366 |
| Account created | 02:35:16.032 |
| Acquisition bound | 02:35:38.958 |
| Result delivered | 02:36:34.947 |
| Export initiated | 02:37:32.386 |
| Paywall viewed | 02:41:41.422 |
| Checkout handoff | 02:43:40.327 |
| Changed content saved | 02:44:45.516 |

Rebinding the first account left its original campaign observation unchanged.
All three accounts are explicitly QA. Test-mode checkout ownership independently
excludes the main account from natural traffic. The checkout remained pending,
with no order ID or payment receipt; no Payment Confirmed claim is made.

Two unsuccessful setup attempts were retained as failures: a generation request
failed the locally unconfigured moderation guard, and the first checkout attempt
failed local dummy-client validation. Neither produced a delivery/handoff
observation. After correcting the local dummy merchant format, the existing
checkout was reused without entering the provider-creation path. No production
credentials were loaded.

## Report interpretation

The real QA report uses the Shanghai-day registration boundaries
`[2026-10-22T16:00:00Z, 2026-10-23T16:00:00Z)` and an explicit current as-of.
It reports three QA accounts: one campaign, one direct-observed, and one unknown.
All three registration windows are immature. There is no natural-account row
and no mature conversion denominator; a rate is unavailable, not 0% or 100%.
Task/result/funnel submetrics use mature registration cohorts first, so their
zero values in this snapshot do not erase the raw observations above.

A separate transaction-scoped SQL fixture, rolled back after execution, verifies
the mature arithmetic: one used result out of one mature delivered result, one
same-account paywall handoff out of one mature exposure, zero associated provider
payment receipts. A second explicitly natural fixture account is immature;
explicit QA and unclassified accounts remain separate. Those are controlled
query examples, not customer conversion estimates. Integration tests additionally
cover deduplication, ownership, out-of-order events, exact window boundaries,
missing associations, deleted QA files, and actual `test|prod` provider modes.

The local environment deliberately does not satisfy the existing production
Plausible gate. Internal records and third-party goal counts therefore have
different expected coverage here. The seven Plausible event names, finite
properties, browser/server senders, and authentication implementation are
unchanged from the base revision. Internal identity keys never become Plausible
properties. Historical 337 events/accounts and the old 1/66 node ratio remain
unjoined observations; this sample does not reconstruct their identities.

## Verification and rollout boundary

- Exact implementation typecheck exited 0; the production build also exited 0.
  Only SQL/docs/tests changed after that build began; runtime TypeScript was
  identical. Scoped Biome passed.
- Independent exact-implementation verification passed 40 tests: 34 current
  measurement/API tests and six reviewer regressions. The five first-round
  linkage/timing findings have regression coverage.
- Earlier full-suite run: 279 passed, 72 skipped, one unchanged layout timeout;
  that exact layout file passed an unchanged isolated rerun. This was not a
  clean first full-suite attempt.
- Production migration, enabling collection, OAuth/email acceptance, AI-provider
  generation, payment-provider acceptance, and payment remain outside this local
  sample. The delivery endpoint is the reviewable PR and reproducible query.

Metric definitions, classification input shape, rerun command, limitations, and
opt-in migration/flag sequence are in [the measurement contract](TAN-599.md).
The original executor retains the browser receipts, XML download, screenshots,
raw UTC database readback, aggregate reports, and reviewer logs in its TAN-599
evidence bundle. The final independent CR verdict is recorded with the PR and
the same Linear Workpad.
