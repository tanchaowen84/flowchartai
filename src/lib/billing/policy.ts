/** Server-owned offers and versioned rates. Provider identifiers are resolved only on the server. */
export const RATE_VERSION = '2026-10-14-v1';
export const BILLING_OFFERS = {
  starter_month: {
    plan: 'starter',
    kind: 'subscription',
    interval: 'month',
    amount: 900,
    credits: 2000,
  },
  starter_year: {
    plan: 'starter',
    kind: 'subscription',
    interval: 'year',
    amount: 9000,
    credits: 2000,
  },
  pro_month: {
    plan: 'pro',
    kind: 'subscription',
    interval: 'month',
    amount: 1900,
    credits: 6000,
  },
  pro_year: {
    plan: 'pro',
    kind: 'subscription',
    interval: 'year',
    amount: 19000,
    credits: 6000,
  },
  starter_year_202610: {
    plan: 'starter',
    kind: 'subscription',
    interval: 'year',
    amount: 8400,
    credits: 2000,
  },
  pro_year_202610: {
    plan: 'pro',
    kind: 'subscription',
    interval: 'year',
    amount: 18000,
    credits: 6000,
  },
  pack_small: { plan: 'pack_small', kind: 'pack', amount: 1000, credits: 1500 },
  pack_large: { plan: 'pack_large', kind: 'pack', amount: 3000, credits: 5000 },
} as const;
export const OFFERS = BILLING_OFFERS;
// Sold offers stay immutable for renewal and webhook reconciliation.
export const SELLABLE_OFFERS = [
  'starter_month',
  'starter_year_202610',
  'pro_month',
  'pro_year_202610',
  'pack_small',
  'pack_large',
] as const;
export function isSellableOffer(
  value: unknown
): value is (typeof SELLABLE_OFFERS)[number] {
  return (
    typeof value === 'string' &&
    (SELLABLE_OFFERS as readonly string[]).includes(value)
  );
}
export const SIGNUP_TRIAL_CREDITS = 20;
export const FIRST_DIAGRAM_COMPUTE_LIMIT = 120;
export const FIRST_DIAGRAM_MAX_ATTEMPTS_PER_DAY = 5;
// Preserve eligibility for the old 200-credit grant before this release's policy boundary.
export const TRIAL_POLICY_START_AT = new Date('2026-10-16T00:00:00+08:00');
export function registrationCredits(createdAt: Date): number {
  return createdAt < TRIAL_POLICY_START_AT ? 200 : SIGNUP_TRIAL_CREDITS;
}
export type OfferKey = keyof typeof OFFERS;
export function isOfferKey(value: unknown): value is OfferKey {
  return typeof value === 'string' && Object.hasOwn(OFFERS, value);
}
export function billingEnabled(): boolean {
  return process.env.BILLING_V1_ENABLED === 'true';
}
export interface ModelCallUsage {
  model: string;
  input: number;
  cached: number;
  output: number;
  reasoning?: number;
  cost?: number;
  generationId?: string;
  platformFunded?: boolean;
}
// Units per token: 1 credit = 100000 units. Integers avoid monetary float drift.
const RATES: Record<string, { input: number; cached: number; output: number }> =
  {
    'deepseek/deepseek-v4-pro': { input: 200, cached: 20, output: 400 },
    'deepseek/deepseek-v4-flash': { input: 20, cached: 5, output: 40 },
    'bytedance-seed/seed-2.0-mini': { input: 20, cached: 20, output: 80 },
  };
export function creditsForCalls(calls: ModelCallUsage[]): number {
  let units = 0;
  for (const call of calls) {
    const rate = RATES[call.model.replace(/^openrouter\//, '')];
    if (!rate) throw new Error('Unconfigured model billing rate');
    if (
      ![call.input, call.cached, call.output].every(
        (n) => Number.isSafeInteger(n) && n >= 0
      ) ||
      call.cached > call.input
    )
      throw new Error('Invalid model usage');
    if (call.platformFunded) continue;
    units +=
      (call.input - call.cached) * rate.input +
      call.cached * rate.cached +
      call.output * rate.output;
    if (!Number.isSafeInteger(units))
      throw new Error('Usage exceeds safe integer range');
  }
  return calls.some((c) => !c.platformFunded)
    ? Math.max(1, Math.ceil(units / 100000))
    : 0;
}
export function monthAnniversary(anchor: Date, months: number): Date {
  const result = new Date(anchor);
  result.setUTCDate(1);
  result.setUTCMonth(anchor.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(anchor.getUTCDate(), last));
  return result;
}
export function currentCreditMonth(
  anchor: Date,
  paidThrough: Date,
  now = new Date()
): { start: Date; end: Date } | null {
  if (now < anchor || now >= paidThrough) return null;
  let month =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    anchor.getUTCMonth();
  if (monthAnniversary(anchor, month) > now) month--;
  const start = monthAnniversary(anchor, month);
  const next = monthAnniversary(anchor, month + 1);
  return { start, end: next < paidThrough ? next : paidThrough };
}
export type LegacyPlan = 'hobby' | 'professional';
export function legacyPlanForPayment(p: {
  provider?: string | null;
  legacyPlan?: string | null;
  priceId: string;
  metadata?: unknown;
}): LegacyPlan | null {
  if (p.provider === 'waffo') return null;
  if (p.legacyPlan === 'hobby' || p.legacyPlan === 'professional')
    return p.legacyPlan;
  if (p.priceId === 'prod_1V35YYIXprpZ6eY5O9CYOk') return 'professional'; // Verified retired manual Professional grant.
  if (
    [
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_HOBBY_MONTHLY,
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_HOBBY_YEARLY,
    ]
      .filter(Boolean)
      .includes(p.priceId)
  )
    return 'hobby';
  if (
    [
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_PROFESSIONAL_MONTHLY,
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_PROFESSIONAL_YEARLY,
    ]
      .filter(Boolean)
      .includes(p.priceId)
  )
    return 'professional';
  return null;
}
export function hasPaidAccess(
  p: {
    status: string;
    periodEnd: Date | null;
    cancelAtPeriodEnd?: boolean | null;
  },
  now = new Date()
): boolean {
  return Boolean(
    p.periodEnd &&
      p.periodEnd > now &&
      ['active', 'trialing', 'canceling', 'canceled', 'past_due'].includes(
        p.status
      ) &&
      (p.status !== 'canceled' || p.cancelAtPeriodEnd)
  );
}

export function subscriptionCreditWindow(
  key: OfferKey,
  anchor: Date,
  paidThrough: Date,
  now = new Date()
): { start: Date; end: Date } | null {
  const offer = OFFERS[key];
  if (now < anchor || now >= paidThrough || offer.kind !== 'subscription')
    return null;
  return offer.interval === 'month'
    ? { start: anchor, end: paidThrough }
    : currentCreditMonth(anchor, paidThrough, now);
}
