/**
 * [INPUT] Confirmed product milestones and finite context values.
 * [OUTPUT] English Plausible goals, production gate and safe properties.
 * [POS] Shared FlowchartAI analytics contract, matching SpriteFuse semantics.
 * [UPDATE] Keep dashboard Goals, sender tests and README.md in sync.
 */
export const EVENTS = {
  registrationCompleted: 'Registration Completed',
  processingStarted: 'Flowchart Processing Started',
  exportReady: 'Flowchart Export Ready',
  downloadClicked: 'Download Clicked',
  paywallViewed: 'Paywall Viewed',
  checkoutHandoff: 'Checkout Handoff',
  paymentConfirmed: 'Payment Confirmed',
} as const;

export const CORE_GOALS = Object.values(EVENTS);
export type CoreEvent = (typeof CORE_GOALS)[number];
export interface EventProperties {
  source?: 'paywall' | 'pricing';
  mode?: 'text_to_flowchart' | 'image_to_flowchart';
  editor?: 'drawio' | 'excalidraw';
  format?: 'png' | 'svg' | 'drawio' | 'excalidraw';
}

const PROPERTY_VALUES = {
  source: ['paywall', 'pricing'],
  mode: ['text_to_flowchart', 'image_to_flowchart'],
  editor: ['drawio', 'excalidraw'],
  format: ['png', 'svg', 'drawio', 'excalidraw'],
} as const;

export function sanitizeEventProperties(
  properties: Record<string, unknown> | EventProperties
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, values] of Object.entries(PROPERTY_VALUES)) {
    const value = (properties as Record<string, unknown>)[key];
    if (
      typeof value === 'string' &&
      (values as readonly string[]).includes(value)
    )
      safe[key] = value;
  }
  return safe;
}

export function isProductionAnalytics(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    env.NODE_ENV === 'production' &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === 'production') &&
    env.NEXT_PUBLIC_BASE_URL === 'https://flowchartai.org' &&
    env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN === 'flowchartai.org' &&
    !!env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT
  );
}

export function eventPath(event: CoreEvent): string {
  if (event === EVENTS.registrationCompleted) return '/auth/login';
  if (event === EVENTS.checkoutHandoff || event === EVENTS.paymentConfirmed)
    return '/pricing';
  return '/canvas';
}
