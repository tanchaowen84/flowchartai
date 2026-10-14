import { auth } from '@/lib/auth';
import { billingEnabled } from './policy';
import { BillingError } from './wallet';
export async function billingSession(
  request: Request
): Promise<{ id: string; email: string }> {
  if (!billingEnabled())
    throw new BillingError('billing_disabled', 'Billing is not enabled', 503);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id)
    throw new BillingError('unauthorized', 'Sign in to continue', 401);
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (
      origin &&
      origin !== new URL(process.env.NEXT_PUBLIC_BASE_URL || request.url).origin
    )
      throw new BillingError('invalid_origin', 'Invalid request origin', 403);
  }
  return { id: session.user.id, email: session.user.email };
}
export function billingError(error: unknown): Response {
  return Response.json(
    {
      ...(error instanceof BillingError ? error.details : {}),
      error: error instanceof BillingError ? error.code : 'billing_error',
      message:
        error instanceof BillingError
          ? error.message
          : 'Billing is temporarily unavailable',
    },
    { status: error instanceof BillingError ? error.status : 503 }
  );
}
