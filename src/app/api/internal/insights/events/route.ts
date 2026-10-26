import { createHash, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
/** Durable, cursor-based event feed. No direct DB access, content, emails or tokens leave the site. */
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
  const start = process.env.SITE_INSIGHTS_START_AT;
  if (!start || !Number.isFinite(Date.parse(start)))
    return new Response(null, { status: 503 });
  let cursor = { at: start, id: '' };
  try {
    const raw = new URL(request.url).searchParams.get('cursor');
    if (raw) {
      if (raw.length > 2048) throw Error();
      cursor = z
        .object({ at: z.string().datetime(), id: z.string().max(200) })
        .parse(JSON.parse(Buffer.from(raw, 'base64url').toString()));
    }
  } catch {
    return new Response(null, { status: 400 });
  }
  const db = await getDb();
  // Records newer than two minutes are deliberately held back, allowing ordinary transactions to commit.
  // A cycle restarts with a 24h overlap; deterministic IDs make replay safe and recover late commits.
  const rows = await db.execute(sql`
    WITH observations AS (
      SELECT 'signup:'||u.id AS id,u.created_at AS at,
        jsonb_build_object('event_id','signup:'||u.id,'name','signup_completed','user_id',u.id,
          'properties','{}'::jsonb) AS event
      FROM "user" u
      UNION ALL
      SELECT 'growth:'||g.id,g.recorded_at,
        jsonb_build_object('event_id','growth:'||g.id,'name',CASE WHEN g.name='insights_identify' THEN 'identify' ELSE g.name END,
          'user_id',g.user_id,'anonymous_id',g.properties->>'anonymous_id','qa',COALESCE((g.properties->>'qa')::boolean,false),
          'properties',jsonb_strip_nulls(jsonb_build_object('task_id',g.task_id,'checkout_id',g.checkout_id,
            'editor',g.properties->>'editor','format',g.properties->>'format','country',g.properties->>'country')))
      FROM growth_events g WHERE g.name IN ('insights_identify','result_ready','result_delivered','save_succeeded','export_initiated','paywall_viewed','checkout_handoff')
      UNION ALL
      SELECT 'task:'||t.id,t.created_at,jsonb_build_object('event_id','task:'||t.id,'name','task_started','user_id',t.user_id,'properties',jsonb_build_object('task_id',t.id))
      FROM billing_tasks t
      UNION ALL
      SELECT 'cost:'||t.id||':'||c.ordinality,t.updated_at,
        jsonb_build_object('event_id','cost:'||t.id||':'||c.ordinality,'name','cost_recorded','user_id',t.user_id,
          'properties',jsonb_build_object('task_id',t.id,'category','model','model',c.value->>'model','currency','USD','amount_micros',round((c.value->>'cost')::numeric*1000000),'cost_complete',false))
      FROM billing_tasks t CROSS JOIN LATERAL jsonb_array_elements(t.calls) WITH ORDINALITY c(value,ordinality)
      WHERE t.state IN ('committed','released','failed') AND jsonb_typeof(c.value->'cost')='number' AND (c.value->>'cost')::numeric>=0
      UNION ALL
      SELECT 'billing:'||b.id,b.created_at,
        jsonb_build_object('event_id','billing:'||b.id,'name',b.metadata->'insights'->>'name',
          'user_id',COALESCE(b.metadata->'insights'->>'user_id',c.user_id),
          'properties',(b.metadata->'insights')-'name'-'user_id')
      FROM billing_events b LEFT JOIN billing_checkouts c ON c.order_id=b.order_id
      WHERE jsonb_typeof(b.metadata->'insights')='object'
    )
    SELECT id,at,to_char(at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,event FROM observations WHERE at>=${start}::timestamp AND at<now()-interval '2 minutes'
      AND (at>${cursor.at}::timestamp OR (at=${cursor.at}::timestamp AND id>${cursor.id}))
    ORDER BY at,id LIMIT 100`);
  const events = rows.map((r: any) => {
    const e = r.event;
    for (const k of Object.keys(e)) if (e[k] === null) delete e[k];
    return { ...e, occurred_at: new Date(r.at).toISOString() };
  });
  const last = rows.at(-1) as any;
  const next = last
    ? { at: last.cursor_at, id: last.id }
    : {
        at: new Date(
          Math.max(Date.parse(start), Date.now() - 24 * 3600000)
        ).toISOString(),
        id: '',
      };
  return Response.json(
    {
      events,
      cursor: Buffer.from(JSON.stringify(next)).toString('base64url'),
      coverage: [
        'Only observations since installation',
        'Legacy receipts without amount and currency excluded',
        'Creem renewals and refunds not yet normalized',
        'Costs include provider-reported model usage only',
        '24-hour overlap; longer late transactions require reconciliation',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
