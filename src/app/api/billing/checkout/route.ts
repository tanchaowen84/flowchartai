import { billingError, billingSession } from '@/lib/billing/http';
import { isOfferKey } from '@/lib/billing/policy';
import { createWaffoCheckout } from '@/payment/provider/waffo';
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const body = await request.json();
    if (!isOfferKey(body.offerKey))
      return Response.json({ error: 'Invalid offer' }, { status: 400 });
    const returnUrl = new URL(
      '/settings/billing?payment=return',
      process.env.NEXT_PUBLIC_BASE_URL || request.url
    ).toString();
    return Response.json(
      await createWaffoCheckout(owner.id, owner.email, body.offerKey, returnUrl)
    );
  } catch (error) {
    return billingError(error);
  }
}
