import type { getDb } from '@/db';
import { billingCheckouts, payment } from '@/db/schema';
import { BillingError } from '@/lib/billing/wallet';
import {
  type Capability,
  type Quote,
  anonymousCookie,
  uuidPattern,
} from '@site-insights/sdk/contracts';
/** Site adapter: shared protocol; local auth, components and purchase eligibility. */
import { createExperimentClient } from '@site-insights/sdk/server';
import { and, eq, inArray, ne } from 'drizzle-orm';
export const EXPERIMENT_SITE = process.env.SITE_INSIGHTS_SITE_ID || 'flowchart';
export const homeModules = [
  'hero',
  'demo',
  'features',
  'ai-capabilities',
  'use-cases',
  'tutorials',
  'pricing',
  'faq',
  'call-to-action',
];
export const experimentCapabilities: Capability[] = [
  { target: 'homepage-headline', kind: 'text' },
  {
    target: 'homepage-layout',
    kind: 'page',
    modules: homeModules,
    required_modules: homeModules,
  },
  { target: 'credit-pack-price', kind: 'pricing', offer_keys: ['pack_small'] },
];
export const experimentsEnabled = () =>
  process.env.SITE_INSIGHTS_EXPERIMENTS_ENABLED === 'true';
export function experimentClient() {
  const endpoint =
    process.env.SITE_INSIGHTS_ENDPOINT || 'https://myplausible.app/insights';
  const key = process.env.SITE_INSIGHTS_WRITE_KEY;
  if (!key)
    throw new BillingError(
      'experiment_unavailable',
      'Pricing is temporarily unavailable. Try again.',
      503
    );
  return createExperimentClient({ endpoint, siteId: EXPERIMENT_SITE, key });
}
export function anonymousFromCookie(cookie: string): string | null {
  const value = cookie
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(anonymousCookie(EXPERIMENT_SITE) + '='))
    ?.split('=')[1];
  return value && uuidPattern.test(value) ? value : null;
}
export async function firstBuyer(
  db: Pick<Awaited<ReturnType<typeof getDb>>, 'select'>,
  userId: string
): Promise<boolean> {
  const [checkout] = await db
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.userId, userId),
        inArray(billingCheckouts.state, ['paid', 'refunded'])
      )
    )
    .limit(1);
  const [legacy] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(and(eq(payment.userId, userId), ne(payment.status, 'failed')))
    .limit(1);
  return !checkout && !legacy;
}
export function validateQuote(
  quote: Quote,
  userId: string,
  now = Date.now()
): Quote {
  const v = quote.assignment?.value;
  const env = process.env.SITE_INSIGHTS_ENVIRONMENT || 'production';
  if (
    quote.site_id !== EXPERIMENT_SITE ||
    quote.environment !== env ||
    quote.user_id !== userId ||
    quote.target !== 'credit-pack-price' ||
    !uuidPattern.test(quote.id) ||
    !v ||
    v.kind !== 'pricing' ||
    v.offer_key !== 'pack_small' ||
    v.currency !== 'USD' ||
    !Number.isSafeInteger(v.amount_minor) ||
    v.amount_minor < 50 ||
    v.amount_minor > 100000 ||
    !Number.isSafeInteger(v.credits) ||
    v.credits < 1 ||
    v.credits > 1000000 ||
    !Number.isFinite(Date.parse(quote.expires_at)) ||
    Date.parse(quote.expires_at) <= now
  )
    throw new BillingError(
      'quote_invalid',
      'This price has expired or is unavailable. Refresh pricing before checkout.',
      409
    );
  return quote;
}
