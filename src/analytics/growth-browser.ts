/** First-party only: business keys in this module must never reach Plausible. */
import type { EventProperties } from './core-goals';
let active: { path: string; taskId: string; flowchartId?: string } | null =
  null;
export function setGrowthResult(taskId: string, flowchartId?: string): void {
  if (typeof window !== 'undefined')
    active = { path: window.location.pathname, taskId, flowchartId };
}
export function trackGrowth(
  name:
    | 'result_ready'
    | 'export_initiated'
    | 'paywall_viewed'
    | 'checkout_handoff',
  keys: { taskId?: string; flowchartId?: string; checkoutId?: string } = {},
  properties: EventProperties = {}
): void {
  if (
    typeof window === 'undefined' ||
    process.env.NEXT_PUBLIC_GROWTH_MEASUREMENT !== 'true'
  )
    return;
  try {
    const context = active?.path === window.location.pathname ? active : null;
    // An explicit saved file wins over a stale in-memory generation.
    const result =
      name === 'paywall_viewed' || name === 'checkout_handoff'
        ? {}
        : keys.flowchartId
          ? { flowchartId: keys.flowchartId, taskId: keys.taskId }
          : {
              taskId: keys.taskId || context?.taskId,
              flowchartId: context?.flowchartId,
            };
    void fetch('/api/measurement', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'event',
        id: crypto.randomUUID(),
        name,
        ...result,
        checkoutId: keys.checkoutId,
        source: properties.source,
        properties,
      }),
    }).catch(() => {});
  } catch {}
}
