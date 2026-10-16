# FlowchartAI operating analytics

The dashboard uses seven English goals, following SpriteFuse's milestone definitions.

| Event | Trigger |
| --- | --- |
| Registration Completed | Better Auth persisted a new user (email, OTP or social); returning logins do not count. |
| Flowchart Processing Started | The server passed auth, quota, moderation and agent startup, then accepted the generation/edit request. |
| Flowchart Export Ready | A validated AI command was successfully applied to the native or Excalidraw canvas. Chat-only answers and render failures do not count. |
| Download Clicked | The user selected an export format on a nonempty canvas. This records intent, including failed export attempts; it does not prove a file was saved. |
| Paywall Viewed | The pricing modal transitions from closed to open. Initial closed renders and plan/tab changes do not count. |
| Checkout Handoff | A valid checkout URL was returned and browser navigation to Waffo (or the legacy provider) was initiated. Waffo popup and fallback entry points share one sender; blocked/closed popups wait for a fallback click. Repeat handoffs for a URL are deduplicated for the lifetime of the mounted checkout component. This does not prove the cashier loaded or payment succeeded. |
| Payment Confirmed | A live, signed `checkout.completed` webhook with a paid positive-value order finished its database transaction. Count each order once. |

Only four finite properties are used: `source` (`paywall`/`pricing`, for the new paywall and Waffo checkout paths), `mode` (text/image), `editor` (drawio/excalidraw), and `format` (PNG/SVG/drawio/Excalidraw). Never send prompts, diagram contents, images, filenames, emails, user IDs, payment IDs or errors as event properties.

Production requires the canonical `https://flowchartai.org` base URL, the `flowchartai.org` Plausible domain and the existing script setting. Vercel Preview and localhost are excluded. The deployed self-hosted `/js/script.js` already supports custom events; `script.custom-events.js` returns 404 and must not be used here. Browser events queue before tracker initialization; checkout uses `sendBeacon` to survive navigation.

Server events forward the original browser's User-Agent and client IP, as required by the Plausible Events API for visitor recognition. Checkout attribution is AES-GCM encrypted using a key derived from the existing `BETTER_AUTH_SECRET`, placed in Creem or Waffo order metadata, and expires after seven days. Raw headers are not stored in our database or exposed as event properties. Webhook processing decrypts the context only after signature verification and transaction commit.

Payment delivery atomically claims a hashed order key under `user.metadata.plausiblePaymentOrders`. It adds no schema/migration and preserves other metadata. Retries and duplicate callbacks cannot increase the event count. Delivery is best-effort and at most once: a collector/network failure after the claim may lose telemetry, while the payment remains successful. Payment ledgers/provider records remain the financial source of truth.

`Payment Confirmed` measures new checkout purchases, including the initial subscription purchase; subscription renewals, trials, free orders, activation-only notifications, old checkouts without attribution, and attribution older than seven days are excluded. Waffo uses positive `chargedAmount` and `paymentStatus=succeeded` from `order.completed` or period 1 of `subscription.payment_succeeded`; plan changes are excluded. An atomic hashed order claim prevents duplicate conversions on webhook replay. No real payment is created as part of analytics QA.

Maintain `core-goals.ts` as the name contract; keep the Plausible Goals and this document in sync. `plausible-browser.ts` owns browser delivery; `plausible-server.ts` owns bounded server delivery; `payment-conversion.ts` and `checkout-context.ts` own payment evidence and encrypted attribution.

Verify with `pnpm test`, `pnpm typecheck`, `pnpm build`, and Biome on changed files. Production acceptance must separately record deployed commit, collector receipts, dashboard Goals/properties, real output/download, checkout handoff, and whether a real payment was observed.
