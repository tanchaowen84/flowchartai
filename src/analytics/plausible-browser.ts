/**
 * [INPUT] Browser milestones, production origin and allowlisted context.
 * [OUTPUT] Best-effort Plausible events, queued until the tracker loads.
 * [POS] Browser delivery for ready, download, paywall and checkout milestones.
 * [UPDATE] Sync core-goals.ts and loader when tracker behavior changes.
 */
import {
  EVENTS,
  type EventProperties,
  isProductionAnalytics,
  sanitizeEventProperties,
} from './core-goals';

type BrowserEvent =
  | typeof EVENTS.exportReady
  | typeof EVENTS.downloadClicked
  | typeof EVENTS.paywallViewed
  | typeof EVENTS.checkoutHandoff;
type Plausible = {
  (event: string, options: { props: Record<string, string> }): void;
  q?: unknown[][];
};

declare global {
  interface Window {
    plausible?: Plausible;
  }
}

export function trackFlowchartEvent(
  event: BrowserEvent,
  properties: EventProperties = {}
): void {
  if (
    typeof window === 'undefined' ||
    window.location.origin !== 'https://flowchartai.org' ||
    !isProductionAnalytics({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
      NEXT_PUBLIC_PLAUSIBLE_SCRIPT: process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT,
    }) ||
    ![
      EVENTS.exportReady,
      EVENTS.downloadClicked,
      EVENTS.paywallViewed,
      EVENTS.checkoutHandoff,
    ].includes(event)
  )
    return;
  try {
    // The existing tracker uses XHR. A beacon survives the immediate redirect
    // to the payment provider, so checkout handoff is not lost when the page unloads.
    if (event === EVENTS.checkoutHandoff && window.navigator?.sendBeacon) {
      try {
        if (window.localStorage?.getItem('plausible_ignore') === 'true') return;
      } catch {}
      const accepted = window.navigator.sendBeacon(
        new URL(
          '/api/event',
          process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT
        ).toString(),
        new Blob(
          [
            JSON.stringify({
              name: event,
              domain: 'flowchartai.org',
              url: 'https://flowchartai.org/pricing',
              props: sanitizeEventProperties(properties),
            }),
          ],
          { type: 'text/plain' }
        )
      );
      if (accepted) return;
    }
    if (!window.plausible) {
      const queue: Plausible = (...args) => {
        queue.q?.push(args);
      };
      queue.q = [];
      window.plausible = queue;
    }
    window.plausible(event, { props: sanitizeEventProperties(properties) });
  } catch {
    // Analytics must never block an export or checkout.
  }
}
