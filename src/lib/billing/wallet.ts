/** [INPUT] Authenticated user, server offers and task usage. [OUTPUT] Atomic, idempotent wallet transitions. */
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  aiUsage,
  billingSubscriptions,
  billingTasks,
  creditBuckets,
  creditsHistory,
  flowcharts,
  payment,
  user,
} from '@/db/schema';
import { drawioDocumentSchema } from '@/lib/drawio/contracts';
import {
  readNativeCells,
  validateDrawioXml,
} from '@/lib/drawio/native-document';
import { and, asc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import {
  FIRST_DIAGRAM_COMPUTE_LIMIT,
  FIRST_DIAGRAM_MAX_ATTEMPTS_PER_DAY,
  type ModelCallUsage,
  OFFERS,
  RATE_VERSION,
  SIGNUP_TRIAL_CREDITS,
  creditsForCalls,
  hasPaidAccess,
  isOfferKey,
  legacyPlanForPayment,
  registrationCredits,
  subscriptionCreditWindow,
} from './policy';
export type BillingTx = Parameters<
  Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]
>[0];
type Allocation = { id: string; amount: number };
export class BillingError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}
export async function lockWallet(tx: BillingTx, userId: string): Promise<void> {
  const rows = await tx
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .for('update');
  if (!rows[0]) throw new BillingError('user_missing', 'User not found', 404);
  const existing = await tx
    .select({ id: creditBuckets.id })
    .from(creditBuckets)
    .where(eq(creditBuckets.sourceKey, `legacy:${userId}`));
  if (!existing.length) {
    const credits = Math.max(0, rows[0].credits ?? 0);
    await tx.insert(creditBuckets).values({
      id: randomUUID(),
      userId,
      source: 'legacy',
      sourceKey: `legacy:${userId}`,
      granted: credits,
      remaining: credits,
    });
    // Snapshot only. Do not rewrite or add historical ledger entries.
  }
}
export async function grantBucket(
  tx: BillingTx,
  args: {
    userId: string;
    amount: number;
    source: string;
    sourceKey: string;
    expiresAt?: Date;
    paymentId?: string;
  }
): Promise<boolean> {
  if (!Number.isSafeInteger(args.amount) || args.amount <= 0)
    throw new Error('Invalid grant');
  const created = await tx
    .insert(creditBuckets)
    .values({
      id: randomUUID(),
      userId: args.userId,
      source: args.source,
      sourceKey: args.sourceKey,
      granted: args.amount,
      remaining: args.amount,
      expiresAt: args.expiresAt,
      paymentId: args.paymentId,
    })
    .onConflictDoNothing({ target: creditBuckets.sourceKey })
    .returning({ id: creditBuckets.id });
  if (!created.length) return false;
  await tx
    .update(user)
    .set({ credits: sql`coalesce(${user.credits},0)+${args.amount}` })
    .where(eq(user.id, args.userId));
  await tx.insert(creditsHistory).values({
    id: randomUUID(),
    userId: args.userId,
    amount: args.amount,
    type: 'add',
    description: args.source,
    metadata: {
      billingV1: true,
      sourceKey: args.sourceKey,
      paymentId: args.paymentId,
    },
  });
  return true;
}
async function expireBuckets(
  tx: BillingTx,
  userId: string,
  now: Date
): Promise<void> {
  const rows = await tx
    .select()
    .from(creditBuckets)
    .where(
      and(
        eq(creditBuckets.userId, userId),
        sql`${creditBuckets.expiresAt} <= ${now.toISOString()}`,
        gt(creditBuckets.remaining, 0)
      )
    );
  for (const b of rows) {
    await tx
      .update(creditBuckets)
      .set({ remaining: 0 })
      .where(eq(creditBuckets.id, b.id));
    await tx
      .update(user)
      .set({ credits: sql`${user.credits}-${b.remaining}` })
      .where(eq(user.id, userId));
    await tx.insert(creditsHistory).values({
      id: randomUUID(),
      userId,
      amount: b.remaining,
      type: 'subtract',
      description: 'Expired credits',
      metadata: { billingV1: true, bucketId: b.id },
    });
  }
}
export async function refreshWallet(
  tx: BillingTx,
  userId: string,
  now = new Date()
): Promise<void> {
  await lockWallet(tx, userId);
  const cutover = process.env.BILLING_V1_START_AT;
  if (cutover && Number.isFinite(new Date(cutover).getTime())) {
    const [owner] = await tx
      .select({ createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, userId));
    if (owner.createdAt >= new Date(cutover))
      await grantBucket(tx, {
        userId,
        amount: registrationCredits(owner.createdAt),
        source: 'registration',
        sourceKey: `registration:${userId}`,
        expiresAt: new Date(owner.createdAt.getTime() + 30 * 86400000),
      });
  }
  const abandoned = await tx
    .select()
    .from(billingTasks)
    .where(
      and(
        eq(billingTasks.userId, userId),
        inArray(billingTasks.state, ['running', 'ready']),
        sql`${billingTasks.expiresAt} <= ${now.toISOString()}`
      )
    );
  for (const task of abandoned) await releaseTaskLocked(tx, task, now);
  await expireBuckets(tx, userId, now);
  const subscriptions = await tx
    .select()
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.userId, userId),
        gt(billingSubscriptions.paidThrough, now),
        inArray(billingSubscriptions.status, [
          'active',
          'canceling',
          'canceled',
          'past_due',
        ])
      )
    );
  for (const subscription of subscriptions) {
    if (!isOfferKey(subscription.offerKey))
      throw new Error('Unknown subscription offer');
    const month = subscriptionCreditWindow(
      subscription.offerKey,
      subscription.anchor,
      subscription.paidThrough,
      now
    );
    if (month)
      await grantBucket(tx, {
        userId,
        amount: OFFERS[subscription.offerKey].credits,
        source: 'subscription',
        sourceKey: `subscription:${subscription.id}:${month.start.toISOString()}`,
        expiresAt: month.end,
        paymentId: `${subscription.id}:${subscription.anchor.toISOString()}`,
      });
  }
}
export async function getLegacyEntitlement(
  tx: BillingTx,
  userId: string,
  now = new Date()
): Promise<{ plan: string; limit: number; manual?: boolean } | null> {
  const rows = await tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.provider, 'creem'),
        eq(payment.type, 'subscription'),
        gt(payment.periodEnd, now)
      )
    );
  const valid = rows.filter((p) => hasPaidAccess(p, now));
  if (!valid.length) return null;
  // Unknown historical product must not remove paid access. Rollout audit resolves its snapshot before launch.
  const professional = valid.some((p) => legacyPlanForPayment(p) !== 'hobby');
  return {
    plan: professional ? 'professional' : 'hobby',
    limit: professional ? 9999 : 100,
    manual: valid.every((p) =>
      /manual/i.test(p.subscriptionId || p.customerId || p.id)
    ),
  };
}
export async function legacyRequestsRemaining(
  tx: BillingTx,
  userId: string,
  limit: number,
  now = new Date()
): Promise<number> {
  const month = new Date(now);
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const [usage] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.success, true),
        gte(aiUsage.createdAt, month)
      )
    );
  return Math.max(0, limit - Number(usage.count));
}
export async function firstDiagramEligible(
  tx: BillingTx,
  userId: string
): Promise<boolean> {
  const [registration] = await tx
    .select({ id: creditBuckets.id })
    .from(creditBuckets)
    .where(
      and(
        eq(creditBuckets.userId, userId),
        eq(creditBuckets.source, 'registration')
      )
    );
  if (!registration) return false;
  const [delivered] = await tx
    .select({ id: billingTasks.id })
    .from(billingTasks)
    .where(
      and(
        eq(billingTasks.userId, userId),
        eq(billingTasks.state, 'committed'),
        sql`${billingTasks.result}->'events' @> '[{"type":"tool-call","args":{"kind":"drawio-command"}}]'::jsonb`
      )
    )
    .limit(1);
  return !delivered;
}
export async function walletSummary(userId: string): Promise<{
  balance: number;
  reserved: number;
  firstDiagramEligible: boolean;
  legacy: { plan: string; limit: number; manual?: boolean } | null;
  buckets: unknown[];
}> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await refreshWallet(tx, userId);
    const [owner] = await tx
      .select({ balance: user.credits })
      .from(user)
      .where(eq(user.id, userId));
    const buckets = await tx
      .select()
      .from(creditBuckets)
      .where(eq(creditBuckets.userId, userId))
      .orderBy(asc(creditBuckets.expiresAt));
    return {
      balance: owner?.balance ?? 0,
      reserved: buckets.reduce((n, b) => n + b.reserved, 0),
      firstDiagramEligible: await firstDiagramEligible(tx, userId),
      legacy: await getLegacyEntitlement(tx, userId),
      buckets: buckets
        .filter((b) => b.remaining > 0 || b.reserved > 0)
        .map((b) => ({
          source: b.source,
          remaining: b.remaining,
          expiresAt: b.expiresAt,
        })),
    };
  });
}
export async function grantRegistration(userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await lockWallet(tx, userId);
    const [owner] = await tx
      .select({ createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, userId));
    await grantBucket(tx, {
      userId,
      amount: registrationCredits(owner.createdAt),
      source: 'registration',
      sourceKey: `registration:${userId}`,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
  });
}
export async function reserveTask(args: {
  id: string;
  userId: string;
  requestHash: string;
  budget: number;
  allowFirstDiagram?: boolean;
}): Promise<typeof billingTasks.$inferSelect> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await refreshWallet(tx, args.userId);
    const [existing] = await tx
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, args.id));
    if (existing) {
      if (
        existing.userId !== args.userId ||
        existing.requestHash !== args.requestHash
      )
        throw new BillingError(
          'task_conflict',
          'Task does not match this request'
        );
      if (existing.state === 'running')
        throw new BillingError('task_running', 'Your request is still running');
      return existing;
    }
    const [running] = await tx
      .select()
      .from(billingTasks)
      .where(
        and(
          eq(billingTasks.userId, args.userId),
          inArray(billingTasks.state, ['running', 'ready'])
        )
      );
    if (running)
      throw new BillingError(
        'task_running',
        'Finish or cancel the current AI request first'
      );
    if (
      !Number.isSafeInteger(args.budget) ||
      args.budget < 1 ||
      args.budget > 2000
    )
      throw new BillingError('invalid_budget', 'Invalid task budget', 400);
    const entitlement = await getLegacyEntitlement(tx, args.userId);
    const legacy = Boolean(
      entitlement &&
        (await legacyRequestsRemaining(tx, args.userId, entitlement.limit)) > 0
    );
    const firstDiagram =
      !legacy &&
      args.allowFirstDiagram === true &&
      (await firstDiagramEligible(tx, args.userId));
    if (firstDiagram) {
      if (args.budget > FIRST_DIAGRAM_COMPUTE_LIMIT)
        throw new BillingError(
          'first_diagram_too_large',
          'Please start with a smaller diagram or a shorter description. Your first-diagram credits are safe.',
          413
        );
      const [attempts] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(billingTasks)
        .where(
          and(
            eq(billingTasks.userId, args.userId),
            eq(billingTasks.firstDiagram, true),
            gte(billingTasks.createdAt, new Date(Date.now() - 86400000))
          )
        );
      if (Number(attempts.count) >= FIRST_DIAGRAM_MAX_ATTEMPTS_PER_DAY)
        throw new BillingError(
          'first_diagram_retry_limit',
          'Your first-diagram credits are safe. Please retry tomorrow or contact support.',
          429
        );
    }
    let budget = args.budget;
    const allocations: Allocation[] = [];
    if (!legacy) {
      const [owner] = await tx
        .select()
        .from(user)
        .where(eq(user.id, args.userId));
      if (firstDiagram)
        budget = Math.min(SIGNUP_TRIAL_CREDITS, owner.credits ?? 0);
      if (
        !firstDiagram &&
        args.allowFirstDiagram === true &&
        (owner.credits ?? 0) > 0 &&
        (owner.credits ?? 0) < budget &&
        args.budget <= FIRST_DIAGRAM_COMPUTE_LIMIT
      ) {
        const [trial] = await tx
          .select({
            remaining: sql<number>`coalesce(sum(${creditBuckets.remaining}),0)`,
          })
          .from(creditBuckets)
          .where(
            and(
              eq(creditBuckets.userId, args.userId),
              eq(creditBuckets.source, 'registration')
            )
          );
        // Trial credits remain usable after successful delivery; do not strand a small remainder behind a conservative estimate.
        if (Number(trial.remaining) === owner.credits) budget = owner.credits!;
      }
      if ((owner.credits ?? 0) < budget)
        throw new BillingError(
          'insufficient_credits',
          'Not enough credits. Buy credits to continue.',
          402
        );
      const buckets = await tx
        .select()
        .from(creditBuckets)
        .where(
          and(
            eq(creditBuckets.userId, args.userId),
            gt(creditBuckets.remaining, 0)
          )
        )
        .orderBy(
          sql`${creditBuckets.expiresAt} ASC NULLS LAST`,
          asc(creditBuckets.createdAt)
        );
      let needed = budget;
      for (const b of buckets) {
        const amount = Math.min(needed, b.remaining);
        if (!amount) break;
        allocations.push({ id: b.id, amount });
        await tx
          .update(creditBuckets)
          .set({
            remaining: b.remaining - amount,
            reserved: b.reserved + amount,
          })
          .where(eq(creditBuckets.id, b.id));
        needed -= amount;
      }
      if (needed) throw new Error('Wallet bucket balance mismatch');
      await tx
        .update(user)
        .set({ credits: sql`${user.credits}-${budget}` })
        .where(eq(user.id, args.userId));
    }
    const [task] = await tx
      .insert(billingTasks)
      .values({
        id: args.id,
        userId: args.userId,
        requestHash: args.requestHash,
        budget,
        firstDiagram,
        state: 'running',
        legacy,
        allocations,
        rateVersion: RATE_VERSION,
        expiresAt: new Date(Date.now() + 20 * 60000),
      })
      .returning();
    return task;
  });
}
export async function readyTask(
  id: string,
  userId: string,
  result: unknown,
  resultHash: string,
  calls: ModelCallUsage[],
  transaction?: BillingTx
): Promise<void> {
  const charge = creditsForCalls(calls);
  const db = await getDb();
  const complete = async (tx: BillingTx): Promise<void> => {
    await lockWallet(tx, userId);
    const [task] = await tx
      .select()
      .from(billingTasks)
      .where(and(eq(billingTasks.id, id), eq(billingTasks.userId, userId)));
    if (!task || task.state !== 'running')
      throw new BillingError('task_closed', 'Task is no longer running');
    // Valid complete result is delivered, with no surprise over-cap debit; excess compute is platform-funded.
    await tx
      .update(billingTasks)
      .set({
        state: 'ready',
        result: result as Record<string, unknown>,
        resultHash,
        calls,
        charged:
          task.legacy || (task.firstDiagram && !(result as any)?.delivery)
            ? 0
            : Math.min(charge, task.budget),
        updatedAt: new Date(),
      })
      .where(eq(billingTasks.id, id));
  };
  if (transaction) await complete(transaction);
  else await db.transaction(complete);
}
async function releaseTaskLocked(
  tx: BillingTx,
  task: typeof billingTasks.$inferSelect,
  now: Date,
  charge = 0
): Promise<void> {
  let spend = charge;
  let returned = 0;
  for (const a of task.allocations as Allocation[]) {
    const [bucket] = await tx
      .select()
      .from(creditBuckets)
      .where(eq(creditBuckets.id, a.id));
    const used = Math.min(a.amount, spend);
    spend -= used;
    const refund =
      bucket.expiresAt && bucket.expiresAt <= now ? 0 : a.amount - used;
    returned += refund;
    await tx
      .update(creditBuckets)
      .set({
        reserved: bucket.reserved - a.amount,
        remaining: bucket.remaining + refund,
      })
      .where(eq(creditBuckets.id, a.id));
    const expired = a.amount - used - refund;
    if (expired)
      await tx.insert(creditsHistory).values({
        id: randomUUID(),
        userId: task.userId,
        amount: expired,
        type: 'subtract',
        description: 'Expired unused reservation',
        metadata: { billingV1: true, taskId: task.id, bucketId: a.id },
      });
  }
  if (returned)
    await tx
      .update(user)
      .set({ credits: sql`${user.credits}+${returned}` })
      .where(eq(user.id, task.userId));
  await tx
    .update(billingTasks)
    .set({
      state: charge || task.legacy ? 'committed' : 'released',
      charged: charge,
      updatedAt: now,
    })
    .where(eq(billingTasks.id, task.id));
}
export async function finalizeTask(
  userId: string,
  id: string,
  resultHash?: string,
  transaction?: BillingTx,
  deliveryFileId?: string
): Promise<{ charged: number; state: string }> {
  const db = await getDb();
  const complete = async (
    tx: BillingTx
  ): Promise<{ charged: number; state: string }> => {
    await lockWallet(tx, userId);
    const [task] = await tx
      .select()
      .from(billingTasks)
      .where(and(eq(billingTasks.id, id), eq(billingTasks.userId, userId)));
    if (!task) throw new BillingError('task_missing', 'Task not found', 404);
    if (['committed', 'released'].includes(task.state))
      return { charged: task.charged, state: task.state };
    if (resultHash) {
      if (task.state !== 'ready' || resultHash !== task.resultHash)
        throw new BillingError('invalid_receipt', 'Result is not ready');
      if (task.firstDiagram && (task.result as any)?.delivery) {
        const delivery = (task.result as any).delivery;
        const [saved] = deliveryFileId
          ? await tx
              .select()
              .from(flowcharts)
              .where(
                and(
                  eq(flowcharts.id, deliveryFileId),
                  eq(flowcharts.userId, userId)
                )
              )
          : [];
        const document = saved
          ? drawioDocumentSchema.safeParse(JSON.parse(saved.content))
          : null;
        if (
          !document?.success ||
          document.data.documentId !== delivery.documentId ||
          document.data.revision < delivery.revision
        )
          throw new BillingError(
            'delivery_unconfirmed',
            'Save the usable diagram before confirming delivery'
          );
        validateDrawioXml(document.data.xml, document.data.pageId);
        const cells = readNativeCells(document.data);
        const visible = cells.filter(
          (c) =>
            c.parent &&
            c.parent !== '0' &&
            Number(c.geometry.width) > 0 &&
            Number(c.geometry.height) > 0
        );
        if (
          !visible.length ||
          !delivery.nodeIds.every((id: string) =>
            cells.some((c) => c.id === id)
          )
        )
          throw new BillingError(
            'delivery_unconfirmed',
            'The saved diagram does not contain this result'
          );
      }
      await releaseTaskLocked(tx, task, new Date(), task.charged);
      // Zero-cost legacy results are still committed; release/cancel explicitly overrides below.
      await tx
        .update(billingTasks)
        .set({ state: 'committed' })
        .where(eq(billingTasks.id, id));
      const calls = task.calls as ModelCallUsage[];
      await tx
        .insert(aiUsage)
        .values({
          id: `billing:${id}`,
          userId,
          type:
            task.legacy &&
            !(task.result as any)?.events?.some(
              (e: any) => e.type === 'tool-call'
            )
              ? 'canvas_analysis'
              : 'flowchart_generation',
          tokensUsed: calls.reduce((n, c) => n + c.input + c.output, 0),
          model: calls[0]?.model,
          success: true,
          metadata: {
            billingV1: true,
            taskId: id,
            charged: task.charged,
            rateVersion: task.rateVersion,
            calls,
          },
        })
        .onConflictDoNothing();
      if (task.charged)
        await tx.insert(creditsHistory).values({
          id: randomUUID(),
          userId,
          amount: task.charged,
          type: 'subtract',
          description: 'AI task',
          metadata: {
            billingV1: true,
            taskId: id,
            rateVersion: task.rateVersion,
          },
        });
      return { charged: task.charged, state: 'committed' };
    }
    await releaseTaskLocked(tx, task, new Date());
    await tx
      .update(billingTasks)
      .set({ state: 'released' })
      .where(eq(billingTasks.id, id));
    return { charged: 0, state: 'released' };
  };
  return transaction ? complete(transaction) : db.transaction(complete);
}

export async function recordTaskCalls(
  userId: string,
  id: string,
  calls: ModelCallUsage[]
): Promise<void> {
  const db = await getDb();
  await db
    .update(billingTasks)
    .set({ calls, updatedAt: new Date() })
    .where(and(eq(billingTasks.id, id), eq(billingTasks.userId, userId)));
}
