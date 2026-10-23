import {
  ACQUISITION_COOKIE,
  captureAcquisition,
  openAcquisition,
  sealAcquisition,
} from '@/analytics/acquisition';
import {
  bindAcquisition,
  growthEnabled,
  recordGrowth,
} from '@/analytics/growth-server';
import { auth } from '@/lib/auth';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const key = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_:-]+$/);
const input = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('capture'),
    url: z.string().url().max(4096),
    referrer: z.string().max(4096),
  }),
  z.object({ operation: z.literal('bind') }),
  z.object({
    operation: z.literal('event'),
    id: z.string().uuid(),
    name: z.enum([
      'result_ready',
      'export_initiated',
      'paywall_viewed',
      'checkout_handoff',
    ]),
    taskId: key.optional(),
    flowchartId: key.optional(),
    checkoutId: key.optional(),
    source: z.enum(['paywall', 'pricing']).optional(),
    properties: z
      .object({
        editor: z.enum(['drawio', 'excalidraw']).optional(),
        format: z.enum(['png', 'svg', 'drawio', 'excalidraw']).optional(),
      })
      .optional(),
  }),
]);
export async function POST(request: NextRequest): Promise<Response> {
  if (!growthEnabled()) return new Response(null, { status: 204 });
  const origin = new URL(process.env.NEXT_PUBLIC_BASE_URL || request.url)
    .origin;
  if (request.headers.get('origin') !== origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  if (Number(request.headers.get('content-length')) > 12000)
    return new Response(null, { status: 413 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Invalid observation' }, { status: 400 });
  const body = parsed.data;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const previous = openAcquisition(
    request.cookies.get(ACQUISITION_COOKIE)?.value || '',
    secret
  );
  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'private, no-store' },
  });
  if (body.operation === 'capture') {
    if (new URL(body.url).origin !== origin)
      return new Response(null, { status: 400 });
    if (!previous)
      response.cookies.set(
        ACQUISITION_COOKIE,
        sealAcquisition(captureAcquisition(body.url, body.referrer), secret),
        {
          httpOnly: true,
          sameSite: 'lax',
          secure: origin.startsWith('https:'),
          maxAge: 30 * 86400,
          path: '/',
        }
      );
    return response;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return new Response(null, { status: 401 });
  if (body.operation === 'bind') {
    const bound = await bindAcquisition(
      session.user.id,
      new Date(session.user.createdAt),
      previous
    );
    if (!bound) return new Response(null, { status: 503 });
    response.cookies.delete(ACQUISITION_COOKIE);
    return response;
  }
  const { operation, id, ...event } = body;
  const ok = await recordGrowth(session.user.id, {
    ...event,
    id: `${session.user.id}:${id}`,
  });
  return ok ? response : new Response(null, { status: 422 });
}
