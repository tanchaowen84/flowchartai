import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { afterAll, test } from 'vitest';
import { captureAcquisition } from './acquisition';
import { bindAcquisition, recordGrowth } from './growth-server';
const enabled = !!process.env.MEASUREMENT_TEST_DATABASE_URL;
if (
  enabled &&
  !/^postgres:\/\/[^@]+@127\.0\.0\.1:55499\//.test(
    process.env.MEASUREMENT_TEST_DATABASE_URL!
  )
)
  throw new Error('Tests require isolated local port 55499');
if (enabled) {
  process.env.DATABASE_URL = process.env.MEASUREMENT_TEST_DATABASE_URL;
  process.env.GROWTH_MEASUREMENT = 'true';
}
const sql = enabled
  ? postgres(process.env.DATABASE_URL!, { max: 1, prepare: false })
  : null;
const prefix = `test-${randomUUID()}`;
const ids = ['a', 'b', 'qa', 'unknown', 'immature'].map(
  (x) => `${prefix}-${x}`
);
afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM billing_events WHERE order_id=${`${prefix}-order`}`;
  await sql`DELETE FROM "user" WHERE id=ANY(${ids})`;
  await sql.end();
  const { getDb } = await import('../db');
  await ((await getDb()) as any).$client.end();
});
async function user(
  id: string,
  created = '2026-10-16T00:00:00Z'
): Promise<void> {
  await sql!`INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES (${id},'QA',${`${id}@example.invalid`},true,${created},${created})`;
}
const content = (documentId = 'doc-a') =>
  JSON.stringify({
    editorKind: 'drawio',
    formatVersion: 1,
    documentId,
    revision: 1,
    diagramType: 'flowchart',
    xml: '<mxfile><diagram id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n" parent="1" vertex="1"><mxGeometry width="100" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>',
  });
async function task(
  id: string,
  owner: string,
  at = '2026-10-16T01:00:00Z'
): Promise<void> {
  await sql!`INSERT INTO billing_tasks (id,user_id,request_hash,state,budget,rate_version,result,expires_at,created_at,updated_at) VALUES (${id},${owner},'hash','committed',1,'v1',${JSON.stringify({ delivery: { documentId: 'doc-a', revision: 1, nodeIds: ['n'] } })}::jsonb,${at},${at},${at})`;
}
test.skipIf(!enabled)(
  'first touch binds once, cannot be reused by another account, and returning login does not overwrite',
  async () => {
    for (const id of ids)
      await user(
        id,
        id.endsWith('immature')
          ? '2026-10-20T20:00:00Z'
          : id === ids[1]
            ? '2026-10-20T00:00:00Z'
            : undefined
      );
    const observed = captureAcquisition(
      'https://flowchartai.org/?utm_source=email',
      '',
      Date.parse('2026-10-15T23:00:00Z')
    );
    assert.equal(
      await bindAcquisition(ids[0], new Date('2026-10-16Z'), observed),
      true
    );
    await bindAcquisition(ids[0], new Date('2026-10-16Z'), null);
    await bindAcquisition(ids[1], new Date('2026-10-16Z'), observed);
    const rows =
      await sql!`SELECT user_id,observation->>'kind' kind FROM growth_acquisition WHERE user_id=ANY(${ids}) ORDER BY user_id`;
    assert.equal(rows.find((x) => x.user_id === ids[0])?.kind, 'campaign');
    assert.equal(rows.find((x) => x.user_id === ids[1])?.kind, 'unknown');
  }
);
test.skipIf(!enabled)(
  'owner and task-file relation checks; semantic delivery dedupe; dimensions remove identities',
  async () => {
    await task(`${prefix}-task`, ids[0]);
    for (const [id, owner, doc] of [
      [`${prefix}-file`, ids[0], 'doc-a'],
      [`${prefix}-wrong`, ids[0], 'doc-wrong'],
      [`${prefix}-other`, ids[1], 'doc-a'],
    ])
      await sql!`INSERT INTO flowcharts (id,user_id,title,content) VALUES (${id},${owner},'QA',${content(doc)})`;
    const event = {
      id: randomUUID(),
      name: 'result_ready' as const,
      taskId: `${prefix}-task`,
      flowchartId: `${prefix}-file`,
      properties: {
        editor: 'drawio',
        userId: ids[0],
        email: 'private@example.invalid',
      },
    };
    assert.equal(await recordGrowth(ids[1], event), false);
    assert.equal(
      await recordGrowth(ids[0], { ...event, flowchartId: `${prefix}-wrong` }),
      false
    );
    assert.equal(
      await recordGrowth(ids[0], { ...event, flowchartId: `${prefix}-other` }),
      false
    );
    assert.equal(await recordGrowth(ids[0], event), true);
    assert.equal(
      await recordGrowth(ids[0], { ...event, id: randomUUID() }),
      true
    );
    const rows =
      await sql!`SELECT * FROM growth_events WHERE user_id=${ids[0]}`;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].properties, { editor: 'drawio' });
  }
);
test.skipIf(!enabled)(
  'cohort SQL uses fixed maturity, same-file use, ordered paywall source, QA propagation and as-of',
  async () => {
    await sql!`DELETE FROM growth_events WHERE user_id=ANY(${ids})`;
    await task(`${prefix}-qa-task`, ids[2]);
    const emit = async (
      owner: string,
      name: string,
      at: string,
      keys: {
        task?: string;
        file?: string;
        checkout?: string;
        source?: string;
      } = {}
    ) =>
      sql!`INSERT INTO growth_events (id,user_id,name,recorded_at,task_id,flowchart_id,checkout_id,source) VALUES (${randomUUID()},${owner},${name},${at},${keys.task || null},${keys.file || null},${keys.checkout || null},${keys.source || null})`;
    await sql!`INSERT INTO billing_checkouts (id,user_id,offer_key,environment,state,order_id,checkout_url,created_at) VALUES (${`${prefix}-checkout`},${ids[0]},'starter','live','paid',${`${prefix}-order`},'https://checkout.example.invalid/','2026-10-16T02:00Z')`;
    await sql!`INSERT INTO billing_events (id,provider,event_type,order_id,created_at) VALUES (${randomUUID()},'waffo','order.completed',${`${prefix}-order`},'2026-10-16T05:00Z')`;
    for (const owner of [ids[0], ids[2]]) {
      await emit(owner, 'result_delivered', '2026-10-16T01:00Z', {
        task: `${prefix}-task`,
        file: `${prefix}-file`,
      });
      await emit(owner, 'export_initiated', '2026-10-16T02:00Z', {
        file: `${prefix}-file`,
      });
      await emit(owner, 'paywall_viewed', '2026-10-16T03:00Z');
      await emit(owner, 'checkout_handoff', '2026-10-16T04:00Z', {
        checkout: `${prefix}-checkout`,
        source: 'paywall',
      });
    }
    await emit(ids[0], 'result_ready', '2026-10-16T00:59Z', {
      task: `${prefix}-task`,
    });
    await emit(ids[0], 'result_delivered', '2026-10-16T02:00Z', {
      task: 'second-task',
      file: `${prefix}-file`,
    });
    await emit(ids[1], 'paywall_viewed', '2026-10-20T12:00Z');
    await emit(ids[3], 'result_ready', '2026-10-16T01:00Z', {
      task: 'unmapped-task',
    });
    await emit(ids[3], 'export_initiated', '2026-10-17T01:00Z', {
      task: 'unmapped-task',
    }); // exactly +24h excluded
    await emit(ids[3], 'paywall_viewed', '2026-10-22T00:00Z'); // future excluded
    const query = await readFile(
      new URL('../../scripts/measurement/cohort.sql', import.meta.url),
      'utf8'
    );
    const classification = {
      qaUserIds: [],
      qaTaskIds: [`${prefix}-qa-task`],
      qaFlowchartIds: [],
      qaCheckoutIds: [],
      naturalUserIds: [ids[0], ids[1], ids[4]],
    };
    const rows = await sql!.unsafe(query, [
      '2026-10-16T00:00:00Z',
      '2026-10-21T00:00:00Z',
      '2026-10-21T00:00:00Z',
      JSON.stringify(classification),
    ]);
    const natural = rows.find((x) => x.audience === 'natural')!;
    assert.equal(natural.mature_accounts_24h, 2);
    assert.equal(natural.immature_accounts, 1);
    assert.equal(natural.mature_delivered_results, 1);
    assert.equal(natural.used_results, 1);
    assert.equal(natural.mature_paywall_accounts, 1);
    assert.equal(natural.paywall_to_checkout_accounts, 1);
    assert.equal(natural.immature_paywall_accounts, 1);
    assert.equal(natural.handed_off_orders_with_provider_receipt_accounts, 1);
    assert.equal(rows.find((x) => x.audience === 'qa')?.accounts, 1);
    assert.equal(
      rows.find((x) => x.audience === 'unclassified')?.used_results,
      0
    );
    assert.equal(
      rows.find((x) => x.audience === 'unclassified')?.mature_paywall_accounts,
      0
    );
  }
);
