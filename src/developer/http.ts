import { BillingError } from '@/lib/billing/wallet';
import { z } from 'zod';
import { DeveloperError, origin } from './contract';
export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
export function failure(error: unknown): Response {
  const known =
    error instanceof DeveloperError || error instanceof BillingError;
  const status = known
    ? error.status
    : error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : 503;
  const response = json(
    {
      error: {
        ...(error instanceof DeveloperError &&
        error.requiredCredits !== undefined
          ? { required_credits: error.requiredCredits }
          : {}),
        code: known
          ? error.code
          : status === 400
            ? 'invalid_request'
            : 'temporarily_unavailable',
        message: known
          ? error.message
          : status === 400
            ? 'Check the request fields and JSON format.'
            : 'The service is temporarily unavailable.',
      },
    },
    status
  );
  if (status === 429) response.headers.set('Retry-After', '60');
  return response;
}
export async function readBody(
  request: Request,
  max = 3_000_000
): Promise<string> {
  if (Number(request.headers.get('content-length') || 0) > max)
    throw new DeveloperError(
      'body_too_large',
      'Request body is too large.',
      413
    );
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new DeveloperError(
        'body_too_large',
        'Request body is too large.',
        413
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function sameOrigin(request: Request): void {
  if (request.headers.get('origin') !== origin())
    throw new DeveloperError(
      'invalid_origin',
      'Use the website to manage developer access.',
      403
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new DeveloperError(
      'invalid_content_type',
      'Send application/json.',
      415
    );
}
