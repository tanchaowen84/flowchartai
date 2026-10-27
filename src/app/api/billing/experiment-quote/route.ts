import {
  anonymousFromCookie,
  experimentClient,
  experimentsEnabled,
  firstBuyer,
  validateQuote,
} from '@/analytics/experiment-server';
import { getDb } from '@/db';
import { billingError, billingSession } from '@/lib/billing/http';
import { z } from 'zod';
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    if (!experimentsEnabled())
      return Response.json(
        { quote: null },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    const body = z
      .object({ request_id: z.string().uuid() })
      .strict()
      .parse(await request.json());
    const anonymous = anonymousFromCookie(request.headers.get('cookie') || '');
    if (!anonymous)
      return Response.json(
        { quote: null },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    const result = await experimentClient().quote({
      target: 'credit-pack-price',
      anonymous_id: anonymous,
      user_id: owner.id,
      request_id: body.request_id,
      eligible: await firstBuyer(await getDb(), owner.id),
    });
    if (result.quote) validateQuote(result.quote, owner.id);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: 'invalid_request', message: 'Invalid checkout request.' },
        { status: 400 }
      );
    return billingError(error);
  }
}
