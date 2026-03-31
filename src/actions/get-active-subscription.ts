'use server';

import { getSession } from '@/lib/server';
import { getSubscriptions } from '@/payment';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create a safe action client
const actionClient = createSafeActionClient();

// Input schema
const schema = z.object({
  userId: z.string().min(1, { message: 'User ID is required' }),
});

/**
 * Get active subscription data
 *
 * If the user has multiple subscriptions,
 * it returns the most recent active or trialing one
 */
export const getActiveSubscriptionAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }) => {
    const { userId } = parsedInput;

    // Get the current user session for authorization
    const session = await getSession();
    if (!session) {
      console.warn(
        `unauthorized request to get active subscription for user ${userId}`
      );
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    // Only allow users to check their own status (admin check temporarily disabled)
    if (session.user.id !== userId) {
      console.warn(
        `current user ${session.user.id} is not authorized to get active subscription for user ${userId}`
      );
      return {
        success: false,
        error: 'Not authorized to do this action',
      };
    }

    try {
      // Find the user's most recent active subscription
      const subscriptions = await getSubscriptions({
        userId: session.user.id,
      });
      // console.log('get user subscriptions:', subscriptions);

      let subscriptionData = null;
      // Find the most recent valid subscription (including grace period)
      if (subscriptions && subscriptions.length > 0) {
        // First try to find an active or trialing subscription
        const activeSubscription = subscriptions.find(
          (sub) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (activeSubscription) {
          console.log('find active subscription for userId:', session.user.id);
          subscriptionData = activeSubscription;
        } else {
          // If no active subscription, look for canceled subscriptions in grace period
          const canceledWithGracePeriod = subscriptions.find(
            (sub) =>
              sub.status === 'canceled' &&
              sub.cancelAtPeriodEnd &&
              sub.currentPeriodEnd &&
              new Date(sub.currentPeriodEnd) > new Date()
          );

          if (canceledWithGracePeriod) {
            console.log(
              'find canceled subscription in grace period for userId:',
              session.user.id
            );
            subscriptionData = canceledWithGracePeriod;
          } else {
            console.log(
              'no valid subscription found for userId:',
              session.user.id
            );
          }
        }
      } else {
        console.log('no subscriptions found for userId:', session.user.id);
      }

      return {
        success: true,
        data: subscriptionData,
      };
    } catch (error) {
      console.error('get user subscription data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
