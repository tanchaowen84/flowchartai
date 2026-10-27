import { createHash, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
import { user } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
/** Scoped profile metadata. No emails, names, IPs or authentication tokens. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.SITE_INSIGHTS_FEED_TOKEN;
  if (process.env.SITE_INSIGHTS_ENABLED !== 'true' || !secret)
    return new Response(null, { status: 503 });
  const token =
    request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (
    !timingSafeEqual(
      createHash('sha256').update(token).digest(),
      createHash('sha256').update(secret).digest()
    )
  )
    return new Response(null, { status: 401 });
  const parsed = z
    .array(
      z
        .string()
        .min(1)
        .max(180)
        .regex(/^[\w:.-]+$/)
    )
    .min(1)
    .max(100)
    .safeParse(
      (new URL(request.url).searchParams.get('users') || '').split(',')
    );
  if (!parsed.success) return new Response(null, { status: 400 });
  const db = await getDb();
  const rows = await db
    .select({ user_id: user.id, country: user.country, avatar_url: user.image })
    .from(user)
    .where(inArray(user.id, parsed.data));
  return Response.json(
    {
      profiles: rows.map((r) => ({
        ...r,
        country:
          r.country && /^[A-Z]{2}$/.test(r.country) && r.country !== 'XX'
            ? r.country
            : null,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
