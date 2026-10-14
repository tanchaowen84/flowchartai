import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  billingCheckouts,
  billingSubscriptions,
  billingTasks,
  creditBuckets,
  creditsHistory,
  payment,
  user,
} from '@/db/schema';
import { processWaffoEvent } from '@/payment/provider/waffo';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { monthAnniversary } from './policy';
import {
  finalizeTask,
  grantBucket,
  grantRegistration,
  legacyRequestsRemaining,
  lockWallet,
  readyTask,
  reserveTask,
  walletSummary,
} from './wallet';
const enabled = Boolean(process.env.BILLING_TEST_DATABASE_URL);
describe.skipIf(!enabled)('real local Postgres billing transactions', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  const users: string[] = [];
  beforeAll(async () => {
    const url = new URL(process.env.BILLING_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '55438' ||
      url.pathname !== '/flowchart_billing_test'
    )
      throw new Error('Refusing non-test database');
    process.env.DATABASE_URL = url.toString();
    process.env.WAFFO_ENVIRONMENT = 'test';
    process.env.WAFFO_STORE_ID = 'STO_fixture';
    db = await getDb();
  });
  afterAll(async () => {
    for (const id of users) await db.delete(user).where(eq(user.id, id));
  });
  async function owner(credits = 0) {
    const id = `billing-test-${randomUUID()}`;
    users.push(id);
    await db.insert(user).values({
      id,
      name: 'Billing fixture',
      email: `${id}@example.invalid`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      credits,
    });
    return id;
  }
  const task = (id: string, budget = 32) => ({
    id: randomUUID(),
    userId: id,
    requestHash: 'fixture',
    budget,
  });
  async function done(args: ReturnType<typeof task>, input = 1000) {
    await readyTask(args.id, args.userId, { text: 'valid' }, 'receipt', [
      { model: 'deepseek/deepseek-v4-pro', input, cached: 0, output: 500 },
    ]);
    return finalizeTask(args.userId, args.id, 'receipt');
  }
  it('preserves old balance and ledger exactly on wallet import', async () => {
    const id = await owner(777);
    await db.insert(creditsHistory).values({
      id: randomUUID(),
      userId: id,
      amount: 777,
      type: 'add',
      description: 'Old grant',
    });
    expect((await walletSummary(id)).balance).toBe(777);
    expect(
      (
        await db
          .select()
          .from(creditsHistory)
          .where(eq(creditsHistory.userId, id))
      ).length
    ).toBe(1);
  });
  it('grants registration once, with 30-day expiry', async () => {
    const id = await owner();
    await Promise.all([grantRegistration(id), grantRegistration(id)]);
    expect((await walletSummary(id)).balance).toBe(200);
    const [b] = await db
      .select()
      .from(creditBuckets)
      .where(eq(creditBuckets.sourceKey, `registration:${id}`));
    expect(b.expiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * 86400000);
  });
  it('reserves concurrently only once and settles real usage idempotently', async () => {
    const id = await owner(100);
    const a = task(id);
    const outcomes = await Promise.allSettled([
      reserveTask(a),
      reserveTask(task(id)),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const won = outcomes.find(
      (r) => r.status === 'fulfilled'
    ) as PromiseFulfilledResult<any>;
    await readyTask(won.value.id, id, { text: 'valid' }, 'receipt', [
      {
        model: 'deepseek/deepseek-v4-pro',
        input: 1000,
        cached: 0,
        output: 500,
      },
    ]);
    expect(await finalizeTask(id, won.value.id, 'receipt')).toMatchObject({
      charged: 4,
    });
    expect(await finalizeTask(id, won.value.id, 'receipt')).toMatchObject({
      charged: 4,
    });
    expect((await walletSummary(id)).balance).toBe(96);
  });
  it('returns failed/canceled reservation without charging', async () => {
    const id = await owner(100);
    const a = task(id);
    await reserveTask(a);
    await finalizeTask(id, a.id);
    await finalizeTask(id, a.id);
    expect((await walletSummary(id)).balance).toBe(100);
  });
  it('caps settlement and preserves complete results', async () => {
    const id = await owner(100);
    const a = task(id, 32);
    await reserveTask(a);
    expect((await done(a, 100000)).charged).toBe(32);
    expect((await walletSummary(id)).balance).toBe(68);
  });
  it('uses earliest expiry before permanent balance', async () => {
    const id = await owner(100);
    await db.transaction(async (tx) => {
      await lockWallet(tx, id);
      await grantBucket(tx, {
        userId: id,
        amount: 20,
        source: 'subscription',
        sourceKey: randomUUID(),
        expiresAt: new Date(Date.now() + 86400000),
      });
    });
    const a = task(id, 32);
    await reserveTask(a);
    await done(a);
    const [permanent] = await db
      .select()
      .from(creditBuckets)
      .where(eq(creditBuckets.sourceKey, `legacy:${id}`));
    expect(permanent.remaining).toBe(100);
    expect((await walletSummary(id)).balance).toBe(116);
  });
  it('settles cross-month reservation against its original bucket', async () => {
    const id = await owner();
    await db.transaction(async (tx) => {
      await lockWallet(tx, id);
      await grantBucket(tx, {
        userId: id,
        amount: 40,
        source: 'subscription',
        sourceKey: 'cross-' + id,
        expiresAt: new Date(Date.now() + 86400000),
      });
    });
    const a = task(id, 32);
    await reserveTask(a);
    await db
      .update(creditBuckets)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(creditBuckets.sourceKey, 'cross-' + id));
    await done(a);
    expect((await walletSummary(id)).balance).toBe(0);
  });
  it('retains old professional/canceled paid-period quota without credit debit', async () => {
    const id = await owner(12);
    await db.insert(payment).values({
      id: randomUUID(),
      userId: id,
      customerId: 'legacy',
      provider: 'creem',
      legacyPlan: 'professional',
      priceId: 'old-retired',
      type: 'subscription',
      status: 'canceled',
      cancelAtPeriodEnd: true,
      periodEnd: monthAnniversary(new Date(), 1),
    });
    expect((await walletSummary(id)).legacy).toMatchObject({ limit: 9999 });
    const a = task(id);
    await reserveTask(a);
    expect((await done(a)).charged).toBe(0);
    expect((await walletSummary(id)).balance).toBe(12);
    expect(
      await db.transaction((tx) => legacyRequestsRemaining(tx, id, 9999))
    ).toBe(9999);
    const drawing = task(id);
    await reserveTask(drawing);
    await readyTask(
      drawing.id,
      id,
      { events: [{ type: 'tool-call', args: { kind: 'drawio-command' } }] },
      'drawing-receipt',
      [
        {
          model: 'deepseek/deepseek-v4-pro',
          input: 1000,
          cached: 0,
          output: 500,
        },
      ]
    );
    await finalizeTask(id, drawing.id, 'drawing-receipt');
    expect(
      await db.transaction((tx) => legacyRequestsRemaining(tx, id, 9999))
    ).toBe(9998);
    expect((await walletSummary(id)).balance).toBe(12);
  });
  async function checkout(id: string, key = 'pack_small') {
    const cid = randomUUID();
    await db
      .insert(billingCheckouts)
      .values({ id: cid, userId: id, offerKey: key, environment: 'test' });
    return cid;
  }
  function event(
    cid: string,
    id: string,
    kind = 'order.completed',
    order = randomUUID(),
    key = 'pack_small'
  ): any {
    return {
      id: randomUUID(),
      eventId: order,
      eventType: kind,
      timestamp: new Date().toISOString(),
      storeId: 'STO_fixture',
      mode: 'test',
      data: {
        orderId: order,
        orderMerchantExternalId: cid,
        merchantProvidedBuyerIdentity: id,
        orderMetadata: { offerKey: key },
        currency: 'USD',
        amount: '10.00',
        paymentId: 'PAY_' + order,
        paymentStatus: 'succeeded',
        periodNumber: 1,
      },
    };
  }
  it('grants duplicate pack deliveries once and keeps packs permanent', async () => {
    const id = await owner(7);
    const cid = await checkout(id);
    const e = event(cid, id);
    await Promise.all([processWaffoEvent(e), processWaffoEvent(e)]);
    await processWaffoEvent({
      ...e,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
    expect((await walletSummary(id)).balance).toBe(1507);
  });
  it('rejects wrong environment/identity/amount and leaves balance intact', async () => {
    const id = await owner(7);
    const cid = await checkout(id);
    const e = event(cid, id);
    await expect(processWaffoEvent({ ...e, mode: 'prod' })).rejects.toThrow();
    await expect(
      processWaffoEvent({
        ...e,
        data: { ...e.data, merchantProvidedBuyerIdentity: 'another' },
      })
    ).rejects.toThrow();
    await expect(
      processWaffoEvent({ ...e, data: { ...e.data, amount: '0.01' } })
    ).rejects.toThrow();
    expect((await walletSummary(id)).balance).toBe(7);
  });
  it('annual activation grants only current month and cancellation keeps paid year', async () => {
    const id = await owner();
    const cid = await checkout(id, 'pro_year');
    const e = event(
      cid,
      id,
      'subscription.activated',
      randomUUID(),
      'pro_year'
    );
    e.data = {
      ...e.data,
      amount: '190.00',
      billingPeriod: 'yearly',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: monthAnniversary(new Date(), 12).toISOString(),
    };
    await processWaffoEvent(e);
    expect((await walletSummary(id)).balance).toBe(6000);
    await processWaffoEvent({
      ...e,
      id: randomUUID(),
      eventType: 'subscription.payment_succeeded',
    });
    expect((await walletSummary(id)).balance).toBe(6000);
    await processWaffoEvent({
      ...e,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: 'subscription.canceling',
    });
    expect((await walletSummary(id)).balance).toBe(6000);
    const [sub] = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.id, e.data.orderId));
    expect(sub.status).toBe('canceling');
  });
  it('refund revokes only the matched purchase and retains old balance', async () => {
    const id = await owner(77);
    const cid = await checkout(id);
    const e = event(cid, id);
    await processWaffoEvent(e);
    await processWaffoEvent({
      ...e,
      id: randomUUID(),
      eventId: randomUUID(),
      eventType: 'refund.succeeded',
    });
    expect((await walletSummary(id)).balance).toBe(77);
  });
  it('rejects other users settling or reusing a task', async () => {
    const a = await owner(100);
    const b = await owner(100);
    const t = task(a);
    await reserveTask(t);
    await expect(finalizeTask(b, t.id, 'receipt')).rejects.toThrow();
    await expect(reserveTask({ ...t, userId: b })).rejects.toThrow();
    await finalizeTask(a, t.id);
  });
});
