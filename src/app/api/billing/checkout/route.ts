import { sealCheckoutContext } from '@/analytics/checkout-context';
import { isProductionAnalytics } from '@/analytics/core-goals';
import { getDb } from '@/db';
import { billingCheckouts, creditBuckets } from '@/db/schema';
import { billingError, billingSession } from '@/lib/billing/http';
import { OFFERS, isOfferKey, isSellableOffer } from '@/lib/billing/policy';
import { createWaffoCheckout } from '@/payment/provider/waffo';
import { and, eq, sql } from 'drizzle-orm';
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const body = await request.json();
    if (!isSellableOffer(body.offerKey))
      return Response.json({ error: 'Invalid offer' }, { status: 400 });
    const returnUrl = new URL(
      '/settings/billing?payment=return',
      process.env.NEXT_PUBLIC_BASE_URL || request.url
    ).toString();
    return Response.json(
      await createWaffoCheckout(
        owner.id,
        owner.email,
        body.offerKey,
        returnUrl,
        undefined,
        isProductionAnalytics() ? sealCheckoutContext(request.headers) : null
      )
    );
  } catch (error) {
    return billingError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const id = new URL(request.url).searchParams.get('id') || '';
    const db = await getDb();
    const [checkout] = await db
      .select()
      .from(billingCheckouts)
      .where(
        and(eq(billingCheckouts.id, id), eq(billingCheckouts.userId, owner.id))
      );
    if (!checkout)
      return Response.json({ error: 'Checkout not found' }, { status: 404 });
    const [grant] = checkout.orderId
      ? await db
          .select({ id: creditBuckets.id })
          .from(creditBuckets)
          .where(
            and(
              eq(creditBuckets.userId, owner.id),
              sql`(${creditBuckets.paymentId} = ${checkout.orderId} OR split_part(${creditBuckets.paymentId}, ':', 1) = ${checkout.orderId})`
            )
          )
          .limit(1)
      : [];
    return Response.json(
      {
        id,
        state: checkout.state,
        expiresAt: checkout.expiresAt,
        fulfilled: checkout.state === 'paid' && Boolean(grant),
        creditsAdded: isOfferKey(checkout.offerKey)
          ? OFFERS[checkout.offerKey].credits
          : 0,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return billingError(error);
  }
}
