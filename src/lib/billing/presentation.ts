import { OFFERS, type OfferKey } from './policy';
export type CreditView = 'monthly' | 'yearly' | 'once';
/** Paywall tab order. One-time leads: most real Waffo orders were the $10 pack. */
export const CREDIT_VIEWS: readonly CreditView[] = [
  'once',
  'monthly',
  'yearly',
];
export const DEFAULT_CREDIT_VIEW: CreditView = 'once';
export const DEFAULT_CREDIT_OFFER: OfferKey = 'pack_small';
/**
 * Credits a typical AI diagram request uses, for the "≈ N diagrams" estimate.
 * Calibrated from real runs on the production model (DeepSeek V4 Pro) at the
 * current rates (docs/billing/research/billing-v1-2026-10-14/usage-results.json):
 * simple 9, complex 23, complex edits 23–35; median of billed runs 23, rounded
 * up to 25 so the estimate errs low. Recheck against production
 * (docs/paywall/phase1-2026-11/calibration-query.sql) when rates or model change.
 */
export const CREDITS_PER_TYPICAL_DIAGRAM = 25;
/** Rounded down, so the promise stays conservative (1,500 credits → 60). */
export function estimateDiagrams(credits: number): number {
  const diagrams = Math.floor(
    Math.max(0, credits) / CREDITS_PER_TYPICAL_DIAGRAM
  );
  return diagrams >= 100 ? Math.floor(diagrams / 10) * 10 : diagrams;
}
/** "≈ 100 diagrams" / "≈ 1 diagram", for cards on the paywall and /pricing. */
export function approxDiagrams(credits: number): string {
  const n = estimateDiagrams(credits);
  return `≈ ${n.toLocaleString('en-US')} ${n === 1 ? 'diagram' : 'diagrams'}`;
}
export function offersForView(view: CreditView): OfferKey[] {
  return view === 'once'
    ? ['pack_small', 'pack_large']
    : view === 'yearly'
      ? ['starter_year_202610', 'pro_year_202610']
      : ['starter_month', 'pro_month'];
}
/** Primary paywall action: what the money buys, then the exact charge. */
export function checkoutCta(key: OfferKey): string {
  const o = OFFERS[key];
  const diagrams = `~${estimateDiagrams(o.credits).toLocaleString('en-US')} diagrams`;
  const price = `$${o.amount / 100}`;
  // Non-breaking space keeps the charge on one line on phones.
  if (o.kind === 'pack')
    return `Get ${diagrams} & continue — ${price}\u00a0once`;
  return o.interval === 'year'
    ? `Get ${diagrams}/month & continue — ${price}/year`
    : `Get ${diagrams}/month & continue — ${price}/month`;
}
export interface PaywallHeader {
  title: string;
  reason: string;
  reassurance?: string;
}
/**
 * Why the paywall is showing. A paused request explains the block; it never
 * claims the balance is used up unless it really is zero.
 */
export function paywallHeader({
  hasPendingRequest,
  balance,
}: {
  hasPendingRequest?: boolean;
  balance?: number;
}): PaywallHeader {
  if (!hasPendingRequest)
    return {
      title: 'Keep creating with AI',
      reason: 'Choose credits for your next flowchart.',
    };
  const known = typeof balance === 'number' && Number.isFinite(balance);
  const reason =
    known && balance <= 0
      ? "You've used all your credits."
      : known
        ? `This request needs more than your ${balance.toLocaleString('en-US')} remaining credits.`
        : 'Your credit balance is too low for this request.';
  return {
    title: 'Add credits to continue',
    reason,
    reassurance:
      'Your prompt and diagram are kept, and the request continues after payment. Manual editing and downloads stay free.',
  };
}
export function creditPrice(key: OfferKey): {
  name: string;
  main: number;
  period: string;
  billed?: string;
  savings?: number;
  credits: number;
} {
  const o = OFFERS[key];
  const annual = o.kind === 'subscription' && o.interval === 'year';
  const monthly =
    o.plan === 'starter' ? OFFERS.starter_month : OFFERS.pro_month;
  return {
    name:
      o.kind === 'pack'
        ? key === 'pack_small'
          ? 'Small pack'
          : 'Large pack'
        : o.plan === 'starter'
          ? 'Starter'
          : 'Pro',
    main: o.amount / (annual ? 1200 : 100),
    period: o.kind === 'pack' ? 'once' : '/ month',
    ...(annual
      ? {
          billed: `Billed $${o.amount / 100} yearly`,
          savings: (monthly.amount * 12) / 100 - o.amount / 100,
        }
      : {}),
    credits: o.credits,
  };
}
