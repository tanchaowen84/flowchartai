/** Waffo new-sale adapter; legacy Creem routing stays independent. */
import { waffoInsightsFact } from '@/analytics/insights-payment';
import { createHash, randomUUID } from 'node:crypto';
import { openCheckoutContext } from '@/analytics/checkout-context';
import { EVENTS, isProductionAnalytics } from '@/analytics/core-goals';
import { getWaffoConfirmedCheckout } from '@/analytics/payment-conversion';
import { sendServerEvent } from '@/analytics/plausible-server';
import { getDb } from '@/db';
import {
  billingCheckouts,
  billingEvents,
  billingSubscriptions,
  creditBuckets,
  creditsHistory,
  payment,
  user,
} from '@/db/schema';
import {
  OFFERS,
  type OfferKey,
  billingEnabled,
  hasPaidAccess,
  isOfferKey,
} from '@/lib/billing/policy';
import {
  BillingError,
  getLegacyEntitlement,
  grantBucket,
  lockWallet,
  refreshWallet,
} from '@/lib/billing/wallet';
import {
  ChangeTiming,
  WaffoPancake,
  type WebhookEvent,
  type WebhookEventData,
  verifyWebhook,
} from '@waffo/pancake-ts';
import { and, eq, gt, sql } from 'drizzle-orm';
export function waffoEnvironment(): 'test' | 'prod' {
  const env = process.env.WAFFO_ENVIRONMENT;
  if (env !== 'test' && env !== 'prod')
    throw new Error('Set WAFFO_ENVIRONMENT to test or prod');
  return env;
}
export function waffoProduct(key: OfferKey): string {
  const value =
    process.env[
      `WAFFO_${waffoEnvironment().toUpperCase()}_PRODUCT_${key.toUpperCase()}`
    ];
  if (!value)
    throw new BillingError(
      'offer_unavailable',
      'This offer is not available yet',
      503
    );
  return value;
}
export function waffoClient(): WaffoPancake {
  if (!process.env.WAFFO_MERCHANT_ID || !process.env.WAFFO_PRIVATE_KEY)
    throw new BillingError(
      'payment_unavailable',
      'Payments are not configured yet',
      503
    );
  return new WaffoPancake({
    merchantId: process.env.WAFFO_MERCHANT_ID,
    privateKey: process.env.WAFFO_PRIVATE_KEY,
    environment: waffoEnvironment(),
  });
}
export async function createWaffoCheckout(
  userId: string,
  email: string,
  key: OfferKey,
  returnUrl: string,
  client = waffoClient(),
  plausibleContext: string | null = null
): Promise<{ url: string; id: string }> {
  if (!billingEnabled())
    throw new BillingError(
      'billing_disabled',
      'New billing is not enabled',
      503
    );
  const db = await getDb();
  const offer = OFFERS[key];
  let id: string = randomUUID();
  const productId = waffoProduct(key);
  const origin = await db.transaction(async (tx) => {
    await lockWallet(tx, userId);
    if (
      offer.kind === 'subscription' &&
      (await getLegacyEntitlement(tx, userId))
    )
      throw new BillingError(
        'legacy_subscription',
        'Your original subscription is still active. Manage it before switching; you can buy credit packs anytime.'
      );
    const [active] = await tx
      .select()
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.userId, userId),
          gt(billingSubscriptions.paidThrough, new Date()),
          sql`${billingSubscriptions.status} in ('active','canceling','canceled','past_due')`
        )
      );
    if (offer.kind === 'subscription' && active?.offerKey === key)
      throw new BillingError(
        'already_subscribed',
        'This subscription is already active'
      );
    const [pending] = await tx
      .select()
      .from(billingCheckouts)
      .where(
        and(
          eq(billingCheckouts.userId, userId),
          eq(billingCheckouts.environment, waffoEnvironment()),
          eq(billingCheckouts.state, 'pending'),
          gt(billingCheckouts.expiresAt, new Date()),
          offer.kind === 'subscription'
            ? sql`${billingCheckouts.offerKey} in ('starter_month','starter_year','pro_month','pro_year','starter_year_202610','pro_year_202610')`
            : eq(billingCheckouts.offerKey, key)
        )
      );
    if (pending) {
      if (pending.offerKey !== key)
        throw new BillingError(
          'checkout_open',
          'A subscription checkout is already open. Finish it before choosing another plan.',
          409,
          { resumeUrl: pending.checkoutUrl, checkoutId: pending.id }
        );
      id = pending.id;
      if (pending.checkoutUrl) return { existing: pending, subscription: null };
      return {
        existing: null,
        subscription: offer.kind === 'subscription' ? active : null,
      };
    }
    await tx.insert(billingCheckouts).values({
      id,
      userId,
      offerKey: key,
      environment: waffoEnvironment(),
      expiresAt: new Date(Date.now() + 11 * 60000),
    });
    return {
      existing: null,
      subscription: offer.kind === 'subscription' ? active : null,
    };
  });
  if (origin.existing?.checkoutUrl)
    return { url: origin.existing.checkoutUrl, id: origin.existing.id };
  const subscription = origin.subscription;
  const params = {
    productId,
    currency: 'USD',
    expiresInSeconds: 600,
    buyerIdentity: userId,
    buyerEmail: email,
    successUrl: `${returnUrl}&checkout=${id}`,
    orderMerchantExternalId: id,
    metadata: {
      offerKey: key,
      userId,
      checkoutId: id,
      ...(plausibleContext ? { plausible_context: plausibleContext } : {}),
      ...(subscription ? { originOrderId: subscription.id } : {}),
    },
    withTrial: false,
  };
  const result = subscription
    ? await client.checkout.authenticated.createPlanChange(
        {
          ...params,
          originOrderId: subscription.id,
          changeTiming: ChangeTiming.NextPeriod,
        },
        { idempotencyKey: `checkout-${id}` }
      )
    : await client.checkout.authenticated.create(params, {
        idempotencyKey: `checkout-${id}`,
      });
  await db
    .update(billingCheckouts)
    .set({ sessionId: result.sessionId, checkoutUrl: result.checkoutUrl })
    .where(eq(billingCheckouts.id, id));
  return { url: result.checkoutUrl, id };
}
function date(value: unknown): Date {
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime()))
    throw new Error('Missing trusted subscription date');
  return new Date(value);
}
export function verifyWaffoEvent(raw: string, signature: string): WebhookEvent {
  const env = waffoEnvironment();
  const event = verifyWebhook<WebhookEventData>(raw, signature, {
    environment: env,
  });
  if (
    event.mode !== env ||
    !process.env.WAFFO_STORE_ID ||
    event.storeId !== process.env.WAFFO_STORE_ID
  )
    throw new Error('Wrong Waffo store or environment');
  return event;
}
// Only verified SDK events may reach this function. Exported to test transactional fulfillment with fixtures.
export async function processWaffoEvent(event: WebhookEvent): Promise<void> {
  const data = event.data;
  const db = await getDb();
  if (
    event.mode !== waffoEnvironment() ||
    event.storeId !== process.env.WAFFO_STORE_ID
  )
    throw new Error('Wrong Waffo store or environment');
  const handled = [
    'order.completed',
    'subscription.activated',
    'subscription.payment_succeeded',
    'subscription.renewed',
    'subscription.recovered',
    'subscription.canceling',
    'subscription.uncanceled',
    'subscription.canceled',
    'subscription.past_due',
    'subscription.plan_changed',
    'subscription.plan_change_scheduled',
    'subscription.plan_change_failed',
    'refund.succeeded',
    'refund.failed',
  ];
  if (!handled.includes(event.eventType)) return;
  await db.transaction(async (tx) => {
    const [checkout] = await tx
      .select()
      .from(billingCheckouts)
      .where(
        data.orderMerchantExternalId
          ? eq(billingCheckouts.id, data.orderMerchantExternalId)
          : eq(billingCheckouts.orderId, data.orderId)
      );
    if (!checkout || checkout.environment !== event.mode)
      throw new Error('No matching server checkout');
    if (
      data.merchantProvidedBuyerIdentity &&
      data.merchantProvidedBuyerIdentity !== checkout.userId
    )
      throw new Error('Buyer identity mismatch');
    if (
      !isOfferKey(checkout.offerKey) ||
      data.orderMetadata?.offerKey !== checkout.offerKey
    )
      throw new Error('Offer mismatch');
    await lockWallet(tx, checkout.userId);
    const id = `waffo:${event.eventType}:${event.id}`;
    const inserted = await tx
      .insert(billingEvents)
      .values({
        id,
        provider: 'waffo',
        eventType: event.eventType,
        orderId: data.orderId,
        paymentId: data.paymentId,
        metadata: {
          insights: waffoInsightsFact(event),
          periodNumber: data.periodNumber,
          periodStart: data.currentPeriodStart,
          periodEnd: data.currentPeriodEnd,
          paidAt: event.timestamp,
          amount: data.chargedAmount || data.amount,
        },
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return;
    if (checkout.orderId && checkout.orderId !== data.orderId)
      throw new Error('Order mismatch');
    await tx
      .update(billingCheckouts)
      .set({ orderId: data.orderId })
      .where(eq(billingCheckouts.id, checkout.id));
    const offer = OFFERS[checkout.offerKey];
    if (event.eventType === 'subscription.plan_change_failed') {
      await tx
        .update(billingCheckouts)
        .set({ state: 'failed' })
        .where(eq(billingCheckouts.id, checkout.id));
      return;
    }
    if (event.eventType === 'refund.failed') return;
    if (event.eventType === 'refund.succeeded') {
      await refreshWallet(tx, checkout.userId);
      // Provider-confirmed refund only revokes the matched order, never another credit source.
      const charges = await tx
        .select()
        .from(billingEvents)
        .where(
          and(
            eq(billingEvents.paymentId, data.paymentId || ''),
            sql`${billingEvents.eventType} in ('order.completed','subscription.payment_succeeded')`
          )
        );
      const original = Number(
        data.originalChargedAmount || (charges[0]?.metadata as any)?.amount
      );
      const refunded = Number(data.refundedAmount || data.amount);
      if (!Number.isFinite(original) || original <= 0 || refunded !== original)
        throw new Error(
          'Partial or uncorrelated refund requires source-specific reconciliation'
        );
      let purchaseKey = data.orderId;
      if (OFFERS[checkout.offerKey].kind === 'subscription') {
        const events = await tx
          .select()
          .from(billingEvents)
          .where(
            and(
              eq(billingEvents.orderId, data.orderId),
              sql`${billingEvents.eventType} in ('subscription.activated','subscription.renewed','subscription.recovered','subscription.plan_changed')`
            )
          );
        if (data.periodNumber === undefined && events.length !== 1)
          throw new Error('Refund period needs manual correlation');
        const cycle = events.find(
          (e) =>
            (e.metadata as any).periodNumber === data.periodNumber &&
            (e.metadata as any).periodStart
        );
        if (!cycle) throw new Error('Refund cycle has not been correlated');
        purchaseKey = `${data.orderId}:${date((cycle.metadata as any).periodStart).toISOString()}`;
      }
      const buckets = await tx
        .select()
        .from(creditBuckets)
        .where(eq(creditBuckets.paymentId, purchaseKey));
      for (const b of buckets) {
        if (b.reserved)
          throw new Error('Refund has an active task; retry after it finishes');
        if (b.remaining) {
          await tx
            .update(creditBuckets)
            .set({ remaining: 0 })
            .where(eq(creditBuckets.id, b.id));
          await tx
            .update(user)
            .set({ credits: sql`${user.credits}-${b.remaining}` })
            .where(eq(user.id, checkout.userId));
          await tx.insert(creditsHistory).values({
            id: randomUUID(),
            userId: checkout.userId,
            amount: b.remaining,
            type: 'subtract',
            description: 'Refunded purchase',
            metadata: { billingV1: true, eventId: id, bucketId: b.id },
          });
        }
      }
      const [current] = await tx
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, data.orderId));
      if (
        current &&
        purchaseKey === `${data.orderId}:${current.anchor.toISOString()}`
      ) {
        await tx
          .update(billingSubscriptions)
          .set({ status: 'refunded', paidThrough: new Date() })
          .where(eq(billingSubscriptions.id, data.orderId));
        await tx
          .update(payment)
          .set({ status: 'failed', periodEnd: new Date() })
          .where(
            and(
              eq(payment.provider, 'waffo'),
              eq(payment.subscriptionId, data.orderId)
            )
          );
      }
      await tx
        .update(billingCheckouts)
        .set({ state: 'refunded' })
        .where(eq(billingCheckouts.id, checkout.id));
      return;
    }
    if (data.currency !== 'USD') throw new Error('Unexpected currency');
    if (event.eventType === 'order.completed') {
      if (offer.kind !== 'pack' || data.paymentStatus !== 'succeeded')
        throw new Error('Unconfirmed credit-pack payment');
      const prices = [
        data.listPrice?.subtotal,
        data.listPrice?.total,
        data.subtotal,
        data.amount,
      ].filter((v) => v !== undefined);
      if (!prices.some((v) => Math.round(Number(v) * 100) === offer.amount))
        throw new Error('Purchase amount mismatch');
      await grantBucket(tx, {
        userId: checkout.userId,
        amount: offer.credits,
        source: 'pack',
        sourceKey: `waffo:order:${data.orderId}`,
        paymentId: data.orderId,
      });
      await tx
        .update(billingCheckouts)
        .set({ state: 'paid' })
        .where(eq(billingCheckouts.id, checkout.id));
      return;
    }
    if (offer.kind !== 'subscription')
      throw new Error('Expected subscription offer');
    if (event.eventType === 'subscription.payment_succeeded') {
      // A charge receipt carries NO period/status. The signed activated/renewed/recovered event owns access.
      if (data.paymentStatus !== 'succeeded')
        throw new Error('Payment was not successful');
      return;
    }
    if (event.eventType === 'subscription.plan_change_scheduled') {
      await tx
        .update(billingCheckouts)
        .set({ state: 'scheduled' })
        .where(eq(billingCheckouts.id, checkout.id));
      return;
    }
    const occurredAt = date(event.timestamp);
    const [prior] = await tx
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.id, data.orderId));
    if (prior && occurredAt < prior.eventAt) return;
    const startsPaidPeriod = [
      'subscription.activated',
      'subscription.renewed',
      'subscription.recovered',
      'subscription.plan_changed',
    ].includes(event.eventType);
    if (!startsPaidPeriod && !prior)
      throw new Error('Subscription activation has not arrived');
    const start = startsPaidPeriod
      ? date(data.currentPeriodStart)
      : prior.anchor;
    const end = startsPaidPeriod
      ? date(data.currentPeriodEnd)
      : prior.paidThrough;
    if (end <= start) throw new Error('Invalid subscription period');
    if (startsPaidPeriod) {
      const prices = [
        data.planPrice?.subtotal,
        data.planPrice?.total,
        data.subtotal,
        data.amount,
      ].filter((v) => v !== undefined);
      if (!prices.some((v) => Math.round(Number(v) * 100) === offer.amount))
        throw new Error('Subscription price mismatch');
      const expected = offer.interval === 'year' ? 'yearly' : 'monthly';
      if (data.billingPeriod !== expected)
        throw new Error('Subscription interval mismatch');
    }
    const status =
      event.eventType === 'subscription.canceling'
        ? 'canceling'
        : event.eventType === 'subscription.canceled'
          ? 'canceled'
          : event.eventType === 'subscription.past_due'
            ? 'past_due'
            : 'active';
    const cancelAtPeriodEnd = ['canceling', 'canceled'].includes(status);
    const anchor =
      prior?.anchor && prior.paidThrough > start ? prior.anchor : start;
    await tx
      .insert(billingSubscriptions)
      .values({
        id: data.orderId,
        userId: checkout.userId,
        offerKey: checkout.offerKey,
        status,
        anchor,
        paidThrough: end,
        cancelAtPeriodEnd,
        eventAt: occurredAt,
      })
      .onConflictDoUpdate({
        target: billingSubscriptions.id,
        set: {
          status,
          anchor,
          paidThrough: end,
          cancelAtPeriodEnd,
          eventAt: occurredAt,
          updatedAt: new Date(),
        },
      });
    await tx
      .insert(payment)
      .values({
        id: `waffo:${data.orderId}`,
        provider: 'waffo',
        offerKey: checkout.offerKey,
        priceId: checkout.offerKey,
        type: 'subscription',
        interval: offer.interval,
        userId: checkout.userId,
        customerId: checkout.userId,
        subscriptionId: data.orderId,
        status: cancelAtPeriodEnd ? 'canceled' : status,
        periodStart: anchor,
        periodEnd: end,
        cancelAtPeriodEnd,
      })
      .onConflictDoUpdate({
        target: payment.id,
        set: {
          status: cancelAtPeriodEnd ? 'canceled' : status,
          periodStart: anchor,
          periodEnd: end,
          cancelAtPeriodEnd,
          updatedAt: new Date(),
        },
      });
    if (event.eventType === 'subscription.plan_changed') {
      const origin = data.orderMetadata?.originOrderId;
      if (!origin) throw new Error('Plan change is missing its server origin');
      await tx
        .update(billingSubscriptions)
        .set({ status: 'replaced', paidThrough: start })
        .where(
          and(
            eq(billingSubscriptions.id, origin),
            eq(billingSubscriptions.userId, checkout.userId)
          )
        );
      await tx
        .update(payment)
        .set({ status: 'canceled', periodEnd: start, cancelAtPeriodEnd: true })
        .where(
          and(
            eq(payment.subscriptionId, origin),
            eq(payment.userId, checkout.userId),
            eq(payment.provider, 'waffo')
          )
        );
    }
    if (startsPaidPeriod)
      await tx
        .update(billingCheckouts)
        .set({ state: 'paid' })
        .where(eq(billingCheckouts.id, checkout.id));
    await refreshWallet(tx, checkout.userId);
  });
  await observeWaffoCheckoutPayment(event);
}

async function observeWaffoCheckoutPayment(event: WebhookEvent): Promise<void> {
  // Financial fulfillment has committed. Analytics cannot fail a payment.
  try {
    if (!isProductionAnalytics()) return;
    const evidence = getWaffoConfirmedCheckout(event);
    if (!evidence) return;
    const visitor = openCheckoutContext(evidence.context);
    if (!visitor) return;
    const orderKey = createHash('sha256')
      .update(`waffo:${evidence.orderId}`)
      .digest('hex');
    const db = await getDb();
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
  } catch {}
}
