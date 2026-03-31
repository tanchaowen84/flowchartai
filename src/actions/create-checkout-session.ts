'use server';

import { findPlanByPlanId } from '@/lib/price-plan';
import { getSession } from '@/lib/server';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { createCheckout } from '@/payment';
import type { CreateCheckoutParams } from '@/payment/types';
import { Routes } from '@/routes';
import { getLocale } from 'next-intl/server';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create a safe action client
const actionClient = createSafeActionClient();

// Checkout schema for validation
// metadata is optional, and may contain referral information if you need
const checkoutSchema = z.object({
  userId: z.string().min(1, { message: 'User ID is required' }),
  planId: z.string().min(1, { message: 'Plan ID is required' }),
  priceId: z.string().min(1, { message: 'Price ID is required' }),
  metadata: z.record(z.string()).optional(),
});

/**
 * Create a checkout session for a price plan
 */
export const createCheckoutAction = actionClient
  .schema(checkoutSchema)
  .action(async ({ parsedInput }) => {
    const { userId, planId, priceId, metadata } = parsedInput;

    // Get the current user session for authorization
    const session = await getSession();
    if (!session) {
      console.warn(
        `unauthorized request to create checkout session for user ${userId}`
      );
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    // Only allow users to create their own checkout session
    if (session.user.id !== userId) {
      console.warn(
        `current user ${session.user.id} is not authorized to create checkout session for user ${userId}`
      );
      return {
        success: false,
        error: 'Not authorized to do this action',
      };
    }

    try {
      // Get the current locale from the request
      const locale = await getLocale();

      // Check if plan exists
      const plan = findPlanByPlanId(planId);
      if (!plan) {
        return {
          success: false,
          error: 'Plan not found',
        };
      }

      // Add user id to metadata, so we can get it in the webhook event
      const customMetadata = {
        ...metadata,
        userId: session.user.id,
        userName: session.user.name || '',
      };

      // Create the checkout session with localized URLs
      const successUrl = getUrlWithLocale(
        '/settings/billing?session_id={CHECKOUT_SESSION_ID}',
        locale
      );
      const cancelUrl = getUrlWithLocale(Routes.Pricing, locale);
      const params: CreateCheckoutParams = {
        planId,
        priceId,
        customerEmail: session.user.email || '',
        metadata: customMetadata,
        successUrl,
        cancelUrl,
        locale,
      };

      const result = await createCheckout(params);
      // console.log('create checkout session result:', result);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('create checkout session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
