'use server';

import { getDb } from '@/db';
import { user } from '@/db/schema';
import { getSession } from '@/lib/server';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { createCustomerPortal, getPaymentProvider } from '@/payment';
import { CreemProvider } from '@/payment/provider/creem';
import type { CreatePortalParams } from '@/payment/types';
import { eq } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create a safe action client
const actionClient = createSafeActionClient();

// Portal schema for validation
const portalSchema = z.object({
  userId: z.string().min(1, { message: 'User ID is required' }),
  returnUrl: z
    .string()
    .url({ message: 'Return URL must be a valid URL' })
    .optional(),
});

/**
 * Create a customer portal session
 */
export const createPortalAction = actionClient
  .schema(portalSchema)
  .action(async ({ parsedInput }) => {
    const { userId, returnUrl } = parsedInput;

    // Get the current user session for authorization
    const session = await getSession();
    if (!session) {
      console.warn(
        `unauthorized request to create portal session for user ${userId}`
      );
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    // Only allow users to create their own portal session
    if (session.user.id !== userId) {
      console.warn(
        `current user ${session.user.id} is not authorized to create portal session for user ${userId}`
      );
      return {
        success: false,
        error: 'Not authorized to do this action',
      };
    }

    try {
      // Determine which customer ID field to use based on payment provider
      const provider = getPaymentProvider('creem');
      const isCreemProvider = provider instanceof CreemProvider;

      // Get the user's customer ID from the database
      const db = await getDb();
      const customerResult = await db
        .select({
          customerId: isCreemProvider ? user.creemCustomerId : user.customerId,
          creemCustomerId: user.creemCustomerId,
          stripeCustomerId: user.customerId,
        })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const customerRecord = customerResult[0];
      if (!customerRecord) {
        console.error(`No user record found for user ${session.user.id}`);
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check if the appropriate customer ID exists
      const customerId = isCreemProvider
        ? customerRecord.creemCustomerId
        : customerRecord.stripeCustomerId;

      if (!customerId) {
        const providerName = isCreemProvider ? 'Creem' : 'Stripe';
        console.error(
          `No ${providerName} customer ID found for user ${session.user.id}`
        );
        console.log('User record:', {
          userId: session.user.id,
          creemCustomerId: customerRecord.creemCustomerId,
          stripeCustomerId: customerRecord.stripeCustomerId,
          currentProvider: providerName,
        });
        return {
          success: false,
          error: `No ${providerName} customer found for user`,
        };
      }

      // Get the current locale from the request
      const locale = await getLocale();

      // Create the portal session with localized URL if no custom return URL is provided
      const returnUrlWithLocale =
        returnUrl || getUrlWithLocale('/settings/billing', locale);
      const params: CreatePortalParams = {
        customerId: customerId,
        returnUrl: returnUrlWithLocale,
        locale,
      };

      const result = await provider.createCustomerPortal(params);
      // console.log('create customer portal result:', result);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('create customer portal error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
