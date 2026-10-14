import { websiteConfig } from '@/config/website';
import { OFFERS, isOfferKey } from '@/lib/billing/policy';
import { PaymentTypes, PlanIntervals } from '@/payment/types';
import type { Price, PricePlan } from '@/payment/types';

/**
 * Get all price plans (without translations, like name/description/features)
 * NOTICE: This function can be used in server or client components.
 * @returns Array of price plans
 */
export const getAllPricePlans = (): PricePlan[] => {
  return Object.values(websiteConfig.price.plans);
};

/**
 * Get plan by plan ID
 * @param planId Plan ID
 * @returns Plan or undefined if not found
 */
export const findPlanByPlanId = (planId: string): PricePlan | undefined => {
  return getAllPricePlans().find((plan) => plan.id === planId);
};

/**
 * Find plan by price ID
 * @param priceId Price ID (Stripe price ID)
 * @returns Plan or undefined if not found
 */
export const findPlanByPriceId = (priceId: string): PricePlan | undefined => {
  if (
    process.env.NEXT_PUBLIC_BILLING_V1_ENABLED === 'true' &&
    isOfferKey(priceId)
  ) {
    const offer = OFFERS[priceId];
    if (offer.kind === 'subscription')
      return {
        id: offer.plan,
        name: offer.plan === 'pro' ? 'Pro' : 'Starter',
        isFree: false,
        isLifetime: false,
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId,
            amount: offer.amount,
            currency: 'USD',
            interval:
              offer.interval === 'year'
                ? PlanIntervals.YEAR
                : PlanIntervals.MONTH,
          },
        ],
      };
  }
  const plans = getAllPricePlans();
  for (const plan of plans) {
    const matchingPrice = plan.prices.find(
      (price) => price.priceId === priceId
    );
    if (matchingPrice) {
      return plan;
    }
  }
  return undefined;
};

/**
 * Find price in a plan by ID
 * @param planId Plan ID
 * @param priceId Price ID (Stripe price ID)
 * @returns Price or undefined if not found
 */
export const findPriceInPlan = (
  planId: string,
  priceId: string
): Price | undefined => {
  const plan = findPlanByPlanId(planId);
  if (!plan) {
    console.error(`findPriceInPlan, Plan with ID ${planId} not found`);
    return undefined;
  }
  return plan.prices.find((price) => price.priceId === priceId);
};
