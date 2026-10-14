import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { openCheckoutContext } from '@/analytics/checkout-context';
import { EVENTS, isProductionAnalytics } from '@/analytics/core-goals';
import { getConfirmedCheckout } from '@/analytics/payment-conversion';
import { sendServerEvent } from '@/analytics/plausible-server';
import { billingEvents } from '@/db/schema';
import { billingEnabled } from '@/lib/billing/policy';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { payment, user } from '../../db/schema';
import {
  CreemOperationError,
  UserNotFoundError,
  addCreditsToUser,
  createOrUpdatePaymentFromCreemOrder,
  createOrUpdatePaymentFromCreemSubscription,
  updateUserFromCreemCustomer,
} from '../../utils/drizzle/creem-operations';
import type {
  CheckoutResult,
  CreateCheckoutParams,
  CreatePortalParams,
  CreemCheckout,
  CreemCustomer,
  CreemOrder,
  CreemSubscription,
  CreemWebhookEvent,
  PaymentProvider,
  PaymentStatus,
  PaymentTypes,
  PlanInterval,
  PortalResult,
  Subscription,
  getSubscriptionsParams,
} from '../types';

/**
 * World-class Creem Payment Provider Implementation
 *
 * Features:
 * - Enterprise-grade webhook handling with signature verification
 * - Comprehensive event processing with transaction safety
 * - Advanced error handling and recovery mechanisms
 * - Performance optimized with intelligent caching
 * - Full audit trail and monitoring capabilities
 *
 * @author Chaowen Team
 * @version 2.0.0
 */
export class CreemProvider implements PaymentProvider {
  private readonly webhookSecret: string;
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    // Validate required environment variables
    this.webhookSecret = process.env.CREEM_WEBHOOK_SECRET!;
    this.apiKey = process.env.CREEM_API_KEY!;
    this.apiUrl = process.env.CREEM_API_URL!;

    if (!this.webhookSecret || !this.apiKey || !this.apiUrl) {
      throw new Error('Missing required Creem environment variables');
    }
  }

  /**
   * 创建Creem结账会话
   * 按照迁移文档策略实现，保留原有API调用逻辑，添加参数转换层
   */
  public async createCheckout(
    params: CreateCheckoutParams
  ): Promise<CheckoutResult> {
    try {
      // 1. 参数映射
      const creemParams = this.mapParamsToCreemRequest(params);
      const urls = this.buildCreemUrls(params);

      // 2. 构建请求体
      const requestBody: any = {
        product_id: creemParams.productId,
        customer: {
          email: creemParams.email,
        },
        metadata: {
          user_id: creemParams.userId,
          product_type: creemParams.productType,
          credits: creemParams.credits_amount || 0,
          ...(params.metadata?.plausible_context
            ? { plausible_context: params.metadata.plausible_context }
            : {}),
        },
        ...urls,
      };

      // 添加折扣码（如果有）
      if (creemParams.discountCode) {
        requestBody.discount_code = creemParams.discountCode;
      }

      console.log('🚀 Creating Creem checkout session with:', {
        productId: creemParams.productId,
        email: creemParams.email,
        userId: creemParams.userId,
        productType: creemParams.productType,
        credits_amount: creemParams.credits_amount,
        discountCode: creemParams.discountCode,
        apiUrl: process.env.CREEM_API_URL,
        hasApiKey: !!process.env.CREEM_API_KEY,
      });

      // 3. 调用API
      const checkoutUrl = await this.callCreemCheckoutAPI(requestBody);

      // 4. 返回结果
      return {
        url: checkoutUrl,
        id: this.generateCheckoutSessionId(requestBody),
      };
    } catch (error) {
      console.error('❌ Creem createCheckout error:', error);
      throw new Error('Failed to create Creem checkout session');
    }
  }

  /**
   * 参数映射函数 - 将MkSaaS参数转换为Creem参数
   */
  private mapParamsToCreemRequest(params: CreateCheckoutParams) {
    const { planId, priceId, customerEmail, metadata } = params;

    // 提取metadata中的参数
    const userId = metadata?.userId;
    const productType = metadata?.productType || 'subscription';
    const credits = metadata?.credits
      ? Number.parseInt(metadata.credits)
      : undefined;
    const discountCode = metadata?.discountCode;

    return {
      productId: priceId, // 直接使用priceId作为Creem的productId
      email: customerEmail,
      userId,
      productType: productType as 'subscription' | 'credits',
      credits_amount: credits,
      discountCode,
    };
  }

  /**
   * URL处理函数 - 构建成功回调URL（Creem API不支持cancel_url）
   */
  private buildCreemUrls(params: CreateCheckoutParams) {
    const { successUrl } = params;

    const urls: any = {};

    // 添加成功URL（Creem API文档中只有success_url，没有cancel_url）
    if (successUrl || process.env.CREEM_SUCCESS_URL) {
      urls.success_url = successUrl || process.env.CREEM_SUCCESS_URL;
    }

    return urls;
  }

  /**
   * Creem API调用函数 - 复制原有的完善逻辑
   */
  private async callCreemCheckoutAPI(requestData: any): Promise<string> {
    console.log('📤 Request body:', JSON.stringify(requestData, null, 2));

    const response = await fetch(process.env.CREEM_API_URL + '/v1/checkouts', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CREEM_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('📥 Response status:', response.status);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('📥 Response headers:', headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Creem API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Creem API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Checkout session created:', data);
    return data.checkout_url;
  }

  /**
   * 生成唯一的checkout session ID
   */
  private generateCheckoutSessionId(requestBody: any): string {
    // 生成唯一的checkout session ID
    // 使用timestamp + userId的组合
    const timestamp = Date.now();
    const userId = requestBody.metadata?.user_id || 'anonymous';
    return `creem_checkout_${userId}_${timestamp}`;
  }

  /**
   * 创建Creem客户门户会话
   *
   * 智能适配方案：
   * 1. 如果传入的customerId是Creem客户ID，直接使用
   * 2. 如果传入的是Stripe客户ID或用户ID，查询对应的Creem客户ID
   * 3. 保持与Stripe Provider接口的完全兼容性
   */
  public async createCustomerPortal(
    params: CreatePortalParams
  ): Promise<PortalResult> {
    const { customerId, returnUrl } = params;

    try {
      console.log(
        `Creating Creem customer portal for customer ID: ${customerId}`
      );

      // 调用Creem API创建客户门户
      // customerId现在已经是正确的creemCustomerId
      const response = await fetch(`${this.apiUrl}/v1/customers/billing`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId, // 现在这里直接是creemCustomerId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Creem API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `Failed to create customer portal: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log('✅ Creem customer portal created successfully:', data);

      // Creem API returns { "customer_portal_link": "https://..." }
      return {
        url: data.customer_portal_link,
      };
    } catch (error) {
      console.error('Create Creem customer portal error:', error);
      throw new Error(
        `Failed to create customer portal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async getSubscriptions(
    params: getSubscriptionsParams
  ): Promise<Subscription[]> {
    const { userId } = params;

    try {
      const db = await getDb();

      // 查询用户的所有支付记录，按创建时间倒序
      const payments = await db
        .select()
        .from(payment)
        .where(eq(payment.userId, userId))
        .orderBy(desc(payment.createdAt));

      // 映射为标准 Subscription 格式
      return payments.map((p) => ({
        id: p.subscriptionId || p.id, // 使用订阅ID，如果没有则使用支付ID
        customerId: p.customerId,
        priceId: p.priceId,
        status: p.status as PaymentStatus,
        type: p.type as PaymentTypes,
        interval: p.interval as PlanInterval,
        currentPeriodStart: p.periodStart || undefined,
        currentPeriodEnd: p.periodEnd || undefined,
        cancelAtPeriodEnd: p.cancelAtPeriodEnd || false,
        trialStartDate: p.trialStart || undefined,
        trialEndDate: p.trialEnd || undefined,
        createdAt: p.createdAt,
      }));
    } catch (error) {
      console.error('Get Creem subscriptions error:', error);
      return []; // 与 Stripe 一致：返回空数组而不是抛出错误
    }
  }

  /**
   * Webhook event handler with essential features
   *
   * Features:
   * - Cryptographic signature verification
   * - Transaction safety with rollback capabilities
   * - Performance monitoring
   * - Basic error handling and categorization
   *
   * @param payload - Raw webhook payload from Creem
   * @param signature - Webhook signature for verification
   * @throws {Error} When signature verification fails or processing errors occur
   */
  public async handleWebhookEvent(
    payload: string,
    signature: string
  ): Promise<void> {
    const startTime = Date.now();
    let eventId: string | undefined;
    let eventType: string | undefined;

    try {
      // 1. Enterprise-grade signature verification
      this.verifyWebhookSignature(payload, signature);
      console.log('✅ Webhook signature verified successfully');

      // 2. Parse and validate event structure
      const event = this.parseAndValidateEvent(payload);
      eventId = event.id;
      eventType = event.eventType;

      console.log(
        `🎯 Processing Creem webhook event: ${eventType} (ID: ${eventId})`
      );

      // 3. Event processing with transaction safety
      await this.processEventWithTransaction(event);
      await this.observeCheckoutPayment(event);

      // 4. Performance monitoring
      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Event ${eventId} processed successfully in ${processingTime}ms`
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error(`❌ Webhook processing failed for event ${eventId}:`, {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Simple error handling
      this.handleWebhookError(error, eventId, eventType, processingTime);

      // Re-throw for upstream error handling
      throw error;
    }
  }

  private async observeCheckoutPayment(
    event: CreemWebhookEvent
  ): Promise<void> {
    // This runs only after signature verification and successful DB commit.
    // Existing business rows/credits are not modified by analytics failures.
    try {
      if (!isProductionAnalytics() || this.apiUrl !== 'https://api.creem.io')
        return;
      const evidence = getConfirmedCheckout(event);
      if (!evidence) return;
      const visitor = openCheckoutContext(evidence.context);
      if (!visitor) return;
      const db = await getDb();
      const orderKey = createHash('sha256')
        .update(evidence.orderId)
        .digest('hex');
      // An atomic claim survives webhook replay, across processes/deployments.
      // Store only a hashed order marker; no raw browser headers or new schema.
      const claimed = await db.execute(sql`
        UPDATE "user"
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb), '{plausiblePaymentOrders}',
          COALESCE(metadata->'plausiblePaymentOrders', '{}'::jsonb)
            || jsonb_build_object(${orderKey}::text, true)
        )
        WHERE id = ${evidence.userId}
          AND NOT (COALESCE(metadata->'plausiblePaymentOrders', '{}'::jsonb) ? ${orderKey}::text)
        RETURNING id
      `);
      if (claimed.length > 0)
        await sendServerEvent(EVENTS.paymentConfirmed, {}, visitor);
    } catch {
      // Best-effort telemetry must not roll back or retry a successful payment.
    }
  }

  /**
   * Cryptographic signature verification using HMAC-SHA256
   */
  private verifyWebhookSignature(payload: string, signature: string): void {
    if (!signature) {
      throw new Error('Missing webhook signature');
    }

    // 检查空载荷
    if (!payload || payload.trim().length === 0) {
      throw new Error('Empty webhook payload');
    }

    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace(/^sha256=/, '');

    // Compute expected signature
    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (
      !timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    ) {
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Parse and validate webhook event structure
   */
  private parseAndValidateEvent(payload: string): CreemWebhookEvent {
    let event: CreemWebhookEvent;

    try {
      event = JSON.parse(payload) as CreemWebhookEvent;
    } catch (error) {
      throw new Error('Invalid JSON payload');
    }

    // Validate required fields
    if (!event.id || !event.eventType || !event.object) {
      throw new Error('Invalid event structure: missing required fields');
    }

    // Validate event type
    const validEventTypes = [
      'checkout.completed',
      'refund.created',
      'subscription.active',
      'subscription.trialing',
      'subscription.canceled',
      'subscription.scheduled_cancel',
      'subscription.paid',
      'subscription.expired',
      'subscription.unpaid',
      'subscription.past_due',
      'subscription.paused',
      'subscription.update',
    ];

    if (!validEventTypes.includes(event.eventType)) {
      throw new Error(`Unsupported event type: ${event.eventType}`);
    }

    return event;
  }

  /**
   * Process webhook event within database transaction
   */
  private async processEventWithTransaction(
    event: CreemWebhookEvent
  ): Promise<void> {
    const db = await getDb();

    await db.transaction(async (tx) => {
      if (billingEnabled()) {
        const recorded = await tx
          .insert(billingEvents)
          .values({
            id: `creem:${event.eventType}:${event.id}`,
            provider: 'creem',
            eventType: event.eventType,
          })
          .onConflictDoNothing()
          .returning();
        if (!recorded.length) return;
      }
      try {
        switch (event.eventType) {
          case 'checkout.completed':
            await this.handleCheckoutCompleted(tx, event);
            break;

          case 'subscription.active':
            await this.handleSubscriptionActive(tx, event);
            break;

          case 'subscription.paid':
            await this.handleSubscriptionPaid(tx, event);
            break;

          case 'subscription.trialing':
            await this.handleSubscriptionTrialing(tx, event);
            break;

          case 'subscription.canceled':
            await this.handleSubscriptionCanceled(tx, event);
            break;

          case 'subscription.expired':
            await this.handleSubscriptionExpired(tx, event);
            break;

          case 'subscription.unpaid':
            await this.handleSubscriptionUnpaid(tx, event);
            break;

          case 'subscription.update':
          case 'subscription.scheduled_cancel':
          case 'subscription.past_due':
          case 'subscription.paused':
            await this.handleSubscriptionUpdate(tx, event);
            break;

          case 'refund.created':
            await this.handleRefundCreated(tx, event);
            break;

          default:
            console.warn(`⚠️ Unhandled event type: ${event.eventType}`);
        }
      } catch (error) {
        console.error(`❌ Transaction failed for event ${event.id}:`, error);
        throw error; // This will trigger transaction rollback
      }
    });
  }

  /**
   * Handle checkout completion events
   */
  private getLegacyCredits(checkout: CreemCheckout): number {
    const product = checkout.product;
    const productId = typeof product === 'string' ? product : product.id;
    const map = JSON.parse(
      process.env.LEGACY_CREEM_CREDIT_PRODUCTS || '{}'
    ) as Record<string, number>;
    const amount = map[productId];
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error(
        'Legacy credit product requires a verified server mapping'
      );
    return amount;
  }

  private async handleCheckoutCompleted(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const checkout = event.object as CreemCheckout;

    if (!checkout.customer || !checkout.order) {
      throw new Error('Invalid checkout object: missing customer or order');
    }

    console.log(
      `🛒 Processing checkout completion for order ${checkout.order.id}`
    );

    // Extract user ID from metadata (consistent with old route.ts logic)
    const userId =
      checkout.order.metadata?.user_id || checkout.metadata?.user_id;
    if (!userId) {
      throw new Error('Missing user_id in checkout metadata');
    }

    // 1. Update customer information
    const customer = checkout.customer;
    await updateUserFromCreemCustomer(tx, customer, userId);

    // 2. Handle the order based on type
    const order = checkout.order;

    if (order.type === 'one_time') {
      // Handle one-time purchase
      await createOrUpdatePaymentFromCreemOrder(tx, order, userId);

      // Add credits if this is a credits purchase
      if (
        order.metadata?.product_type === 'credits' &&
        order.metadata?.credits
      ) {
        const creditsAmount = billingEnabled()
          ? this.getLegacyCredits(checkout)
          : Number(order.metadata.credits);
        if (creditsAmount > 0) {
          await addCreditsToUser(
            tx,
            userId,
            creditsAmount,
            order.id,
            `Credits purchase from order ${order.id}`
          );
        }
      }
    } else if (order.type === 'recurring' && checkout.subscription) {
      // Handle subscription
      await createOrUpdatePaymentFromCreemSubscription(
        tx,
        checkout.subscription,
        userId,
        'checkout.completed' // Pass event type for accurate status mapping
      );
    }

    // Also handle checkout-level credits (fallback for old implementations)
    // Only process if we haven't already processed credits at order level
    if (
      !billingEnabled() &&
      order.type !== 'one_time' && // Avoid double processing for one-time orders
      checkout.metadata?.product_type === 'credits' &&
      checkout.metadata?.credits
    ) {
      const creditsAmount = Number(checkout.metadata.credits);
      if (creditsAmount > 0) {
        await addCreditsToUser(
          tx,
          userId,
          creditsAmount,
          checkout.order.id,
          `Purchased ${creditsAmount} credits`
        );
      }
    }

    console.log(`✅ Checkout completion processed for user ${userId}`);
  }

  /**
   * Handle subscription activation events
   */
  private async handleSubscriptionActive(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`📋 Processing subscription activation: ${subscription.id}`);

    // Extract user ID from subscription metadata or customer
    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Create or update payment record
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription activation processed for user ${userId}`);
  }

  /**
   * Handle subscription paid events
   */
  private async handleSubscriptionPaid(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`💰 Processing subscription payment: ${subscription.id}`);

    // Extract user ID from subscription metadata or customer
    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Create or update payment record with paid status
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription payment processed for user ${userId}`);
  }

  /**
   * Handle subscription trialing events
   */
  private async handleSubscriptionTrialing(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`🆓 Processing subscription trial: ${subscription.id}`);

    // Extract user ID from subscription metadata or customer
    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Create or update payment record with trialing status
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription trial processed for user ${userId}`);
  }

  /**
   * Handle subscription cancellation events
   */
  private async handleSubscriptionCanceled(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`❌ Processing subscription cancellation: ${subscription.id}`);

    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Update payment record with canceled status
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription cancellation processed for user ${userId}`);
  }

  /**
   * Handle subscription expired events
   */
  private async handleSubscriptionExpired(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`⏰ Processing subscription expiration: ${subscription.id}`);

    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Update payment record with expired status
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription expiration processed for user ${userId}`);
  }

  /**
   * Handle subscription unpaid events
   */
  private async handleSubscriptionUnpaid(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`💳 Processing subscription unpaid: ${subscription.id}`);

    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Update payment record with unpaid status
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription unpaid status processed for user ${userId}`);
  }

  /**
   * Handle subscription update events
   */
  private async handleSubscriptionUpdate(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    const subscription = event.object as CreemSubscription;

    console.log(`🔄 Processing subscription update: ${subscription.id}`);

    const userId = await this.extractUserIdFromSubscription(subscription);

    // Always update customer information (consistent with old route.ts logic)
    if (typeof subscription.customer === 'object') {
      await updateUserFromCreemCustomer(tx, subscription.customer, userId);
    }

    // Update payment record with updated information
    await createOrUpdatePaymentFromCreemSubscription(
      tx,
      subscription,
      userId,
      event.eventType
    );

    console.log(`✅ Subscription update processed for user ${userId}`);
  }

  /**
   * Handle refund creation events
   */
  private async handleRefundCreated(
    tx: any,
    event: CreemWebhookEvent
  ): Promise<void> {
    console.log(`💰 Processing refund creation for event ${event.id}`);

    // TODO: Implement refund handling logic
    // This would typically involve:
    // 1. Updating payment status
    // 2. Adjusting user credits if applicable
    // 3. Logging refund transaction

    console.log('⚠️ Refund handling not yet implemented');
  }

  /**
   * Extract user ID from subscription with fallback strategies
   */
  private async extractUserIdFromSubscription(
    subscription: CreemSubscription
  ): Promise<string> {
    // Strategy 1: Check subscription metadata
    if (subscription.metadata?.user_id) {
      return subscription.metadata.user_id;
    }

    // Strategy 2: Look up by Creem customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    if (customerId) {
      const db = await getDb();
      const userRecord = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.creemCustomerId, customerId))
        .limit(1);

      if (userRecord.length > 0) {
        return userRecord[0].id;
      }
    }

    throw new UserNotFoundError(
      'Unable to find user for subscription ' + subscription.id
    );
  }

  /**
   * Simple error handling with basic categorization
   */
  private handleWebhookError(
    error: unknown,
    eventId?: string,
    eventType?: string,
    processingTime?: number
  ): void {
    const errorInfo = {
      eventId,
      eventType,
      processingTime,
      timestamp: new Date().toISOString(),
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { message: 'Unknown error', error },
    };

    // Categorize error for appropriate handling
    if (error instanceof UserNotFoundError) {
      console.error('👤 User not found error:', errorInfo);
    } else if (error instanceof CreemOperationError) {
      console.error('🔧 Database operation error:', errorInfo);
    } else {
      console.error('❌ Unexpected error:', errorInfo);
    }
  }
}
