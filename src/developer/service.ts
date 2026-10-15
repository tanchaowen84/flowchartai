/** Shared REST/MCP application layer: durable idempotency, owner budgets, atomic save + settlement. */
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  developerCredentials,
  developerSettings,
  developerTasks,
} from '@/db/developer-schema';
import { billingTasks, flowcharts, user } from '@/db/schema';
import { type ModelCallUsage, RATE_VERSION } from '@/lib/billing/policy';
import { estimateTaskBudget } from '@/lib/billing/usage-collector';
import {
  BillingError,
  finalizeTask,
  lockWallet,
  readyTask,
  recordTaskCalls,
  reserveTask,
  walletSummary,
} from '@/lib/billing/wallet';
import { screenPromptWithCreem } from '@/lib/creem-moderation';
import { type DrawioDocument, EMPTY_DRAWIO_XML } from '@/lib/drawio/contracts';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { activeCredential, ownerPolicy } from './access';
import {
  DeveloperError,
  type Principal,
  generationSchema,
  hash,
  idempotencySchema,
  requireScope,
  validateImage,
} from './contract';
import {
  diagramVersion,
  nativeDocument,
  ownedDiagram,
  persistDiagram,
  publicDiagram,
  saveSchema,
  validDocument,
} from './diagrams';
import { type NativeTaskResult, runNativeTask } from './runner';

type Task = typeof developerTasks.$inferSelect;
interface Prepared {
  document: DrawioDocument;
  title: string;
  expectedVersion?: string;
  calls: ModelCallUsage[];
  events: unknown[];
}
export const capabilities = {
  version: '1.0.0',
  diagram_format: 'drawio',
  exports: ['drawio', 'json'],
  website_exports: ['drawio', 'svg', 'png'],
  input: { prompt: true, image: 'One base64 PNG/JPEG/WebP, maximum 2 MB' },
  execution: {
    mode: 'synchronous',
    timeout_seconds: 240,
    idempotency:
      'Required on all writes. Same owner + key + body replays the durable receipt; do not change the key after a timeout.',
  },
  billing: {
    rate_version: RATE_VERSION,
    source: 'Existing account wallet or legacy subscription allowance',
    max_credits:
      'Required per AI task; a cap below the full-context estimate is rejected before generation. Actual multi-call usage is capped at the accepted reservation. Platform corrections are funded by FlowchartAI.',
    free: ['manual save', 'read', 'native export'],
  },
};
export function publicTask(task: Task): Record<string, unknown> {
  const prepared = task.result as unknown as Prepared | null;
  return {
    id: task.id,
    state: task.state,
    operation: task.operation,
    diagram_id: task.diagramId,
    budget_credits: task.budget,
    reserved_credits: ['running', 'prepared'].includes(task.state)
      ? task.budget
      : 0,
    charged_credits: task.charged,
    ...(task.state === 'succeeded' && prepared
      ? {
          diagram: {
            id: task.diagramId,
            title: prepared.title,
            document: prepared.document,
            version: diagramVersion({
              title: prepared.title,
              content: JSON.stringify(prepared.document),
            }),
            open_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://flowchartai.org'}/canvas/${task.diagramId}`,
          },
        }
      : {}),
    ...(task.error
      ? {
          error: {
            code: task.error,
            message:
              'This task was not delivered. No credits were charged. Use a new idempotency key only after checking this terminal receipt.',
          },
        }
      : {}),
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}
export async function account(
  principal: Principal
): Promise<Record<string, unknown>> {
  requireScope(principal, 'account:read');
  const credential = await activeCredential(principal);
  const policy = await ownerPolicy(principal.userId);
  return {
    wallet: await walletSummary(principal.userId),
    scopes: principal.scopes,
    limits: {
      daily_credits: Math.min(credential.dailyCredits, policy.dailyCredits),
      daily_requests: Math.min(credential.dailyRequests, policy.dailyRequests),
      requests_per_minute: credential.rateLimit,
    },
    day_resets_at: '00:00 UTC',
    usage: await dailyUsage(principal.userId, principal.credentialId),
  };
}
async function reconcileStaleTasks(userId: string): Promise<void> {
  const stale = await (await getDb())
    .select()
    .from(developerTasks)
    .where(
      and(
        eq(developerTasks.userId, userId),
        eq(developerTasks.state, 'running'),
        lt(developerTasks.createdAt, new Date(Date.now() - 6 * 60000))
      )
    )
    .limit(10);
  for (const task of stale)
    await failTask(
      task,
      new DeveloperError('execution_interrupted', 'Execution interrupted.', 409)
    );
}
export async function dailyUsage(
  userId: string,
  credentialId?: string
): Promise<{ credits: number; reserved: number; requests: number }> {
  await reconcileStaleTasks(userId);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [usage] = await (await getDb())
    .select({
      credits: sql<number>`coalesce(sum(${developerTasks.charged}),0)::int`,
      reserved: sql<number>`coalesce(sum(case when ${developerTasks.state} in ('running','prepared') then ${developerTasks.budget} else 0 end),0)::int`,
      requests: sql<number>`count(*) filter (where ${developerTasks.operation} in ('generate','edit'))::int`,
    })
    .from(developerTasks)
    .where(
      and(
        eq(developerTasks.userId, userId),
        gte(developerTasks.createdAt, start),
        ...(credentialId ? [eq(developerTasks.credentialId, credentialId)] : [])
      )
    );
  return usage;
}
async function newTask(
  principal: Principal,
  key: string,
  requestHash: string,
  operation: string,
  diagramId: string,
  budget: number
): Promise<{ task: Task; fresh: boolean }> {
  await reconcileStaleTasks(principal.userId);
  return (await getDb()).transaction(async (tx) => {
    // Same lock order as wallet settlement: owner -> credential -> task/file.
    await tx
      .select()
      .from(user)
      .where(eq(user.id, principal.userId))
      .for('update');
    const credential = await activeCredential(principal, tx);
    const policy = await ownerPolicy(principal.userId, tx);
    const [existing] = await tx
      .select()
      .from(developerTasks)
      .where(
        and(
          eq(developerTasks.userId, principal.userId),
          eq(developerTasks.idempotencyKey, key)
        )
      );
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new DeveloperError(
          'idempotency_conflict',
          'This idempotency key was already used for another request.',
          409
        );
      return { task: existing, fresh: false };
    }
    if (budget > 0) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const rows = await tx
        .select()
        .from(developerTasks)
        .where(
          and(
            eq(developerTasks.userId, principal.userId),
            gte(developerTasks.createdAt, start)
          )
        );
      for (const [subset, credits, requests] of [
        [rows, policy.dailyCredits, policy.dailyRequests],
        [
          rows.filter((r) => r.credentialId === credential.id),
          credential.dailyCredits,
          credential.dailyRequests,
        ],
      ] as const) {
        const spent = subset.reduce(
          (n, t) =>
            n +
            (['running', 'prepared'].includes(t.state) ? t.budget : t.charged),
          0
        );
        const count = subset.filter((t) =>
          ['generate', 'edit'].includes(t.operation)
        ).length;
        if (spent + budget > credits || count >= requests)
          throw new DeveloperError(
            'daily_budget_exceeded',
            'The account or credential daily budget is exhausted.',
            429
          );
      }
    }
    const [task] = await tx
      .insert(developerTasks)
      .values({
        id: randomUUID(),
        userId: principal.userId,
        credentialId: credential.id,
        idempotencyKey: key,
        requestHash,
        operation,
        diagramId,
        state: 'running',
        budget,
      })
      .returning();
    return { task, fresh: true };
  });
}
async function completeTask(task: Task): Promise<Task> {
  const prepared = task.result as unknown as Prepared;
  return (await getDb()).transaction(async (tx) => {
    await lockWallet(tx, task.userId);
    const [credential] = await tx
      .select()
      .from(developerCredentials)
      .where(eq(developerCredentials.id, task.credentialId))
      .for('update');
    await activeCredential(
      {
        userId: task.userId,
        credentialId: task.credentialId,
        scopes: credential?.scopes || [],
        channel: 'api',
      },
      tx
    );
    const [current] = await tx
      .select()
      .from(developerTasks)
      .where(eq(developerTasks.id, task.id))
      .for('update');
    if (current.state === 'succeeded') return current;
    if (current.state !== 'prepared')
      throw new DeveloperError(
        'task_closed',
        'Task is no longer ready to deliver.',
        409
      );
    const row = await persistDiagram(
      tx,
      task.userId,
      task.diagramId,
      prepared.title,
      prepared.document,
      prepared.expectedVersion,
      task.id
    );
    let charged = 0;
    if (task.budget > 0) {
      const result = { events: prepared.events };
      const resultHash = hash(JSON.stringify(result));
      await readyTask(
        task.id,
        task.userId,
        result,
        resultHash,
        prepared.calls,
        tx
      );
      charged = (await finalizeTask(task.userId, task.id, resultHash, tx))
        .charged;
    }
    const [done] = await tx
      .update(developerTasks)
      .set({ state: 'succeeded', charged, updatedAt: new Date() })
      .where(eq(developerTasks.id, task.id))
      .returning();
    return done;
  });
}
async function failTask(task: Task, error: unknown): Promise<void> {
  if (task.budget > 0) {
    const calls = (error as { calls?: ModelCallUsage[] })?.calls;
    if (calls)
      await recordTaskCalls(
        task.userId,
        task.id,
        calls.map((c) => ({ ...c, platformFunded: true }))
      );
    await finalizeTask(task.userId, task.id).catch((e) => {
      if (e?.code !== 'task_missing') throw e;
    });
  }
  await (await getDb())
    .update(developerTasks)
    .set({
      state: 'failed',
      error:
        error instanceof DeveloperError || error instanceof BillingError
          ? error.code
          : 'generation_failed',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(developerTasks.id, task.id),
        sql`${developerTasks.state} <> 'succeeded'`
      )
    );
}
async function recoverTask(task: Task): Promise<Task> {
  if (task.state === 'prepared') {
    try {
      return await completeTask(task);
    } catch (error) {
      if (error instanceof DeveloperError || error instanceof BillingError) {
        await failTask(task, error);
        return (
          await (
            await getDb()
          )
            .select()
            .from(developerTasks)
            .where(eq(developerTasks.id, task.id))
        )[0];
      }
      throw error; // Transient DB faults retain the prepared result for a later recovery.
    }
  }
  if (
    task.state === 'running' &&
    Date.now() - task.createdAt.getTime() > 6 * 60000
  ) {
    await failTask(
      task,
      new DeveloperError('execution_interrupted', 'Execution interrupted.', 409)
    );
    return (
      await (
        await getDb()
      )
        .select()
        .from(developerTasks)
        .where(eq(developerTasks.id, task.id))
    )[0];
  }
  return task;
}
export async function generate(
  principal: Principal,
  raw: unknown,
  idempotencyKey: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'diagrams:generate');
  requireScope(principal, 'diagrams:write');
  const input = generationSchema.parse(raw);
  const key = idempotencySchema.parse(idempotencyKey);
  if (input.image) validateImage(input.image);
  const operation = input.diagram_id ? 'edit' : 'generate';
  const requestHash = hash(JSON.stringify({ operation, input }));
  // Replay before reading the current file: later edits/deletion cannot invalidate a receipt.
  const replay = async (): Promise<Task | undefined> => {
    const [existing] = await (await getDb())
      .select()
      .from(developerTasks)
      .where(
        and(
          eq(developerTasks.userId, principal.userId),
          eq(developerTasks.idempotencyKey, key)
        )
      );
    if (existing && existing.requestHash !== requestHash)
      throw new DeveloperError(
        'idempotency_conflict',
        'This idempotency key was already used for another request.',
        409
      );
    return existing;
  };
  const existing = await replay();
  if (existing) return publicTask(await recoverTask(existing));
  const current = input.diagram_id
    ? await ownedDiagram(principal.userId, input.diagram_id)
    : null;
  const document = current
    ? nativeDocument(current.content)
    : {
        editorKind: 'drawio' as const,
        formatVersion: 1 as const,
        documentId: randomUUID(),
        revision: 0,
        diagramType: 'flowchart',
        xml: EMPTY_DRAWIO_XML,
      };
  // Quote the full context, not the caller's cap. A lower cap is never a discount.
  const budget = estimateTaskBudget({
    messages: [
      {
        role: 'user',
        content: input.image
          ? [
              { type: 'text', text: input.prompt },
              { type: 'image_url', image_url: { url: input.image } },
            ]
          : input.prompt,
      },
    ],
    aiContext: {
      editorKind: 'drawio',
      nativeDocument: document,
      mode: input.image ? 'image_to_flowchart' : 'text_to_flowchart',
    },
  });
  if (
    (current && diagramVersion(current) !== input.expected_version) ||
    input.max_credits < budget
  ) {
    // A concurrent identical request may have committed while this one read the file.
    const concurrent = await replay();
    if (concurrent) return publicTask(await recoverTask(concurrent));
    if (current && diagramVersion(current) !== input.expected_version)
      throw new DeveloperError(
        'version_conflict',
        'Diagram changed. Read it again before editing.',
        409
      );
    throw new DeveloperError(
      'max_credits_too_low',
      'The task estimate exceeds max_credits. Review required_credits before authorizing a higher cap.',
      409,
      budget
    );
  }
  const receipt = await newTask(
    principal,
    key,
    requestHash,
    operation,
    input.diagram_id || `flowchart_${randomUUID()}`,
    budget
  );
  if (!receipt.fresh) return publicTask(await recoverTask(receipt.task));
  const task = receipt.task;
  try {
    const moderation = await screenPromptWithCreem({
      prompt: input.prompt,
      externalId: `developer_${task.id}`,
    });
    if (moderation.decision === 'deny')
      throw new DeveloperError(
        'content_not_allowed',
        'This request cannot be processed.',
        403
      );
    await activeCredential(principal);
    const billing = await reserveTask({
      id: task.id,
      userId: principal.userId,
      requestHash: task.requestHash,
      budget,
    });
    const output = await runNativeTask(document, input, billing.legacy);
    validDocument(output.document);
    const prepared: Prepared = {
      ...output,
      title:
        current?.title || output.title?.trim().slice(0, 160) || 'Flowchart',
      expectedVersion: input.expected_version,
    };
    const [ready] = await (await getDb())
      .update(developerTasks)
      .set({
        state: 'prepared',
        result: prepared as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(
        and(eq(developerTasks.id, task.id), eq(developerTasks.state, 'running'))
      )
      .returning();
    if (!ready)
      throw new DeveloperError(
        'task_closed',
        'Task is no longer running.',
        409
      );
    return publicTask(await completeTask(ready));
  } catch (error) {
    // A prepared result survives transient DB outages. Replay the same key to recover it.
    const [stored] = await (await getDb())
      .select()
      .from(developerTasks)
      .where(eq(developerTasks.id, task.id));
    if (
      stored?.state === 'prepared' &&
      !(error instanceof DeveloperError || error instanceof BillingError)
    )
      throw error;
    await failTask(task, error);
    throw error;
  }
}
export async function save(
  principal: Principal,
  raw: unknown,
  key: string,
  id?: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'diagrams:write');
  const input = saveSchema.parse(raw);
  validDocument(input.document);
  if (id && !input.expected_version)
    throw new DeveloperError(
      'version_required',
      'Saving an existing diagram requires expected_version.'
    );
  const receipt = await newTask(
    principal,
    idempotencySchema.parse(key),
    hash(JSON.stringify({ operation: 'save', id, input })),
    'save',
    id || `flowchart_${randomUUID()}`,
    0
  );
  if (!receipt.fresh) return publicTask(await recoverTask(receipt.task));
  const prepared: Prepared = {
    document: input.document,
    title: input.title,
    expectedVersion: input.expected_version,
    calls: [],
    events: [],
  };
  const [ready] = await (await getDb())
    .update(developerTasks)
    .set({
      state: 'prepared',
      result: prepared as unknown as Record<string, unknown>,
    })
    .where(eq(developerTasks.id, receipt.task.id))
    .returning();
  try {
    return publicTask(await completeTask(ready));
  } catch (error) {
    if (error instanceof DeveloperError || error instanceof BillingError)
      await failTask(ready, error);
    throw error;
  }
}
export async function readTask(
  principal: Principal,
  id: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'tasks:read');
  const [task] = await (await getDb())
    .select()
    .from(developerTasks)
    .where(
      and(
        eq(developerTasks.id, id),
        eq(developerTasks.userId, principal.userId)
      )
    );
  if (!task) throw new DeveloperError('not_found', 'Task not found.', 404);
  const result = publicTask(await recoverTask(task));
  if (!principal.scopes.includes('diagrams:read')) result.diagram = undefined;
  return result;
}
export async function listTasks(
  principal: Principal,
  cursor?: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'tasks:read');
  const rows = await (await getDb())
    .select()
    .from(developerTasks)
    .where(
      and(
        eq(developerTasks.userId, principal.userId),
        ...(cursor ? [lt(developerTasks.id, cursor)] : [])
      )
    )
    .orderBy(desc(developerTasks.id))
    .limit(21);
  return {
    data: rows.slice(0, 20).map((t) => {
      const result = publicTask(t);
      result.diagram = undefined;
      return result;
    }),
    next_cursor: rows.length > 20 ? rows[19].id : null,
  };
}
