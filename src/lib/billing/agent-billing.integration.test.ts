import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
const state = vi.hoisted(() => ({
  userId: '',
  abort: false,
  requests: 0,
  command: null as unknown,
}));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: state.userId, email: 'fixture@example.invalid' },
      }),
    },
  },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/creem-moderation', () => ({
  extractLatestUserPrompt: () => 'Make a diagram',
  screenPromptWithCreem: async () => ({ decision: 'allow' }),
}));
async function streamAgent(_messages: unknown, options: any) {
  return {
    fullStream: (async function* () {
      const response = await options.model.fetch('https://fixture.invalid');
      await response.text();
      yield {
        type: 'text-delta',
        payload: { id: 'text-1', text: 'A usable answer' },
      };
      if (state.command)
        yield {
          type: 'tool-result',
          payload: {
            toolName: 'generate_flowchart',
            toolCallId: 'remove-last',
            result: state.command,
          },
        };
      yield state.abort
        ? { type: 'abort', payload: {} }
        : { type: 'finish', payload: {} };
    })(),
  };
}
vi.mock('@/lib/mastra/drawio-agent', () => ({
  createDrawioAgent: () => ({ stream: streamAgent }),
  nativeAgentInstructions: () => 'Fixture instructions',
}));
vi.mock('@/lib/mastra/flowchart-agent', () => ({
  flowchartAgent: { stream: streamAgent },
}));
vi.mock('@/lib/mastra/native-model', () => ({
  getNativeModelForMode: () => 'deepseek/deepseek-v4-pro',
  createNativeModel: (_mode: unknown, options: any) => options,
}));
import { POST as chat } from '@/app/api/ai/chat/flowchart/route';
import { POST as taskPost } from '@/app/api/billing/task/route';
import { getDb } from '@/db';
import {
  aiUsage,
  billingTasks,
  creditsHistory,
  payment,
  user,
} from '@/db/schema';
import { canUserUseAI } from '@/lib/ai-usage';
import { estimateTaskBudget } from './usage-collector';
import { legacyRequestsRemaining, reserveTask, walletSummary } from './wallet';
const enabled = Boolean(process.env.BILLING_TEST_DATABASE_URL);
describe.skipIf(!enabled)('Agent HTTP stream to real Postgres billing', () => {
  const ids: string[] = [];
  beforeAll(() => {
    const url = new URL(process.env.BILLING_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      !(
        (url.port === '55438' && url.pathname === '/flowchart_billing_test') ||
        (url.port === '55469' && url.pathname === '/flowchart_paywall_test')
      )
    )
      throw new Error('Not test DB');
    process.env.DATABASE_URL = url.toString();
    process.env.BILLING_V1_ENABLED = 'true';
  });
  beforeEach(async () => {
    state.userId = `agent-test-${randomUUID()}`;
    ids.push(state.userId);
    state.abort = false;
    state.requests = 0;
    state.command = null;
    const db = await getDb();
    await db.insert(user).values({
      id: state.userId,
      name: 'fixture',
      email: `${state.userId}@example.invalid`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      credits: 100,
    });
    vi.stubGlobal('fetch', async () => {
      state.requests++;
      return new Response(
        JSON.stringify({
          id: 'gen-fixture',
          usage: { prompt_tokens: 1000, completion_tokens: 500, cost: 0.003 },
        })
      );
    });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    const db = await getDb();
    for (const id of ids) await db.delete(user).where(eq(user.id, id));
  });
  function request(id: string, xml?: string) {
    return new Request('http://fixture/api/ai/chat/flowchart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingTaskId: id,
        messages: [{ role: 'user', content: 'Make a diagram' }],
        aiContext: {
          editorKind: 'drawio',
          nativeDocument: {
            editorKind: 'drawio',
            formatVersion: 1,
            documentId: 'fixture-doc',
            revision: 0,
            diagramType: 'flowchart',
            pageId: 'page-1',
            xml:
              xml ||
              '<mxfile><diagram id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>',
          },
        },
      }),
    });
  }
  async function commit(id: string, hash: string) {
    return taskPost(
      new Request('http://fixture/api/billing/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: id,
          resultHash: hash,
          action: 'commit',
          tokensUsed: 0,
          credits: 0,
        }),
      })
    );
  }
  it('reserves then settles only after application receipt, ignores client amounts, and replays without a model call', async () => {
    const id = randomUUID();
    const response = await chat(request(id));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"state":"ready"');
    const db = await getDb();
    const [t] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id));
    expect(t.state).toBe('ready');
    expect(t.charged).toBe(4);
    expect((await walletSummary(state.userId)).reserved).toBeGreaterThan(0);
    expect((await (await commit(id, t.resultHash!)).json()).charged).toBe(4);
    expect((await (await commit(id, t.resultHash!)).json()).charged).toBe(4);
    expect((await walletSummary(state.userId)).balance).toBe(96);
    const replay = await chat(request(id));
    await replay.text();
    expect(state.requests).toBe(1);
    const rows = await db
      .select()
      .from(creditsHistory)
      .where(eq(creditsHistory.userId, state.userId));
    expect(rows.filter((r) => r.type === 'subtract')).toHaveLength(1);
  });
  it('a canceled ready result releases its reservation', async () => {
    const id = randomUUID();
    await (await chat(request(id))).text();
    const response = await taskPost(
      new Request('http://fixture/api/billing/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id, action: 'cancel' }),
      })
    );
    expect((await response.json()).charged).toBe(0);
    expect((await walletSummary(state.userId)).balance).toBe(100);
  });
  it('delivers and settles an edit that removes the final node exactly once', async () => {
    state.command = {
      kind: 'drawio-command',
      commandId: 'remove-last',
      documentId: 'fixture-doc',
      baseRevision: 0,
      pageId: 'page-1',
      operation: 'patch',
      diagramType: 'flowchart',
      description: 'Removed the final node',
      patch: {
        baseRevision: 0,
        operations: [{ type: 'removeCell', id: 'last' }],
      },
    };
    const xml =
      '<mxfile><diagram id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="last" vertex="1" parent="1"><mxGeometry width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';
    const id = randomUUID();
    const stream = await (await chat(request(id, xml))).text();
    expect(stream).toContain('"state":"ready"');
    expect(stream).not.toContain('"type":"error"');
    const db = await getDb();
    const [task] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id));
    expect(task.firstDiagram).toBe(false);
    expect(task.result).toMatchObject({ delivery: { nodeIds: [] } });
    expect((await (await commit(id, task.resultHash!)).json()).charged).toBe(4);
    expect((await (await commit(id, task.resultHash!)).json()).charged).toBe(4);
    expect((await walletSummary(state.userId)).balance).toBe(96);
    expect(await (await chat(request(id, xml))).text()).toContain(
      '"state":"committed"'
    );
    expect(state.requests).toBe(1);
  });
  it('an aborted stream releases funds and records provider cost without successful billing', async () => {
    state.abort = true;
    const id = randomUUID();
    expect(await (await chat(request(id))).text()).toContain('aborted');
    expect((await walletSummary(state.userId)).balance).toBe(100);
    const db = await getDb();
    const [t] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id));
    expect(t.state).toBe('released');
    expect(t.calls).toMatchObject([{ cost: 0.003, platformFunded: true }]);
  });
  it('a forged result receipt cannot settle the reservation', async () => {
    const id = randomUUID();
    await (await chat(request(id))).text();
    expect((await commit(id, 'a'.repeat(64))).status).toBe(409);
    const db = await getDb();
    const [t] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id));
    expect(t.state).toBe('ready');
    await taskPost(
      new Request('http://fixture/api/billing/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id, action: 'cancel' }),
      })
    );
  });
  it('starts a task above 64 credits without confirmation and settles its actual usage once', async () => {
    const id = randomUUID();
    const body = JSON.parse(await request(id).text());
    body.messages[0].content = 'step '.repeat(6000);
    const estimate = estimateTaskBudget({
      messages: body.messages,
      aiContext: body.aiContext,
    });
    expect(estimate).toBeGreaterThan(64);
    const response = await chat(
      new Request('http://fixture/api/ai/chat/flowchart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    expect(response.status).toBe(200);
    await response.text();
    const db = await getDb();
    const [task] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id));
    expect(task.budget).toBe(estimate);
    expect(task.state).toBe('ready');
    expect((await (await commit(id, task.resultHash!)).json()).charged).toBe(4);
    expect((await (await commit(id, task.resultHash!)).json()).charged).toBe(4);
    expect((await walletSummary(state.userId)).balance).toBe(96);
    expect(state.requests).toBe(1);
  });
  it('counts analysis and drawing as the same legacy AI request entitlement before falling back to credits', async () => {
    const db = await getDb();
    await db.insert(payment).values({
      id: randomUUID(),
      userId: state.userId,
      priceId: 'fixture-hobby',
      provider: 'creem',
      legacyPlan: 'hobby',
      type: 'subscription',
      customerId: 'fixture',
      subscriptionId: randomUUID(),
      status: 'active',
      periodEnd: new Date(Date.now() + 30 * 86400000),
    });
    await db.insert(aiUsage).values(
      Array.from({ length: 99 }, () => ({
        id: randomUUID(),
        userId: state.userId,
        type: 'canvas_analysis',
        success: true,
      }))
    );
    expect(await canUserUseAI(state.userId)).toMatchObject({
      canUse: true,
      remainingUsage: 1,
      billingMode: 'legacy',
    });
    expect(
      await db.transaction((tx) =>
        legacyRequestsRemaining(tx, state.userId, 100)
      )
    ).toBe(1);
    const id = randomUUID();
    const response = await chat(request(id));
    expect(response.status).toBe(200);
    await response.text();
    const [task] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id));
    expect(task.legacy).toBe(true);
    expect((await (await commit(id, task.resultHash!)).json()).charged).toBe(0);
    expect((await (await commit(id, task.resultHash!)).json()).charged).toBe(0);
    expect((await walletSummary(state.userId)).balance).toBe(100);
    expect(await canUserUseAI(state.userId)).toMatchObject({
      canUse: true,
      remainingUsage: 100,
      billingMode: 'credits',
    });
    expect(
      await db.transaction((tx) =>
        legacyRequestsRemaining(tx, state.userId, 100)
      )
    ).toBe(0);
    const next = {
      id: randomUUID(),
      userId: state.userId,
      requestHash: 'next',
      budget: 32,
    };
    expect((await reserveTask(next)).legacy).toBe(false);
    await taskPost(
      new Request('http://fixture/api/billing/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: next.id, action: 'cancel' }),
      })
    );
    await db.update(user).set({ credits: 0 }).where(eq(user.id, state.userId));
    expect(await canUserUseAI(state.userId)).toMatchObject({
      canUse: false,
      billingMode: 'credits',
    });
    expect((await chat(request(randomUUID()))).status).toBe(402);
  });
});
