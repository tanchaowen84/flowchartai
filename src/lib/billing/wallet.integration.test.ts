import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  billingCheckouts,
  billingSubscriptions,
  billingTasks,
  creditBuckets,
  creditsHistory,
  flowcharts,
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
      !(
        (url.port === '55438' && url.pathname === '/flowchart_billing_test') ||
        (url.port === '55469' && url.pathname === '/flowchart_paywall_test')
      )
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
  it('admits a new 20-credit first diagram without the normal 60-credit reserve and refunds failure', async () => {
    const id = await owner();
    await db.update(user).set({ createdAt: new Date() }).where(eq(user.id, id));
    await grantRegistration(id);
    expect((await walletSummary(id)).balance).toBe(20);
    const a = { ...task(id, 60), allowFirstDiagram: true };
    const first = await reserveTask(a);
    expect(first.firstDiagram).toBe(true);
    expect(first.budget).toBe(20);
    expect((await walletSummary(id)).balance).toBe(0);
    await finalizeTask(id, a.id);
    expect((await walletSummary(id)).balance).toBe(20);
    expect((await walletSummary(id)).firstDiagramEligible).toBe(true);
  });
  it('does not charge a text-only first answer or consume first diagram eligibility', async () => {
    const id = await owner();
    await db.update(user).set({ createdAt: new Date() }).where(eq(user.id, id));
    await grantRegistration(id);
    const a = { ...task(id, 60), allowFirstDiagram: true };
    await reserveTask(a);
    await readyTask(
      a.id,
      id,
      { events: [{ type: 'text', content: 'Which approval steps?' }] },
      'clarify',
      [
        {
          model: 'deepseek/deepseek-v4-pro',
          input: 1000,
          cached: 0,
          output: 500,
        },
      ]
    );
    expect((await finalizeTask(id, a.id, 'clarify')).charged).toBe(0);
    expect((await walletSummary(id)).balance).toBe(20);
    expect((await walletSummary(id)).firstDiagramEligible).toBe(true);
  });
  it('caps a saved first diagram at 20, verifies owner and delivery, and preserves the grant on failed acknowledgement', async () => {
    const id = await owner();
    const other = await owner();
    await db.update(user).set({ createdAt: new Date() }).where(eq(user.id, id));
    await grantRegistration(id);
    const a = { ...task(id, 60), allowFirstDiagram: true };
    await reserveTask(a);
    const document = {
      editorKind: 'drawio',
      formatVersion: 1,
      documentId: 'first-document',
      revision: 1,
      diagramType: 'flowchart',
      xml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n" value="Start" vertex="1" parent="1"><mxGeometry x="20" y="20" width="100" height="50" as="geometry"/></mxCell></root></mxGraphModel>',
    };
    const result = {
      delivery: {
        documentId: document.documentId,
        revision: 1,
        nodeIds: ['n'],
      },
      events: [{ type: 'tool-call', args: { kind: 'drawio-command' } }],
    };
    await readyTask(a.id, id, result, 'first-receipt', [
      {
        model: 'deepseek/deepseek-v4-pro',
        input: 6000,
        cached: 0,
        output: 4000,
      },
    ]);
    await expect(finalizeTask(id, a.id, 'first-receipt')).rejects.toMatchObject(
      { code: 'delivery_unconfirmed' }
    );
    const file = `first-${randomUUID()}`;
    await db.insert(flowcharts).values({
      id: file,
      userId: other,
      title: 'First',
      content: JSON.stringify(document),
    });
    await expect(
      finalizeTask(id, a.id, 'first-receipt', undefined, file)
    ).rejects.toMatchObject({ code: 'delivery_unconfirmed' });
    await db
      .update(flowcharts)
      .set({ userId: id })
      .where(eq(flowcharts.id, file));
    expect(
      await finalizeTask(id, a.id, 'first-receipt', undefined, file)
    ).toMatchObject({ charged: 20, state: 'committed' });
    expect(
      await finalizeTask(id, a.id, 'first-receipt', undefined, file)
    ).toMatchObject({ charged: 20 });
    expect((await walletSummary(id)).firstDiagramEligible).toBe(false);
    expect((await walletSummary(id)).balance).toBe(0);
  });
  it('keeps a previously granted 200-credit trial when registration grant is retried', async () => {
    const id = await owner();
    await db.transaction(async (tx) => {
      await lockWallet(tx, id);
      await grantBucket(tx, {
        userId: id,
        amount: 200,
        source: 'registration',
        sourceKey: `registration:${id}`,
        expiresAt: new Date(Date.now() + 86400000),
      });
    });
    await grantRegistration(id);
    expect((await walletSummary(id)).balance).toBe(200);
  });
  it('retains first-diagram protection after trial expiry, but bounds repeated failed attempts', async () => {
    const id = await owner();
    await grantRegistration(id);
    await db
      .update(creditBuckets)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(creditBuckets.userId, id));
    expect((await walletSummary(id)).balance).toBe(0);
    for (let i = 0; i < 5; i++) {
      const a = { ...task(id, 60), allowFirstDiagram: true };
      expect((await reserveTask(a)).budget).toBe(0);
      await finalizeTask(id, a.id);
    }
    await expect(
      reserveTask({ ...task(id, 60), allowFirstDiagram: true })
    ).rejects.toMatchObject({
      code: 'first_diagram_retry_limit',
    });
    expect((await walletSummary(id)).firstDiagramEligible).toBe(true);
  });
  it('spends the remaining trial by actual usage instead of blocking it behind a large estimate', async () => {
    const id = await owner();
    await grantRegistration(id);
    await db.insert(billingTasks).values({
      id: randomUUID(),
      userId: id,
      requestHash: 'delivered',
      state: 'committed',
      budget: 20,
      charged: 0,
      legacy: false,
      rateVersion: 'fixture',
      expiresAt: new Date(),
      result: {
        events: [{ type: 'tool-call', args: { kind: 'drawio-command' } }],
      },
    });
    for (let i = 0; i < 4; i++) {
      const a = { ...task(id, 60), allowFirstDiagram: true };
      await reserveTask(a);
      await done(a);
    }
    expect((await walletSummary(id)).balance).toBe(4);
    const last = { ...task(id, 60), allowFirstDiagram: true };
    expect((await reserveTask(last)).budget).toBe(4);
    await readyTask(last.id, id, { text: 'valid' }, 'last', [
      {
        model: 'deepseek/deepseek-v4-pro',
        input: 2000,
        cached: 0,
        output: 1000,
      },
    ]);
    expect((await finalizeTask(id, last.id, 'last')).charged).toBe(4);
    expect((await walletSummary(id)).balance).toBe(0);
    await expect(
      reserveTask({ ...task(id, 60), allowFirstDiagram: true })
    ).rejects.toMatchObject({ code: 'insufficient_credits' });
  });
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
    await db
      .update(user)
      .set({ createdAt: new Date('2026-10-15T00:00:00Z') })
      .where(eq(user.id, id));
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
    ).toBe(9998);
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
    ).toBe(9997);
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
