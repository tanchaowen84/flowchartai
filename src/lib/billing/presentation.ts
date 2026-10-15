import { OFFERS, type OfferKey } from './policy';
export type CreditView = 'monthly' | 'yearly' | 'once';
export function offersForView(view: CreditView): OfferKey[] {
  return view === 'once'
    ? ['pack_small', 'pack_large']
    : view === 'yearly'
      ? ['starter_year_202610', 'pro_year_202610']
      : ['starter_month', 'pro_month'];
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
