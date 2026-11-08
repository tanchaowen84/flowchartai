# Paywall Phase 1 (2026-11-07)

Paywall UI and analytics only. No price, credit or catalog changes.

## Why

From Oct 16 to Nov 6 2026, 342 users saw the paywall and 7 handed off to checkout from it (2.0%). The modal opened on Monthly with Starter $9/mo preselected, but 4 of 5 real Waffo checkouts were the $10 one-time pack. The 2026-10-15 paywall guidance evaluation already recommended leading with the pack.

## What changed

| Area | Before | After |
| --- | --- | --- |
| Default | Monthly tab, Starter $9/mo | One-time tab, Small pack $10 (1,500 credits). Tabs: One-time, Monthly, Yearly |
| Value | Credits only | "≈ N diagrams" on each card; CTA "Get ~100 diagrams & continue — $10 once" |
| Header (blocked request) | "Keep creating with AI" | "Add credits to continue" + why (balance 0: "You've used all your credits"; balance > 0: "This request needs more than your N remaining credits") + prompt/diagram kept, manual editing and downloads stay free |
| Header (manual open) | Generic | Unchanged |
| Popup blocked (mobile in-app browsers) | Small muted "Waiting for payment confirmation. Open secure checkout" link; CTA unchanged | "Checkout didn't open automatically." + full-width "Open secure checkout" button. Changing the offer clears the stale link |
| Paywall Viewed | `source` | + `trigger: auto \| manual` |
| Checkout Handoff | `source`; page always `/pricing` | + `offer` (sellable offer key); page is the real path |

### /pricing (option B, owner choice 2026-11-07)

/pricing had 102 visitors from Oct 16 to Nov 7, against 344 paywall viewers. They were 28% US and 91% desktop, mostly coming from the homepage before trying the app. So the page keeps subscriptions first. It now adds "≈ N diagrams" to every card (Free ≈ 1, Starter ≈ 130/mo, Pro ≈ 400/mo, packs ≈ 100 / 330) and renames "Extra credits" to "One-time packs · no subscription" with solid buttons. It also gets the same blocked-popup button as the paywall, scrolled into view. The same cards appear on the settings billing page.

### Diagram estimate needs calibrating

N = credits / `CREDITS_PER_TYPICAL_DIAGRAM` (15, in `src/lib/billing/presentation.ts`), rounded down. 15 sits between the observed simple (≈ 9) and complex (≈ 23) requests. It was not derived from production data, because reading the production DB needs the owner's approval. Replace it with the real median credits per AI request. The owner chose to publish the /pricing estimates only after calibration. The production read was blocked in the agent session; `calibration-query.sql` is the read-only query to run in the Supabase SQL editor.

### Why Checkout Handoff always showed `/pricing`

`plausible-browser.ts` sends Checkout Handoff by `sendBeacon` so the event survives navigation. That payload hardcoded `url: 'https://flowchartai.org/pricing'`, so every handoff, including the canvas paywall, was recorded on `/pricing`. It now sends the current path (no query or hash). Older data can only be split by `source`.

## Evidence

Local dev (`next dev`), real `PricingModal` / `CreditPlanSelector`, with `/api/billing/wallet` and `/api/billing/checkout` stubbed in an uncommitted harness page. No database (the repo `.env` points at production) and no Waffo call.

- `before-desktop.jpg`, `before-mobile-390.jpg`: origin/main, blocked request, balance 0.
- `after-desktop.jpg`, `after-mobile-390.jpg`: this change, same state.
- `before-pricing-*.jpg` (live site) and `after-pricing-*.jpg` (local dev, signed out): /pricing at 1280 and 390.
- `after-mobile-390-popup-blocked.jpg`: 390 × 844, `window.open` returned `null`; the fallback is a 48px full-width button inside the sticky footer. Tapping it starts a new-tab navigation to the checkout URL, records the handoff once, and the footer returns to "Waiting for payment confirmation".

Not verified: a real hosted Waffo cashier on a physical phone or inside Instagram/Facebook/WhatsApp in-app browsers, and the end-to-end resume after payment (unchanged code).
