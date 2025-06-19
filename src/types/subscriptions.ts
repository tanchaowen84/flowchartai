export interface ProductTier {
  name: string;
  id: string;
  productId: string;
  priceMonthly: string;
  description: string;
  featured: boolean;
  features?: string[];
  creditAmount?: number;
  discountCode?: string;
}

export type SubscriptionStatus = {
  isSubscribed: boolean;
  status: string | null;
  willEndOn: Date | null;
  isInGracePeriod: boolean;
  daysLeft: number | null;
};

export type SubscriptionState =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'expired';

// Constants for subscription status checks
export const ACTIVE_STATUSES = ['active', 'trialing'] as const;
export const GRACE_PERIOD_STATUSES = [
  'canceled',
  'past_due',
  'unpaid',
  'paused',
] as const;
