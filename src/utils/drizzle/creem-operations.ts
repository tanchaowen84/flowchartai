/**
 * Creem Database Operations with Drizzle ORM
 * 
 * This module provides type-safe database operations for Creem payment integration
 * with comprehensive error handling, transaction support, and performance optimization.
 * 
 * @author Chaowen Team
 * @version 1.0.0
 */

import { getDb } from '../../db';
import { user, payment, creditsHistory } from '../../db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import type { 
  CreemCustomer, 
  CreemSubscription,
  CreemOrder,
  CreemProduct,
  PaymentStatus,
  PaymentType,
  PlanInterval
} from '../../payment/types';
import { 
  PlanIntervals,
  PaymentTypes
} from '../../payment/types';
import type { 
  PostgresJsDatabase 
} from 'drizzle-orm/postgres-js';
import type * as schema from '../../db/schema';

// Type definitions for better type safety
type DbTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0];
type UserRecord = typeof user.$inferSelect;
type PaymentRecord = typeof payment.$inferSelect;
type CreditsHistoryRecord = typeof creditsHistory.$inferSelect;

/**
 * Custom error classes for better error handling
 */
export class CreemOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CreemOperationError';
  }
}

export class UserNotFoundError extends CreemOperationError {
  constructor(identifier: string, cause?: unknown) {
    super(`User not found: ${identifier}`, 'user_lookup', cause);
    this.name = 'UserNotFoundError';
  }
}

export class InsufficientCreditsError extends CreemOperationError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits: required ${required}, available ${available}`,
      'credits_validation'
    );
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Status mapping from Creem to MkSaaS PaymentStatus
 * Note: CreemSubscription.status only has "active" | "canceled" | "expired"
 * Other statuses like "trialing", "paid", "unpaid" are event types, not subscription statuses
 */
const CREEM_STATUS_MAPPING: Record<string, PaymentStatus> = {
  'active': 'active',
  'canceled': 'canceled',
  'expired': 'canceled'  // Map expired to canceled in our system
} as const;

/**
 * Maps Creem subscription status to MkSaaS PaymentStatus
 * Also handles event-based status mapping for consistency with webhook events
 */
function mapCreemStatusToPaymentStatus(
  creemStatus: string, 
  eventType?: string
): PaymentStatus {
  // First, try event-based mapping (for webhook event consistency)
  if (eventType) {
    switch (eventType) {
      case 'subscription.active':
      case 'subscription.paid':
        return 'active';
      case 'subscription.trialing':
        return 'trialing';
      case 'subscription.canceled':
      case 'subscription.expired':
        return 'canceled';
      case 'subscription.unpaid':
        return 'past_due';
    }
  }

  // Fallback to subscription status mapping
  const mappedStatus = CREEM_STATUS_MAPPING[creemStatus];
  if (!mappedStatus) {
    console.warn(`Unknown Creem status: ${creemStatus}, defaulting to 'active'`);
    return 'active';
  }
  return mappedStatus;
}

/**
 * Safely parses ISO date string to Date object
 */
function parseISODate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string: ${dateString}`);
      return null;
    }
    return date;
  } catch (error) {
    console.warn(`Failed to parse date: ${dateString}`, error);
    return null;
  }
}

/**
 * Maps Creem billing period to MkSaaS PlanInterval
 */
function mapBillingPeriodToInterval(billingPeriod: string | undefined): PlanInterval | undefined {
  if (!billingPeriod) return undefined;
  
  const period = billingPeriod.toLowerCase();
  if (period.includes('month')) return PlanIntervals.MONTH;
  if (period.includes('year')) return PlanIntervals.YEAR;
  
  console.warn(`Unknown billing period: ${billingPeriod}`);
  return undefined;
}

/**
 * Maps Creem billing type to MkSaaS PaymentType
 */
function mapBillingTypeToPaymentType(billingType: string): PaymentType {
  switch (billingType) {
    case 'recurring':
      return PaymentTypes.SUBSCRIPTION;
    case 'one_time':
      return PaymentTypes.ONE_TIME;
    default:
      console.warn(`Unknown billing type: ${billingType}, defaulting to 'subscription'`);
      return PaymentTypes.SUBSCRIPTION;
  }
}

/**
 * Extracts product information from subscription or order
 */
function extractProductInfo(productData: string | CreemProduct): {
  id: string;
  billingType?: string;
  billingPeriod?: string;
  metadata?: any;
} {
  if (typeof productData === 'string') {
    return { id: productData };
  }
  
  return {
    id: productData.id,
    billingType: productData.billing_type,
    billingPeriod: productData.billing_period,
    metadata: productData.metadata
  };
}

/**
 * Updates user information from Creem customer data
 * 
 * @param tx - Database transaction instance
 * @param creemCustomer - Creem customer object
 * @param userId - User ID from metadata (optional, will be extracted if not provided)
 * @returns Promise<string> - The user ID that was updated
 * @throws {UserNotFoundError} When user cannot be found
 * @throws {CreemOperationError} When update operation fails
 */
export async function updateUserFromCreemCustomer(
  tx: DbTransaction,
  creemCustomer: CreemCustomer,
  userId?: string
): Promise<string> {
  try {
    // Validate input
    if (!creemCustomer?.id) {
      throw new CreemOperationError(
        'Invalid Creem customer: missing ID',
        'input_validation'
      );
    }

    let targetUserId = userId;

    // If userId not provided, try to find user by Creem customer ID
    if (!targetUserId) {
      const existingUser = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.creemCustomerId, creemCustomer.id))
        .limit(1);

      if (existingUser.length === 0) {
        throw new UserNotFoundError(
          `Creem customer ID: ${creemCustomer.id}`
        );
      }

      targetUserId = existingUser[0].id;
    }

    // Verify user exists
    const userExists = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);

    if (userExists.length === 0) {
      throw new UserNotFoundError(`User ID: ${targetUserId}`);
    }

    // Prepare update data with type safety
    const updateData: Partial<UserRecord> = {
      creemCustomerId: creemCustomer.id,
      email: creemCustomer.email,
      name: creemCustomer.name,
      country: creemCustomer.country,
      updatedAt: new Date(),
    };

    // Perform update
    const updateResult = await tx
      .update(user)
      .set(updateData)
      .where(eq(user.id, targetUserId))
      .returning({ id: user.id });

    if (updateResult.length === 0) {
      throw new CreemOperationError(
        'Failed to update user: no rows affected',
        'user_update'
      );
    }

    console.log(`✅ Updated user ${targetUserId} with Creem customer ${creemCustomer.id}`);
    return targetUserId;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to update user from Creem customer',
      'updateUserFromCreemCustomer',
      error
    );
  }
}

/**
 * Creates or updates payment record from Creem subscription data
 * 
 * @param tx - Database transaction instance
 * @param creemSubscription - Creem subscription object
 * @param userId - User ID to associate with the payment
 * @param eventType - Optional event type for accurate status mapping
 * @returns Promise<string> - The payment ID that was created or updated
 * @throws {CreemOperationError} When operation fails
 */
export async function createOrUpdatePaymentFromCreemSubscription(
  tx: DbTransaction,
  creemSubscription: CreemSubscription,
  userId: string,
  eventType?: string
): Promise<string> {
  try {
    // Validate input
    if (!creemSubscription?.id) {
      throw new CreemOperationError(
        'Invalid Creem subscription: missing ID',
        'input_validation'
      );
    }

    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    // Extract product information
    const productInfo = extractProductInfo(creemSubscription.product);
    
    if (!productInfo.id) {
      throw new CreemOperationError(
        'Invalid Creem subscription: missing product ID',
        'input_validation'
      );
    }

    // Determine payment type and interval
    const paymentType = productInfo.billingType 
      ? mapBillingTypeToPaymentType(productInfo.billingType)
      : PaymentTypes.SUBSCRIPTION;
    
    const interval = mapBillingPeriodToInterval(productInfo.billingPeriod);

    // Map status with event type for accurate mapping
    const mappedStatus = mapCreemStatusToPaymentStatus(
      creemSubscription.status, 
      eventType
    );

    // Parse dates
    const periodStart = parseISODate(creemSubscription.current_period_start_date);
    const periodEnd = parseISODate(creemSubscription.current_period_end_date);
    const canceledAt = parseISODate(creemSubscription.canceled_at);

    // Determine cancelAtPeriodEnd based on status and canceled_at
    const cancelAtPeriodEnd = creemSubscription.status === 'canceled' && 
                              canceledAt && 
                              periodEnd && 
                              canceledAt <= periodEnd;

    // Extract customer ID
    const customerId = typeof creemSubscription.customer === 'string' 
      ? creemSubscription.customer 
      : creemSubscription.customer?.id || '';

    // Check if payment already exists
    const existingPayment = await tx
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.subscriptionId, creemSubscription.id))
      .limit(1);

    const paymentData: Partial<PaymentRecord> = {
      priceId: productInfo.id, // Using product ID as price ID for Creem
      type: paymentType,
      interval: interval,
      userId: userId,
      customerId: customerId,
      subscriptionId: creemSubscription.id,
      status: mappedStatus,
      periodStart: periodStart,
      periodEnd: periodEnd,
      cancelAtPeriodEnd: cancelAtPeriodEnd,
      canceledAt: canceledAt,
      // Note: Creem doesn't provide trial info in subscription, would need to be handled separately
      trialStart: null,
      trialEnd: null,
      metadata: {
        ...creemSubscription.metadata,
        creem_mode: creemSubscription.mode,
        product_metadata: productInfo.metadata
      },
      updatedAt: new Date(),
    };

    let paymentId: string;

    if (existingPayment.length > 0) {
      // Update existing payment
      const updateResult = await tx
        .update(payment)
        .set(paymentData)
        .where(eq(payment.id, existingPayment[0].id))
        .returning({ id: payment.id });

      if (updateResult.length === 0) {
        throw new CreemOperationError(
          'Failed to update payment: no rows affected',
          'payment_update'
        );
      }

      paymentId = updateResult[0].id;
      console.log(`✅ Updated payment ${paymentId} for subscription ${creemSubscription.id}`);
    } else {
      // Create new payment - ensure all required fields are present
      const insertData = {
        id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        priceId: productInfo.id,
        type: paymentType,
        interval: interval,
        userId: userId,
        customerId: customerId,
        subscriptionId: creemSubscription.id,
        status: mappedStatus,
        periodStart: periodStart,
        periodEnd: periodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        trialStart: null,
        trialEnd: null,
        canceledAt: canceledAt,
        metadata: {
          ...creemSubscription.metadata,
          creem_mode: creemSubscription.mode,
          product_metadata: productInfo.metadata
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertResult = await tx
        .insert(payment)
        .values(insertData)
        .returning({ id: payment.id });

      if (insertResult.length === 0) {
        throw new CreemOperationError(
          'Failed to create payment: no rows returned',
          'payment_insert'
        );
      }

      paymentId = insertResult[0].id;
      console.log(`✅ Created payment ${paymentId} for subscription ${creemSubscription.id}`);
    }

    return paymentId;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to create or update payment from Creem subscription',
      'createOrUpdatePaymentFromCreemSubscription',
      error
    );
  }
}

/**
 * Creates or updates payment record from Creem order data (for one-time purchases)
 * 
 * @param tx - Database transaction instance
 * @param creemOrder - Creem order object
 * @param userId - User ID to associate with the payment
 * @returns Promise<string> - The payment ID that was created or updated
 * @throws {CreemOperationError} When operation fails
 */
export async function createOrUpdatePaymentFromCreemOrder(
  tx: DbTransaction,
  creemOrder: CreemOrder,
  userId: string
): Promise<string> {
  try {
    // Validate input
    if (!creemOrder?.id) {
      throw new CreemOperationError(
        'Invalid Creem order: missing ID',
        'input_validation'
      );
    }

    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    // Map order type to payment type
    const paymentType = mapBillingTypeToPaymentType(creemOrder.type);

    // Map order status to payment status
    let mappedStatus: PaymentStatus;
    switch (creemOrder.status) {
      case 'paid':
        mappedStatus = 'completed';
        break;
      case 'pending':
        mappedStatus = 'processing';
        break;
      case 'failed':
        mappedStatus = 'failed';
        break;
      default:
        mappedStatus = 'processing';
    }

    // Check if payment already exists for this order
    // For one-time payments, we should check by customer and order metadata
    const existingPayment = await tx
      .select({ id: payment.id, metadata: payment.metadata })
      .from(payment)
      .where(
        and(
          eq(payment.customerId, creemOrder.customer),
          eq(payment.type, PaymentTypes.ONE_TIME)
        )
      );

    // Filter by order ID in metadata if multiple payments exist
    const matchingPayment = existingPayment.find(p => {
      const metadata = p.metadata as any;
      return metadata?.creem_order_id === creemOrder.id;
    });

    const paymentData: Partial<PaymentRecord> = {
      priceId: creemOrder.product,
      type: paymentType,
      interval: null, // One-time payments don't have intervals
      userId: userId,
      customerId: creemOrder.customer,
      subscriptionId: null, // One-time payments don't have subscription IDs
      status: mappedStatus,
      periodStart: null,
      periodEnd: null,
      cancelAtPeriodEnd: null,
      trialStart: null,
      trialEnd: null,
      canceledAt: null,
              metadata: {
          ...creemOrder.metadata,
          creem_mode: creemOrder.mode,
          creem_order_id: creemOrder.id,
          amount: creemOrder.amount,
          currency: creemOrder.currency,
          order_type: creemOrder.type
        },
      updatedAt: new Date(),
    };

    let paymentId: string;

    if (matchingPayment) {
      // Update existing payment
      const updateResult = await tx
        .update(payment)
        .set(paymentData)
        .where(eq(payment.id, matchingPayment.id))
        .returning({ id: payment.id });

      if (updateResult.length === 0) {
        throw new CreemOperationError(
          'Failed to update payment: no rows affected',
          'payment_update'
        );
      }

      paymentId = updateResult[0].id;
      console.log(`✅ Updated payment ${paymentId} for order ${creemOrder.id}`);
    } else {
      // Create new payment
      const insertData = {
        id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        priceId: creemOrder.product,
        type: paymentType,
        interval: null,
        userId: userId,
        customerId: creemOrder.customer,
        subscriptionId: null,
        status: mappedStatus,
        periodStart: null,
        periodEnd: null,
        cancelAtPeriodEnd: null,
        trialStart: null,
        trialEnd: null,
        canceledAt: null,
        metadata: {
          ...creemOrder.metadata,
          creem_mode: creemOrder.mode,
          creem_order_id: creemOrder.id,
          amount: creemOrder.amount,
          currency: creemOrder.currency,
          order_type: creemOrder.type
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertResult = await tx
        .insert(payment)
        .values(insertData)
        .returning({ id: payment.id });

      if (insertResult.length === 0) {
        throw new CreemOperationError(
          'Failed to create payment: no rows returned',
          'payment_insert'
        );
      }

      paymentId = insertResult[0].id;
      console.log(`✅ Created payment ${paymentId} for order ${creemOrder.id}`);
    }

    return paymentId;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to create or update payment from Creem order',
      'createOrUpdatePaymentFromCreemOrder',
      error
    );
  }
}

/**
 * Adds credits to user account with transaction safety
 * 
 * @param tx - Database transaction instance
 * @param userId - User ID to add credits to
 * @param creditsAmount - Amount of credits to add (must be positive)
 * @param creemOrderId - Creem order ID for tracking (optional)
 * @param description - Description of the credit transaction (optional)
 * @returns Promise<number> - New total credits balance
 * @throws {UserNotFoundError} When user cannot be found
 * @throws {CreemOperationError} When operation fails
 */
export async function addCreditsToUser(
  tx: DbTransaction,
  userId: string,
  creditsAmount: number,
  creemOrderId?: string,
  description?: string
): Promise<number> {
  try {
    // Validate input
    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    if (!Number.isInteger(creditsAmount) || creditsAmount <= 0) {
      throw new CreemOperationError(
        `Invalid credits amount: ${creditsAmount}. Must be a positive integer.`,
        'input_validation'
      );
    }

    // Get current user credits
    const userRecord = await tx
      .select({ 
        id: user.id, 
        credits: user.credits 
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userRecord.length === 0) {
      throw new UserNotFoundError(userId);
    }

    const currentCredits = userRecord[0].credits || 0;
    const newCredits = currentCredits + creditsAmount;

    // Update user credits
    const updateResult = await tx
      .update(user)
      .set({ 
        credits: newCredits,
        updatedAt: new Date()
      } as any)
      .where(eq(user.id, userId))
      .returning({ credits: user.credits });

    if (updateResult.length === 0) {
      throw new CreemOperationError(
        'Failed to update user credits: no rows affected',
        'credits_update'
      );
    }

    // Record transaction in credits history
    const historyData = {
      id: `credits_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId,
      amount: creditsAmount,
      type: 'add' as const,
      description: description || `Added ${creditsAmount} credits`,
      creemOrderId: creemOrderId,
      createdAt: new Date(),
      metadata: {},
    };

    await tx
      .insert(creditsHistory)
      .values(historyData);

    console.log(`✅ Added ${creditsAmount} credits to user ${userId}. New balance: ${newCredits}`);
    return newCredits;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to add credits to user',
      'addCreditsToUser',
      error
    );
  }
}

/**
 * Gets user's current payment status and subscription information
 * Now supports grace period for canceled subscriptions
 *
 * @param userId - User ID to get payment status for
 * @returns Promise<PaymentRecord | null> - Valid payment record or null if none found
 * @throws {CreemOperationError} When operation fails
 */
export async function getUserPaymentStatus(
  userId: string
): Promise<PaymentRecord | null> {
  try {
    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    const db = await getDb();

    // Get payments that are still within their period (including canceled ones)
    const payments = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.userId, userId),
          // Check if still within valid period
          gte(payment.periodEnd, new Date())
        )
      )
      .orderBy(desc(payment.createdAt));

    if (payments.length === 0) {
      return null;
    }

    // Find the most recent valid subscription
    const validPayment = payments.find(p => {
      // 1. Active or trialing subscriptions are valid
      if (p.status === 'active' || p.status === 'trialing') {
        return true;
      }

      // 2. Canceled subscriptions with grace period are still valid
      if (p.status === 'canceled' && p.cancelAtPeriodEnd) {
        return p.periodEnd && p.periodEnd > new Date();
      }

      return false;
    });

    return validPayment || null;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to get user payment status',
      'getUserPaymentStatus',
      error
    );
  }
}

/**
 * Gets user's active subscription (equivalent to getUserSubscription in old implementation)
 * 
 * @param userId - User ID to get subscription for
 * @returns Promise<PaymentRecord | null> - Active subscription record or null if none found
 * @throws {CreemOperationError} When operation fails
 */
export async function getUserActiveSubscription(
  userId: string
): Promise<PaymentRecord | null> {
  try {
    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    const db = await getDb();

    // Get subscriptions that are still within their period (including canceled ones)
    const subscriptions = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.userId, userId),
          eq(payment.type, PaymentTypes.SUBSCRIPTION),
          // Check if still within valid period
          gte(payment.periodEnd, new Date())
        )
      )
      .orderBy(desc(payment.createdAt));

    if (subscriptions.length === 0) {
      return null;
    }

    // Find the most recent valid subscription
    const validSubscription = subscriptions.find(p => {
      // 1. Active or trialing subscriptions are valid
      if (p.status === 'active' || p.status === 'trialing') {
        return true;
      }

      // 2. Canceled subscriptions with grace period are still valid
      if (p.status === 'canceled' && p.cancelAtPeriodEnd) {
        return p.periodEnd && p.periodEnd > new Date();
      }

      return false;
    });

    return validSubscription || null;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to get user active subscription',
      'getUserActiveSubscription',
      error
    );
  }
}

/**
 * Uses credits from user account with validation
 * 
 * @param tx - Database transaction instance
 * @param userId - User ID to deduct credits from
 * @param creditsAmount - Amount of credits to use (must be positive)
 * @param description - Description of the credit usage
 * @returns Promise<number> - New total credits balance
 * @throws {UserNotFoundError} When user cannot be found
 * @throws {InsufficientCreditsError} When user doesn't have enough credits
 * @throws {CreemOperationError} When operation fails
 */
export async function useUserCredits(
  tx: DbTransaction,
  userId: string,
  creditsAmount: number,
  description: string
): Promise<number> {
  try {
    // Validate input
    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    if (!Number.isInteger(creditsAmount) || creditsAmount <= 0) {
      throw new CreemOperationError(
        `Invalid credits amount: ${creditsAmount}. Must be a positive integer.`,
        'input_validation'
      );
    }

    if (!description?.trim()) {
      throw new CreemOperationError(
        'Description is required for credit usage',
        'input_validation'
      );
    }

    // Get current user credits
    const userRecord = await tx
      .select({ 
        id: user.id, 
        credits: user.credits 
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userRecord.length === 0) {
      throw new UserNotFoundError(userId);
    }

    const currentCredits = userRecord[0].credits || 0;

    // Check if user has enough credits
    if (currentCredits < creditsAmount) {
      throw new InsufficientCreditsError(creditsAmount, currentCredits);
    }

    const newCredits = currentCredits - creditsAmount;

    // Update user credits
    const updateResult = await tx
      .update(user)
      .set({ 
        credits: newCredits,
        updatedAt: new Date()
      } as any)
      .where(eq(user.id, userId))
      .returning({ credits: user.credits });

    if (updateResult.length === 0) {
      throw new CreemOperationError(
        'Failed to update user credits: no rows affected',
        'credits_update'
      );
    }

    // Record transaction in credits history
    const historyData = {
      id: `credits_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId,
      amount: creditsAmount,
      type: 'subtract' as const,
      description: description.trim(),
      createdAt: new Date(),
      metadata: {},
    };

    await tx
      .insert(creditsHistory)
      .values(historyData);

    console.log(`✅ Used ${creditsAmount} credits for user ${userId}. New balance: ${newCredits}`);
    return newCredits;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to use user credits',
      'useUserCredits',
      error
    );
  }
}

/**
 * Gets user's current credits balance
 * 
 * @param userId - User ID to get credits for
 * @returns Promise<number> - Current credits balance
 * @throws {UserNotFoundError} When user cannot be found
 * @throws {CreemOperationError} When operation fails
 */
export async function getUserCredits(
  userId: string
): Promise<number> {
  try {
    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    const db = await getDb();
    
    const userRecord = await db
      .select({ credits: user.credits })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userRecord.length === 0) {
      throw new UserNotFoundError(userId);
    }

    return userRecord[0].credits || 0;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to get user credits',
      'getUserCredits',
      error
    );
  }
}

/**
 * Gets user's credits transaction history
 * 
 * @param userId - User ID to get history for
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Promise<CreditsHistoryRecord[]> - Array of credit transactions
 * @throws {CreemOperationError} When operation fails
 */
export async function getUserCreditsHistory(
  userId: string,
  limit: number = 50
): Promise<CreditsHistoryRecord[]> {
  try {
    if (!userId) {
      throw new CreemOperationError(
        'User ID is required',
        'input_validation'
      );
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      throw new CreemOperationError(
        `Invalid limit: ${limit}. Must be a positive integer between 1 and 1000.`,
        'input_validation'
      );
    }

    const db = await getDb();
    
    const history = await db
      .select()
      .from(creditsHistory)
      .where(eq(creditsHistory.userId, userId))
      .orderBy(desc(creditsHistory.createdAt))
      .limit(limit);

    return history;

  } catch (error) {
    if (error instanceof CreemOperationError) {
      throw error;
    }
    
    throw new CreemOperationError(
      'Failed to get user credits history',
      'getUserCreditsHistory',
      error
    );
  }
}

/**
 * Utility function to validate and sanitize metadata
 */
export function sanitizeMetadata(metadata: unknown): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  
  try {
    // Ensure it's a plain object and remove any functions or undefined values
    return JSON.parse(JSON.stringify(metadata));
  } catch {
    return {};
  }
}

/**
 * Health check function to verify database connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.select().from(user).limit(1);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
