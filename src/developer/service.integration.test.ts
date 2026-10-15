import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { developerSettings, developerTasks } from '@/db/developer-schema';
import {
  aiUsage,
  billingTasks,
  creditsHistory,
  flowcharts,
  payment,
  user,
} from '@/db/schema';
import { walletSummary } from '@/lib/billing/wallet';
import type { DrawioDocument } from '@/lib/drawio/contracts';
import { compileNativeGraph } from '@/lib/drawio/graph-compiler';
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
  calls: 0,
  repair: false,
  fail: false,
  before: async () => {},
}));
vi.mock('@/lib/creem-moderation', () => ({
  screenPromptWithCreem: async () => ({ decision: 'allow' }),
}));
vi.mock('./runner', () => ({
  runNativeTask: async (document: DrawioDocument) => {
    state.calls++;
    await state.before();
    if (state.fail) throw new Error('fixture provider failure');
    return {
      document: {
        ...document,
        revision: document.revision + 1,
        xml: compileNativeGraph({
          nodes: [
            { id: 'a', label: 'A', shape: 'process' },
            { id: 'b', label: 'B', shape: 'process' },
          ],
          edges: [{ id: 'edge', source: 'a', target: 'b', label: '' }],
        }),
      },
      title: 'Test flow',
      calls: [1, 2].map(() => ({
        model: 'deepseek/deepseek-v4-pro',
        input: 1000,
        cached: 0,
        output: 500,
        platformFunded: state.repair,
      })),
      events: [{ type: 'tool-call', args: { kind: 'drawio-command' } }],
    };
  },
}));
import { authenticate, createKey, revokeCredential } from './access';
import { type Principal, SCOPES } from './contract';
import {
  diagramVersions,
  exportDiagram,
  listDiagrams,
  readDiagram,
} from './diagrams';
import { generate, account as readAccount, readTask, save } from './service';

describe.skipIf(!process.env.DEVELOPER_TEST_DATABASE_URL)(
  'durable diagram execution and wallet isolation',
  { timeout: 30000 },
  () => {
    const owners: string[] = [];
    let principal: Principal;
    let owner: string;
    beforeAll(() => {
      process.env.DATABASE_URL = process.env.DEVELOPER_TEST_DATABASE_URL;
      process.env.BILLING_V1_ENABLED = 'true';
    });
    beforeEach(async () => {
      owner = `service-test-${randomUUID()}`;
      owners.push(owner);
      state.calls = 0;
      state.repair = false;
      state.fail = false;
      state.before = async () => {};
      await (await getDb()).insert(user).values({
        id: owner,
        name: 'Service test',
        email: `${owner}@example.invalid`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: 1000,
      });
      const key = await createKey(owner, {
        name: 'Integration',
        scopes: [...SCOPES],
      });
      principal = await authenticate(
        new Request('https://flowchartai.org/api/v1', {
          headers: { authorization: `Bearer ${key.key}` },
        })
      );
    });
    afterAll(async () => {
      for (const id of owners)
        await (await getDb()).delete(user).where(eq(user.id, id));
    });
    const input = () => ({ prompt: 'Create a flowchart', max_credits: 100 });
    const key = () => randomUUID();
    it('sums all calls, atomically saves and settles once, replays identical requests', async () => {
      const idempotency = key();
      const task = await generate(principal, input(), idempotency);
      expect(task.state).toBe('succeeded');
      expect(task.charged_credits).toBe(8);
      expect((await generate(principal, input(), idempotency)).id).toBe(
        task.id
      );
      expect(state.calls).toBe(1);
      expect((await walletSummary(owner)).balance).toBe(992);
      const usage = await (await getDb())
        .select()
        .from(aiUsage)
        .where(eq(aiUsage.userId, owner));
      expect(usage).toHaveLength(1);
      expect(usage[0].tokensUsed).toBe(3000);
      expect(
        await (await getDb())
          .select()
          .from(creditsHistory)
          .where(eq(creditsHistory.userId, owner))
      ).toHaveLength(1);
      await expect(
        generate(
          principal,
          { ...input(), prompt: 'Different request' },
          idempotency
        )
      ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    });
    it('rejects cross-owner reads/exports and missing scopes', async () => {
      const task = await generate(principal, input(), key());
      const foreign = { ...principal, userId: 'other-owner' };
      await expect(
        readDiagram(foreign, String(task.diagram_id))
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        exportDiagram(foreign, String(task.diagram_id), 'drawio')
      ).rejects.toMatchObject({ status: 404 });
      await expect(readTask(foreign, String(task.id))).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        generate({ ...principal, scopes: ['diagrams:read'] }, input(), key())
      ).rejects.toMatchObject({ status: 403 });
    });
    it('returns a running receipt for a concurrent duplicate without a second provider call', async () => {
      let release!: () => void;
      let started!: () => void;
      const ready = new Promise<void>((r) => {
        started = r;
      });
      state.before = () => {
        started();
        return new Promise<void>((r) => {
          release = r;
        });
      };
      const idempotency = key();
      const first = generate(principal, input(), idempotency);
      await ready;
      const duplicate = await generate(principal, input(), idempotency);
      expect(duplicate.state).toBe('running');
      release();
      await first;
      expect(state.calls).toBe(1);
    });
    it('account budget includes reservations across keys and enforces daily request cap', async () => {
      await (await getDb())
        .insert(developerSettings)
        .values({ userId: owner, dailyCredits: 60, dailyRequests: 1 });
      let release!: () => void;
      let started!: () => void;
      const ready = new Promise<void>((r) => {
        started = r;
      });
      state.before = () => {
        started();
        return new Promise<void>((r) => {
          release = r;
        });
      };
      const first = generate(principal, input(), key());
      await ready;
      const other = await createKey(owner, {
        name: 'second',
        scopes: [...SCOPES],
      });
      const second = await authenticate(
        new Request('https://flowchartai.org/api/v1', {
          headers: { authorization: `Bearer ${other.key}` },
        })
      );
      await expect(generate(second, input(), key())).rejects.toMatchObject({
        code: 'daily_budget_exceeded',
      });
      release();
      await first;
      await expect(generate(principal, input(), key())).rejects.toMatchObject({
        code: 'daily_budget_exceeded',
      });
    });
    it('rejects a caller cap below the server reservation instead of discounting the task', async () => {
      await expect(
        generate(principal, { ...input(), max_credits: 1 }, key())
      ).rejects.toMatchObject({ code: 'max_credits_too_low', status: 409 });
      expect(state.calls).toBe(0);
      expect((await walletSummary(owner)).balance).toBe(1000);
    });
    it('key daily budget blocks before invoking the provider', async () => {
      const limited = await createKey(owner, {
        name: 'budget',
        scopes: [...SCOPES],
        daily_credits: 1,
      });
      const p = await authenticate(
        new Request('https://flowchartai.org/api/v1', {
          headers: { authorization: `Bearer ${limited.key}` },
        })
      );
      await expect(generate(p, input(), key())).rejects.toMatchObject({
        code: 'daily_budget_exceeded',
      });
      expect(state.calls).toBe(0);
    });
    it('revocation during generation releases reservation and writes no file or debit', async () => {
      state.before = () => revokeCredential(owner, principal.credentialId);
      await expect(generate(principal, input(), key())).rejects.toMatchObject({
        status: 401,
      });
      expect((await walletSummary(owner)).balance).toBe(1000);
      expect(
        await (await getDb())
          .select()
          .from(flowcharts)
          .where(eq(flowcharts.userId, owner))
      ).toHaveLength(0);
      expect(
        await (await getDb())
          .select()
          .from(aiUsage)
          .where(eq(aiUsage.userId, owner))
      ).toHaveLength(0);
    });
    it('provider failure and platform repair never cause a second user charge', async () => {
      state.fail = true;
      await expect(generate(principal, input(), key())).rejects.toThrow();
      expect((await walletSummary(owner)).balance).toBe(1000);
      state.fail = false;
      state.repair = true;
      const task = await generate(principal, input(), key());
      expect(task.charged_credits).toBe(0);
      expect((await walletSummary(owner)).balance).toBe(1000);
    });
    it('edit, version history, manual save and exports share the saved website document', async () => {
      const first = await generate(principal, input(), key());
      const id = String(first.diagram_id);
      const file = await readDiagram(principal, id);
      const changed = await generate(
        principal,
        { ...input(), diagram_id: id, expected_version: file.version },
        key()
      );
      expect(changed.state).toBe('succeeded');
      const current = await readDiagram(principal, id);
      const before = (await walletSummary(owner)).balance;
      await save(
        principal,
        {
          title: 'Manually saved',
          document: current.document,
          expected_version: current.version,
        },
        key(),
        id
      );
      expect((await walletSummary(owner)).balance).toBe(before);
      expect((await diagramVersions(principal, id)).data).toHaveLength(5);
      expect((await exportDiagram(principal, id, 'drawio')).body).toContain(
        '<mxGraphModel'
      );
      await expect(
        save(
          principal,
          {
            title: 'Stale',
            document: current.document,
            expected_version: 'f'.repeat(64),
          },
          key(),
          id
        )
      ).rejects.toMatchObject({ code: 'version_conflict' });
      const saved = await readDiagram(principal, id);
      const edited = await generate(
        principal,
        { ...input(), diagram_id: id, expected_version: saved.version },
        key()
      );
      expect((edited.diagram as Record<string, unknown>).title).toBe(
        'Manually saved'
      );
    });
    it('website concurrent save prevents stale AI overwrite and rolls back charge', async () => {
      const first = await generate(principal, input(), key());
      const id = String(first.diagram_id);
      const file = await readDiagram(principal, id);
      const before = (await walletSummary(owner)).balance;
      state.before = async () => {
        await (await getDb())
          .update(flowcharts)
          .set({
            content: JSON.stringify({
              ...(file.document as object),
              revision: 99,
            }),
          })
          .where(eq(flowcharts.id, id));
      };
      await expect(
        generate(
          principal,
          { ...input(), diagram_id: id, expected_version: file.version },
          key()
        )
      ).rejects.toMatchObject({ code: 'version_conflict' });
      expect((await walletSummary(owner)).balance).toBe(before);
    });
    it('legacy subscribed users consume a single existing request, without credit debit', async () => {
      await (await getDb()).insert(payment).values({
        id: randomUUID(),
        userId: owner,
        priceId: 'legacy',
        customerId: 'legacy-test',
        type: 'subscription',
        status: 'active',
        provider: 'creem',
        legacyPlan: 'hobby',
        periodEnd: new Date(Date.now() + 86400000),
      });
      const result = await generate(principal, input(), key());
      expect(result.charged_credits).toBe(0);
      expect((await walletSummary(owner)).balance).toBe(1000);
      const usage = await (await getDb())
        .select()
        .from(aiUsage)
        .where(eq(aiUsage.userId, owner));
      expect(usage).toHaveLength(1);
    });
    it('fences concurrent website title changes and gives matching lightweight list versions', async () => {
      const created = await generate(principal, input(), key());
      const id = String(created.diagram_id);
      const file = await readDiagram(principal, id);
      const listed = await listDiagrams(principal);
      expect(
        (listed.data as Array<Record<string, unknown>>).find((r) => r.id === id)
          ?.version
      ).toBe(file.version);
      expect(
        (listed.data as Array<Record<string, unknown>>)[0]
      ).not.toHaveProperty('document');
      const balance = (await walletSummary(owner)).balance;
      state.before = async () => {
        await (await getDb())
          .update(flowcharts)
          .set({ title: 'New website title 中文' })
          .where(eq(flowcharts.id, id));
      };
      await expect(
        generate(
          principal,
          { ...input(), diagram_id: id, expected_version: file.version },
          key()
        )
      ).rejects.toMatchObject({ code: 'version_conflict' });
      expect((await walletSummary(owner)).balance).toBe(balance);
    });
    it('lists version metadata and reads one original snapshot explicitly', async () => {
      const created = await generate(principal, input(), key());
      const id = String(created.diagram_id);
      const versions = await diagramVersions(principal, id);
      const summary = (versions.data as Array<Record<string, unknown>>)[0];
      expect(summary).not.toHaveProperty('document');
      const snapshot = await diagramVersions(
        principal,
        id,
        String(summary.version)
      );
      expect(snapshot.document).toEqual(
        (created.diagram as Record<string, unknown>).document
      );
      const chinese = await save(
        principal,
        { title: '中文标题', document: snapshot.document },
        key()
      );
      const listed = await listDiagrams(principal);
      const read = await readDiagram(principal, String(chinese.diagram_id));
      expect(
        (listed.data as Array<Record<string, unknown>>).find(
          (r) => r.id === chinese.diagram_id
        )?.version
      ).toBe(read.version);
    });

    it('releases interrupted reservations on account read and fences a late worker', async () => {
      state.before = async () => {
        await (await getDb())
          .update(developerTasks)
          .set({ createdAt: new Date(Date.now() - 7 * 60000) })
          .where(eq(developerTasks.userId, owner));
        await readAccount(principal);
      };
      await expect(generate(principal, input(), key())).rejects.toMatchObject({
        code: 'task_closed',
      });
      expect((await walletSummary(owner)).balance).toBe(1000);
      expect(
        await (await getDb())
          .select()
          .from(flowcharts)
          .where(eq(flowcharts.userId, owner))
      ).toHaveLength(0);
    });
  }
);
