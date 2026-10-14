import { billingEnabled } from '@/lib/billing/policy';
import { processWaffoEvent, verifyWaffoEvent } from '@/payment/provider/waffo';
export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  if (!billingEnabled())
    return Response.json({ error: 'Billing is not enabled' }, { status: 503 });
  const raw = await request.text();
  let event: ReturnType<typeof verifyWaffoEvent>;
  try {
    event = verifyWaffoEvent(
      raw,
      request.headers.get('x-waffo-signature') ?? ''
    );
  } catch {
    return Response.json(
      { error: 'Invalid webhook signature, store or environment' },
      { status: 401 }
    );
  }
  try {
    await processWaffoEvent(event);
    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: 'Webhook fulfillment failed; delivery can be retried' },
      { status: 500 }
    );
  }
}
