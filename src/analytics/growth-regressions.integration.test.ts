import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

const deferred = vi.hoisted(() => ({
  callbacks: [] as Array<() => Promise<void>>,
  userId: '',
}));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: { getSession: async () => ({ user: { id: deferred.userId } }) },
  },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/server', async (original) => ({
  ...(await original<any>()),
  after: (callback: () => Promise<void>) => deferred.callbacks.push(callback),
}));

import { NextRequest } from 'next/server';
import { PUT } from '../app/api/flowcharts/[id]/route';
import { recordGrowth } from './growth-server';

const url = process.env.MEASUREMENT_TEST_DATABASE_URL;
if (url && !/^postgres:\/\/[^@]+@127\.0\.0\.1:55499\//.test(url))
  throw new Error('Use isolated port55499');
if (url) {
  process.env.DATABASE_URL = url;
  process.env.GROWTH_MEASUREMENT = 'true';
}
const sql = url ? postgres(url, { max: 1, prepare: false }) : null;
const prefix = `reviewer-${randomUUID()}`;
const users: string[] = [];
const observations: Record<string, unknown> = {};
const query = await readFile(
  new URL('../../scripts/measurement/cohort.sql', import.meta.url),
  'utf8'
);
beforeAll(async () => {
  if (!sql) return;
  await sql!`SET TIME ZONE 'UTC'`;
  const { getDb } = await import('../db');
  const client = ((await getDb()) as any).$client;
  client.options.connection.TimeZone = 'UTC';
  await client.unsafe("SET TIME ZONE 'UTC'");
});
const content = (revision = 1) =>
  JSON.stringify({
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'review-doc',
    revision,
    xml: '<mxfile><diagram id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n" parent="1" vertex="1"><mxGeometry width="100" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>',
  });
async function addUser(label: string, at: string): Promise<string> {
  const id = `${prefix}-${label}`;
  users.push(id);
  await sql!`INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES (${id},'Reviewer fixture',${`${id}@example.invalid`},true,${at},${at})`;
  return id;
}
async function addTask(
  owner: string,
  label: string,
  at: string,
  result: unknown = {
    delivery: { documentId: 'review-doc', revision: 1, nodeIds: ['n'] },
  }
): Promise<string> {
  const id = `${owner}-${label}`;
  await sql!`INSERT INTO billing_tasks (id,user_id,request_hash,state,budget,rate_version,result,expires_at,created_at,updated_at) VALUES (${id},${owner},'hash','committed',1,'v1',${JSON.stringify(result)}::jsonb,${at},${at},${at})`;
  return id;
}
async function addFile(owner: string, value = content()): Promise<string> {
  const id = `${owner}-file`;
  await sql!`INSERT INTO flowcharts (id,user_id,title,content) VALUES (${id},${owner},'Reviewer fixture',${value})`;
  return id;
}
async function emit(
  owner: string,
  name: string,
  at: string,
  task: string | null,
  file: string | null
): Promise<void> {
  await sql!`INSERT INTO growth_events (id,user_id,name,recorded_at,task_id,flowchart_id) VALUES (${randomUUID()},${owner},${name},${at},${task},${file})`;
}
async function report(
  owner: string,
  start: string,
  end: string,
  overrides = {},
  asOf = '2026-10-23T00:00:00Z'
) {
  return sql!.unsafe(query, [
    start,
    end,
    asOf,
    JSON.stringify({
      qaUserIds: [],
      qaTaskIds: [],
      qaFlowchartIds: [],
      qaCheckoutIds: [],
      naturalUserIds: [owner],
      ...overrides,
    }),
  ]);
}
afterAll(async () => {
  if (!sql) return;
  await sql!`DELETE FROM "user" WHERE id=ANY(${users})`;
  await sql.end();
  const { getDb } = await import('../db');
  await ((await getDb()) as any).$client.end();
});

test.skipIf(!url)(
  'two delivered tasks sharing one file both have delivery coverage',
  async () => {
    const owner = await addUser('coverage', '2026-10-16T00:00:00Z');
    const file = await addFile(owner);
    const t1 = await addTask(owner, 't1', '2026-10-16T01:00:00Z');
    const t2 = await addTask(owner, 't2', '2026-10-16T02:00:00Z');
    await emit(owner, 'result_delivered', '2026-10-16T01:00:00Z', t1, file);
    await emit(owner, 'result_delivered', '2026-10-16T02:00:00Z', t2, file);
    const [row] = await report(
      owner,
      '2026-10-16T00:00:00Z',
      '2026-10-17T00:00:00Z'
    );
    observations.coverage = { expectedMissing: 0, actual: row };
    expect(row.accepted_billing_tasks).toBe(2);
    expect(row.accepted_tasks_without_delivery_observation).toBe(0);
  }
);

test.skipIf(!url)(
  'QA classification survives deletion of a retained event file',
  async () => {
    const owner = await addUser('deleted-qa-file', '2026-10-17T00:00:00Z');
    const file = await addFile(owner);
    const task = await addTask(owner, 'task', '2026-10-17T01:00:00Z');
    await emit(owner, 'result_delivered', '2026-10-17T00:00:00Z', task, file);
    await sql!`DELETE FROM flowcharts WHERE id=${file}`;
    const rows = await report(
      owner,
      '2026-10-17T00:00:00Z',
      '2026-10-18T00:00:00Z',
      { qaFlowchartIds: [file] }
    );
    observations.deletedQaFile = { expectedAudience: 'qa', actual: rows };
    expect(rows.find((x) => x.audience === 'qa')?.accounts).toBe(1);
    expect(rows.find((x) => x.audience === 'natural')).toBeUndefined();
  }
);

test.skipIf(!url)(
  'existing saved Excalidraw result can record a client-ready observation',
  async () => {
    const owner = await addUser('excalidraw', '2026-10-18T00:00:00Z');
    const file = await addFile(
      owner,
      JSON.stringify({
        elements: [{ id: 'n', type: 'rectangle', isDeleted: false }],
        appState: {},
        files: {},
      })
    );
    const task = await addTask(owner, 'task', '2026-10-18T01:00:00Z', {
      events: [
        {
          type: 'tool-call',
          args: {
            kind: 'render-mermaid',
            diagramId: 'legacy-diagram',
            operation: 'create',
            mermaidCode: 'flowchart TD; A-->B',
            diagramType: 'flowchart',
          },
        },
      ],
    });
    const accepted = await recordGrowth(owner, {
      id: randomUUID(),
      name: 'result_ready',
      taskId: task,
      flowchartId: file,
      properties: { editor: 'excalidraw' },
    });
    observations.excalidraw = {
      expectedAccepted: true,
      actualAccepted: accepted,
    };
    expect(accepted).toBe(true);
    const [unmapped] =
      await sql!`SELECT flowchart_id FROM growth_events WHERE task_id=${task}`;
    expect(unmapped.flowchart_id).toBeNull();
    await sql!`UPDATE flowcharts SET content=${JSON.stringify({ elements: [{ id: 'n', type: 'rectangle', customData: { diagramId: 'legacy-diagram' } }] })} WHERE id=${file}`;
    const linkedTask = await addTask(
      owner,
      'linked-task',
      '2026-10-18T02:00:00Z',
      {
        events: [
          {
            type: 'tool-call',
            args: { kind: 'render-mermaid', diagramId: 'legacy-diagram' },
          },
        ],
      }
    );
    expect(
      await recordGrowth(owner, {
        id: randomUUID(),
        name: 'result_ready',
        taskId: linkedTask,
        flowchartId: file,
        properties: { editor: 'excalidraw' },
      })
    ).toBe(true);
    const [linked] =
      await sql!`SELECT flowchart_id FROM growth_events WHERE task_id=${linkedTask}`;
    expect(linked.flowchart_id).toBe(file);
  }
);

test.skipIf(!url)(
  'a mandatory pre-ack save cannot become subsequent use when its after callback runs late',
  async () => {
    const now = Date.now();
    const start = new Date(now - 3600000).toISOString();
    const end = new Date(now + 3600000).toISOString();
    const owner = await addUser('delayed-save', start);
    deferred.userId = owner;
    const file = await addFile(owner, content(0));
    const task = await addTask(
      owner,
      'task',
      new Date(now - 1000).toISOString()
    );
    const response = await PUT(
      new NextRequest(`http://localhost/api/flowcharts/${file}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: content(1) }),
      }),
      { params: Promise.resolve({ id: file }) }
    );
    expect(response.status).toBe(200);
    expect(deferred.callbacks).toHaveLength(1);
    await sql!`UPDATE billing_tasks SET updated_at=clock_timestamp()::timestamp WHERE id=${task}`;
    expect(
      await recordGrowth(owner, {
        id: randomUUID(),
        name: 'result_delivered',
        taskId: task,
        flowchartId: file,
      })
    ).toBe(true);
    await deferred.callbacks.shift()!();
    const times =
      await sql!`SELECT (SELECT updated_at::text FROM flowcharts WHERE id=${file}) AS persisted_at, name, recorded_at::text FROM growth_events WHERE user_id=${owner} ORDER BY recorded_at`;
    const [row] = await report(
      owner,
      start,
      end,
      {},
      new Date(now + 72 * 3600000).toISOString()
    );
    observations.delayedSave = {
      expectedUsedResults: 0,
      events: times,
      actual: row,
    };
    expect(row.used_results).toBe(0);
  }
);

test.skipIf(!url)(
  'native ready file mapping survives a later task-only commit while persistence catches up',
  async () => {
    const now = Date.now();
    const start = new Date(now - 3600000).toISOString();
    const end = new Date(now + 3600000).toISOString();
    const owner = await addUser('native-follow-on', start);
    const file = await addFile(owner, content(0));
    const task = await addTask(
      owner,
      'follow-on',
      new Date(now - 1000).toISOString()
    );
    expect(
      await recordGrowth(owner, {
        id: randomUUID(),
        name: 'result_ready',
        taskId: task,
        flowchartId: file,
        properties: { editor: 'drawio' },
      })
    ).toBe(true);
    expect(
      await recordGrowth(owner, {
        id: randomUUID(),
        name: 'result_delivered',
        taskId: task,
        flowchartId: file,
      })
    ).toBe(true);
    await emit(
      owner,
      'export_initiated',
      new Date(now + 1000).toISOString(),
      null,
      file
    );
    const [row] = await report(
      owner,
      start,
      end,
      {},
      new Date(now + 72 * 3600000).toISOString()
    );
    expect(row.mature_delivered_results).toBe(1);
    expect(row.used_results).toBe(1);
    expect(row.delivered_without_saved_file).toBe(0);
  }
);

test.skipIf(!url)(
  'a test-mode checkout is QA evidence even when the account was marked natural',
  async () => {
    const owner = await addUser('test-checkout', '2026-10-19T00:00:00Z');
    await sql!`INSERT INTO billing_checkouts (id,user_id,offer_key,environment,state,checkout_url,created_at) VALUES (${owner + '-checkout'},${owner},'fixture','test','pending','https://example.invalid/fixture','2026-10-19T01:00Z')`;
    const rows = await report(
      owner,
      '2026-10-19T00:00:00Z',
      '2026-10-20T00:00:00Z'
    );
    expect(rows.find((x) => x.audience === 'qa')?.accounts).toBe(1);
    expect(rows.find((x) => x.audience === 'natural')).toBeUndefined();
  }
);

test.skipIf(!url)(
  'a prod checkout created without browser handoff is not a conversion',
  async () => {
    const owner = await addUser(
      'created-only-checkout',
      '2026-10-20T00:00:00Z'
    );
    await sql!`INSERT INTO billing_checkouts (id,user_id,offer_key,environment,state,checkout_url,created_at) VALUES (${owner + '-checkout'},${owner},'fixture','prod','pending','https://example.invalid/fixture','2026-10-20T01:00Z')`;
    await emit(owner, 'paywall_viewed', '2026-10-20T01:00Z', null, null);
    const rows = await report(
      owner,
      '2026-10-20T00:00:00Z',
      '2026-10-21T00:00:00Z'
    );
    const natural = rows.find((x) => x.audience === 'natural')!;
    expect(natural.mature_paywall_accounts).toBe(1);
    expect(natural.paywall_to_checkout_accounts).toBe(0);
    expect(natural.handed_off_orders_with_provider_receipt_accounts).toBe(0);
  }
);

test.skipIf(!url)(
  'an acknowledgement outside registration24h does not hide eligible ready evidence',
  async () => {
    const owner = await addUser('late-ack', '2026-10-16T00:00:00Z');
    const file = await addFile(owner);
    const task = await addTask(owner, 'task', '2026-10-16T23:00:00Z');
    await emit(owner, 'result_ready', '2026-10-16T23:00:00Z', task, file);
    await emit(owner, 'result_delivered', '2026-10-17T00:00:00Z', task, file);
    await emit(owner, 'export_initiated', '2026-10-16T23:30:00Z', null, file);
    const [row] = await report(
      owner,
      '2026-10-16T00:00:00Z',
      '2026-10-17T00:00:00Z'
    );
    expect(row.mature_delivered_results).toBe(1);
    expect(row.used_results).toBe(1);
  }
);

for (const mutation of ['clear', 'delete']) {
  test.skipIf(!url)(
    `a confirmed save remains observed after a later ${mutation} before deferred write`,
    async () => {
      const owner = await addUser(
        `deferred-${mutation}`,
        new Date().toISOString()
      );
      deferred.userId = owner;
      const file = await addFile(owner, content(0));
      const response = await PUT(
        new NextRequest(`http://localhost/api/flowcharts/${file}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: content(1) }),
        }),
        { params: Promise.resolve({ id: file }) }
      );
      expect(response.status).toBe(200);
      if (mutation === 'clear')
        await sql!`UPDATE flowcharts SET content='{"elements":[]}' WHERE id=${file}`;
      else await sql!`DELETE FROM flowcharts WHERE id=${file}`;
      await deferred.callbacks.shift()!();
      const rows =
        await sql!`SELECT name,flowchart_id FROM growth_events WHERE user_id=${owner}`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: 'save_succeeded',
        flowchart_id: file,
      });
    }
  );
}

test.skipIf(!url)(
  'the different-plan pending checkout response retains its owned checkout ID',
  async () => {
    const owner = await addUser('resume-checkout', new Date().toISOString());
    process.env.BILLING_V1_ENABLED = 'true';
    process.env.WAFFO_ENVIRONMENT = 'prod';
    process.env.WAFFO_PROD_PRODUCT_STARTER_YEAR = 'local-product-fixture';
    await sql!`INSERT INTO billing_checkouts (id,user_id,offer_key,environment,state,checkout_url,expires_at) VALUES (${owner + '-checkout'},${owner},'starter_month','prod','pending','https://checkout.example.invalid/resume',now()+interval '1 hour')`;
    const { createWaffoCheckout } = await import('@/payment/provider/waffo');
    await expect(
      createWaffoCheckout(
        owner,
        'fixture@example.invalid',
        'starter_year',
        'http://localhost/return',
        {} as any
      )
    ).rejects.toMatchObject({
      code: 'checkout_open',
      status: 409,
      details: {
        resumeUrl: 'https://checkout.example.invalid/resume',
        checkoutId: owner + '-checkout',
      },
    });
  }
);
