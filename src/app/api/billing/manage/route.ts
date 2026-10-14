import { billingError, billingSession } from '@/lib/billing/http';
import { waffoClient } from '@/payment/provider/waffo';
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const storeId = process.env.WAFFO_STORE_ID;
    if (!storeId) throw new Error('Missing store');
    const { portalUrl } = await waffoClient().auth.createCustomerPortalLink({
      storeId,
      buyerIdentity: owner.id,
    });
    return Response.json({ url: portalUrl });
  } catch (error) {
    return billingError(error);
  }
}
