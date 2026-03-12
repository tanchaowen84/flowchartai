import { getActiveSubscriptionAction } from '@/actions/get-active-subscription';
import { getLifetimeStatusAction } from '@/actions/get-lifetime-status';
import { getAllPricePlans } from '@/lib/price-plan';
import type { PricePlan, Subscription } from '@/payment/types';
import { create } from 'zustand';

/**
 * Payment state interface
 */
export interface PaymentState {
  // Current plan
  currentPlan: PricePlan | null;
  // Active subscription
  subscription: Subscription | null;
  // Loading state
  isLoading: boolean;
  // Error state
  error: string | null;

  // Actions
  fetchPayment: (user: { id: string; name?: string | null; email?: string | null; image?: string | null } | null | undefined) => Promise<void>;
  resetState: () => void;
}

/**
 * Payment store using Zustand
 * Manages the user's payment and subscription data globally
 */
export const usePaymentStore = create<PaymentState>((set, get) => ({
  // Initial state
  currentPlan: null,
  subscription: null,
  isLoading: false,
  error: null,

  /**
   * Fetch payment and subscription data for the current user
   * @param user Current user from auth session
   */
  fetchPayment: async (user) => {
    // Skip if already loading
    if (get().isLoading) return;

    // Skip if no user is provided
    if (!user) {
      set({
        currentPlan: null,
        subscription: null,
        error: null,
      });
      return;
    }

    // Fetch subscription data
    set({ isLoading: true, error: null });

    // Get all price plans
    const plans: PricePlan[] = getAllPricePlans();
    const freePlan = plans.find((plan) => plan.isFree);
    const lifetimePlan = plans.find((plan) => plan.isLifetime);

    // Check if user is a lifetime member directly from the database
    let isLifetimeMember = false;
    try {
      const result = await getLifetimeStatusAction({ userId: user.id });
      if (result?.data?.success) {
        isLifetimeMember = result.data.isLifetimeMember || false;
        console.log('get lifetime status result', result);
      } else {
        console.warn('get lifetime status failed', result?.data?.error);
        // set({
        //   error: result?.data?.error || 'Failed to fetch payment data',
        //   isLoading: false
        // });
      }
    } catch (error) {
      console.error('get lifetime status error:', error);
      // set({
      //   error: 'Failed to fetch payment data',
      //   isLoading: false
      // });
    }

    // If lifetime member, set the lifetime plan
    if (isLifetimeMember) {
      console.log('set lifetime plan for user', user.id);
      set({
        currentPlan: lifetimePlan || null,
        subscription: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      // Check if user has an active subscription
      const result = await getActiveSubscriptionAction({ userId: user.id });
      if (result?.data?.success) {
        const activeSubscription = result.data.data;

        // Set subscription state
        if (activeSubscription) {
          const plan =
            plans.find((p) =>
              p.prices.find(
                (price) => price.priceId === activeSubscription.priceId
              )
            ) || null;
          console.log(
            'subscription found, setting plan for user',
            user.id,
            plan?.id
          );
          set({
            currentPlan: plan,
            subscription: activeSubscription,
            isLoading: false,
            error: null,
          });
        } else {
          // No subscription found - set to free plan
          console.log(
            'no subscription found, setting free plan for user',
            user.id
          );
          set({
            currentPlan: freePlan || null,
            subscription: null,
            isLoading: false,
            error: null,
          });
        }
      } else {
        // Failed to fetch subscription
        console.error(
          'fetch subscription for user failed',
          result?.data?.error
        );
        set({
          error: result?.data?.error || 'Failed to fetch payment data',
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('fetch payment data error:', error);
      set({
        error: 'Failed to fetch payment data',
        isLoading: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Reset payment state
   */
  resetState: () => {
    set({
      currentPlan: null,
      subscription: null,
      isLoading: false,
      error: null,
    });
  },
}));
