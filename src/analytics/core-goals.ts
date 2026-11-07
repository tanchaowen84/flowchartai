/**
 * [INPUT] Confirmed product milestones and finite context values.
 * [OUTPUT] English Plausible goals, production gate and safe properties.
 * [POS] Shared FlowchartAI analytics contract, matching SpriteFuse semantics.
 * [UPDATE] Keep dashboard Goals, sender tests and README.md in sync.
 */
import { SELLABLE_OFFERS } from '@/lib/billing/policy';

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
  /** Paywall Viewed: opened by a blocked request (auto) or by the user (manual). */
  trigger?: 'auto' | 'manual';
  /** Checkout Handoff: the sellable offer key, never a price or provider ID. */
  offer?: (typeof SELLABLE_OFFERS)[number];
}

const PROPERTY_VALUES = {
  source: ['paywall', 'pricing'],
  mode: ['text_to_flowchart', 'image_to_flowchart'],
  editor: ['drawio', 'excalidraw'],
  format: ['png', 'svg', 'drawio', 'excalidraw'],
  trigger: ['auto', 'manual'],
  offer: SELLABLE_OFFERS,
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
