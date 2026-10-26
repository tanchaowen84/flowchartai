import { insightsQaUsers } from '@/analytics/insights-feed';
import { getDb } from '@/db';
import { growthEvents } from '@/db/growth-schema';
import { user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
export async function POST(request: Request): Promise<Response> {
  if (process.env.SITE_INSIGHTS_ENABLED !== 'true')
    return new Response(null, { status: 503 });
  if (request.headers.get('origin') !== 'https://flowchartai.org')
    return new Response(null, { status: 403 });
  const data = z
    .object({ anonymous_id: z.string().uuid(), qa: z.boolean().default(false) })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!data.success) return new Response(null, { status: 400 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const qa = insightsQaUsers().has(session.user.id);
  if (data.data.qa && !qa) return new Response(null, { status: 403 });
  const db = await getDb();
  const id = `insights-identify:${data.data.anonymous_id}`;
  const [account] = await db
    .select({ country: user.country })
    .from(user)
    .where(eq(user.id, session.user.id));
  const country =
    account?.country && /^[A-Z]{2}$/.test(account.country)
      ? account.country
      : undefined;
  await db
    .insert(growthEvents)
    .values({
      id,
      userId: session.user.id,
      name: 'insights_identify',
      properties: {
        anonymous_id: data.data.anonymous_id,
        qa,
        country,
      },
    })
    .onConflictDoNothing();
  const [record] = await db
    .select({ userId: growthEvents.userId })
    .from(growthEvents)
    .where(eq(growthEvents.id, id));
  if (record.userId !== session.user.id)
    return new Response(null, { status: 409 });
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
