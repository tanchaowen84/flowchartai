import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { payment } from '@/db/schema';
import { billingEnabled } from '@/lib/billing/policy';
import { desc, eq } from 'drizzle-orm';
import { CreemProvider } from './provider/creem';
import { StripeProvider } from './provider/stripe';
import type {
  CheckoutResult,
  CreateCheckoutParams,
  CreatePortalParams,
  PaymentProvider,
  PortalResult,
  Subscription,
  getSubscriptionsParams,
} from './types';

/**
 * Global payment provider instance
 */
let paymentProvider: PaymentProvider | null = null;

/**
 * Get the payment provider
 * @returns current payment provider instance
 * @throws Error if provider is not initialized
 */
export const getPaymentProvider = (
  name?: 'creem' | 'stripe'
): PaymentProvider => {
  if (name === 'creem') return new CreemProvider();
  if (name === 'stripe') return new StripeProvider();
  if (!paymentProvider) {
    return initializePaymentProvider();
  }
  return paymentProvider;
};

/**
 * Initialize the payment provider
 * @returns initialized payment provider
 */
export const initializePaymentProvider = (): PaymentProvider => {
  if (!paymentProvider) {
    if (websiteConfig.payment.provider === 'stripe') {
      paymentProvider = new StripeProvider();
    } else if (websiteConfig.payment.provider === 'creem') {
      paymentProvider = new CreemProvider();
    } else {
      throw new Error(
        `Unsupported payment provider: ${websiteConfig.payment.provider}`
      );
    }
  }
  return paymentProvider;
};

/**
 * Create a checkout session for a plan
 * @param params Parameters for creating the checkout session
 * @returns Checkout result
 */
export const createCheckout = async (
  params: CreateCheckoutParams
): Promise<CheckoutResult> => {
  const provider = getPaymentProvider();
  return provider.createCheckout(params);
};

/**
 * Create a customer portal session
 * @param params Parameters for creating the portal
 * @returns Portal result
 */
export const createCustomerPortal = async (
  params: CreatePortalParams
): Promise<PortalResult> => {
  const provider = getPaymentProvider();
  return provider.createCustomerPortal(params);
};

/**
 * Handle webhook event
 * @param payload Raw webhook payload
 * @param signature Webhook signature
 */
export const handleWebhookEvent = async (
  payload: string,
  signature: string
): Promise<void> => {
  const provider = getPaymentProvider();
  await provider.handleWebhookEvent(payload, signature);
};

/**
 * List customer subscriptions
 * @param params Parameters for listing customer subscriptions
 * @returns Array of subscriptions
 */
export const getSubscriptions = async (
  params: getSubscriptionsParams
): Promise<Subscription[]> => {
  if (billingEnabled()) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(payment)
      .where(eq(payment.userId, params.userId))
      .orderBy(desc(payment.createdAt));
    return rows
      .filter((p) => p.type === 'subscription')
      .map((p) => ({
        id: p.subscriptionId || p.id,
        customerId: p.customerId,
        priceId: p.priceId,
        status: p.status as Subscription['status'],
        type: p.type as Subscription['type'],
        interval: p.interval as Subscription['interval'],
        currentPeriodStart: p.periodStart || undefined,
        currentPeriodEnd: p.periodEnd || undefined,
        cancelAtPeriodEnd: p.cancelAtPeriodEnd || false,
        createdAt: p.createdAt,
      }));
  }
  const provider = getPaymentProvider();
  return provider.getSubscriptions(params);
};
