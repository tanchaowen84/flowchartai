import { createHmac, randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { billingEvents, creditsHistory, payment, user } from '@/db/schema';
import { walletSummary } from '@/lib/billing/wallet';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CreemProvider } from './creem';

describe.skipIf(!process.env.BILLING_TEST_DATABASE_URL)(
  'signed Creem subscription events with real local Postgres',
  () => {
    let db: Awaited<ReturnType<typeof getDb>>;
    let provider: CreemProvider;
    const owners: string[] = [];
    const events: string[] = [];
    const secret = 'local-creem-webhook-fixture';
    beforeAll(async () => {
      const url = new URL(process.env.BILLING_TEST_DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55438' ||
        url.pathname !== '/flowchart_billing_test'
      )
        throw new Error('Refusing non-test database');
      process.env.DATABASE_URL = url.toString();
      process.env.BILLING_V1_ENABLED = 'true';
      process.env.CREEM_API_KEY = 'creem_test_fixture';
      process.env.CREEM_API_URL = 'https://test-api.creem.io';
      process.env.CREEM_WEBHOOK_SECRET = secret;
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_HOBBY_YEARLY =
        'prod_created_hobby_fixture';
      db = await getDb();
      provider = new CreemProvider();
    });
    afterAll(async () => {
      for (const id of owners) await db.delete(user).where(eq(user.id, id));
      for (const id of events)
        await db.delete(billingEvents).where(eq(billingEvents.id, id));
    });
    afterEach(() => vi.restoreAllMocks());
    async function fixture() {
      const id = `creem-preservation-${randomUUID()}`;
      owners.push(id);
      const periodStart = new Date();
      const periodEnd = new Date(Date.now() + 180 * 86400000);
      await db.insert(user).values({
        id,
        name: 'Old subscriber',
        email: `${id}@example.invalid`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: 777,
      });
      await db.insert(creditsHistory).values({
        id: randomUUID(),
        userId: id,
        amount: 777,
        type: 'add',
        description: 'Historical credits',
      });
      await db.insert(payment).values({
        id,
        userId: id,
        provider: 'creem',
        legacyPlan: 'hobby',
        priceId: 'prod_retired_hobby_fixture',
        type: 'subscription',
        interval: 'year',
        customerId: `cust_${id}`,
        subscriptionId: `sub_${id}`,
        status: 'active',
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: false,
        metadata: {
          historical: 'keep',
          creem_updated_at: '2026-01-01T00:00:00.000Z',
        },
      });
      const subscription = (
        status: string,
        updatedAt = '2026-10-14T12:00:00.000Z'
      ) => ({
        id: `sub_${id}`,
        object: 'subscription',
        status,
        customer: `cust_${id}`,
        product: {
          id: 'prod_retired_hobby_fixture',
          billing_type: 'recurring',
          billing_period: 'every-year',
        },
        current_period_start_date: periodStart.toISOString(),
        current_period_end_date: periodEnd.toISOString(),
        canceled_at: null,
        created_at: periodStart.toISOString(),
        updated_at: updatedAt,
        metadata: { user_id: id },
        mode: 'test',
      });
      return { id, periodStart, periodEnd, subscription };
    }
    async function send(
      eventType: string,
      subscription: unknown,
      eventId = randomUUID()
    ) {
      const payload = JSON.stringify({
        id: eventId,
        eventType,
        created_at: Date.now(),
        object: subscription,
        mode: 'test',
      });
      events.push(`creem:${eventType}:${eventId}`);
      await provider.handleWebhookEvent(
        payload,
        createHmac('sha256', secret).update(payload).digest('hex')
      );
      return {
        payload,
        signature: createHmac('sha256', secret).update(payload).digest('hex'),
      };
    }
    async function record(id: string) {
      return (await db.select().from(payment).where(eq(payment.id, id)))[0];
    }
    async function expectPreserved(f: Awaited<ReturnType<typeof fixture>>) {
      const p = await record(f.id);
      expect(p).toMatchObject({
        legacyPlan: 'hobby',
        priceId: 'prod_retired_hobby_fixture',
        interval: 'year',
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      });
      expect(p.metadata).toMatchObject({ historical: 'keep' });
      expect((await walletSummary(f.id)).balance).toBe(777);
      expect(
        await db
          .select()
          .from(creditsHistory)
          .where(eq(creditsHistory.userId, f.id))
      ).toHaveLength(1);
    }
    it('keeps original paid-period access during payment retries without charging credits', async () => {
      const f = await fixture();
      await send('subscription.past_due', f.subscription('past_due'));
      expect((await record(f.id)).status).toBe('past_due');
      expect((await walletSummary(f.id)).legacy?.plan).toBe('hobby');
      await expectPreserved(f);
    });
    it('keeps scheduled-cancellation access until the original period ends', async () => {
      const f = await fixture();
      await send(
        'subscription.scheduled_cancel',
        f.subscription('scheduled_cancel')
      );
      expect(await record(f.id)).toMatchObject({
        status: 'canceled',
        cancelAtPeriodEnd: true,
      });
      expect((await walletSummary(f.id)).legacy?.plan).toBe('hobby');
      await expectPreserved(f);
    });
    it('does not let an older retry event overwrite a successful renewal', async () => {
      const f = await fixture();
      await send(
        'subscription.paid',
        f.subscription('active', '2026-10-14T12:00:00.000Z')
      );
      await send(
        'subscription.past_due',
        f.subscription('past_due', '2026-10-13T12:00:00.000Z')
      );
      expect((await record(f.id)).status).toBe('active');
      await expectPreserved(f);
    });
    it('synchronizes expiration without changing historical balance or contract dates', async () => {
      const f = await fixture();
      await send('subscription.expired', f.subscription('expired'));
      expect(await record(f.id)).toMatchObject({
        status: 'canceled',
        cancelAtPeriodEnd: false,
      });
      expect((await walletSummary(f.id)).legacy).toBeNull();
      await expectPreserved(f);
    });
    it('uses current Creem state when an old expiration omits its update timestamp', async () => {
      const f = await fixture();
      const current = f.subscription('active');
      await send('subscription.paid', current);
      const { updated_at: omitted, ...old } = f.subscription('expired');
      const lookup = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(current), { status: 200 })
        );
      await send('subscription.expired', old);
      expect(lookup).toHaveBeenCalledOnce();
      expect((await record(f.id)).status).toBe('active');
      await expectPreserved(f);
    });
    it('keeps the original entitlement when canonical Creem lookup fails', async () => {
      const f = await fixture();
      const { updated_at: omitted, ...old } = f.subscription('expired');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{}', { status: 503 })
      );
      await expect(send('subscription.expired', old)).rejects.toThrow(
        'Canonical Creem subscription lookup failed'
      );
      expect((await record(f.id)).status).toBe('active');
      await expectPreserved(f);
    });
    it('acknowledges a committed undated event without depending on Creem again', async () => {
      const f = await fixture();
      const current = f.subscription('active');
      const { updated_at: omitted, ...undated } = current;
      const lookup = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(current), { status: 200 })
        );
      const event = await send('subscription.paid', undated);
      lookup.mockClear().mockResolvedValue(new Response('{}', { status: 503 }));
      await provider.handleWebhookEvent(event.payload, event.signature);
      expect(lookup).not.toHaveBeenCalled();
      expect((await record(f.id)).status).toBe('active');
      await expectPreserved(f);
    });
    it('protects the initial subscription insert from the next delayed event', async () => {
      const f = await fixture();
      await db.delete(payment).where(eq(payment.id, f.id));
      const current = f.subscription('active');
      current.product.id = 'prod_created_hobby_fixture';
      await send('subscription.paid', current);
      const [inserted] = await db
        .select()
        .from(payment)
        .where(eq(payment.subscriptionId, current.id));
      expect(inserted.metadata).toMatchObject({
        creem_updated_at: current.updated_at,
      });
      expect(inserted.legacyPlan).toBe('hobby');
      await send('subscription.past_due', {
        ...current,
        status: 'past_due',
        updated_at: '2026-10-13T12:00:00.000Z',
        current_period_end_date: new Date(
          f.periodEnd.getTime() - 86400000
        ).toISOString(),
      });
      const [after] = await db
        .select()
        .from(payment)
        .where(eq(payment.id, inserted.id));
      expect(after).toMatchObject({
        status: 'active',
        legacyPlan: 'hobby',
        periodEnd: f.periodEnd,
      });
      expect((await walletSummary(f.id)).balance).toBe(777);
    });
    it('keeps the newest state when renewal and an older retry arrive concurrently', async () => {
      const f = await fixture();
      await Promise.all([
        send(
          'subscription.paid',
          f.subscription('active', '2026-10-14T12:00:00.000Z')
        ),
        send(
          'subscription.past_due',
          f.subscription('past_due', '2026-10-13T12:00:00.000Z')
        ),
      ]);
      expect((await record(f.id)).status).toBe('active');
      await expectPreserved(f);
    });
    it('accepts pause and recovery while preserving the original contract', async () => {
      const f = await fixture();
      await send('subscription.paused', f.subscription('paused'));
      expect((await record(f.id)).status).toBe('paused');
      await send(
        'subscription.update',
        f.subscription('active', '2026-10-15T12:00:00.000Z')
      );
      expect((await walletSummary(f.id)).legacy?.plan).toBe('hobby');
      await expectPreserved(f);
    });
    it('handles the same signed renewal once and rejects invalid signatures', async () => {
      const f = await fixture();
      const event = await send('subscription.paid', f.subscription('active'));
      const updatedAt = (await record(f.id)).updatedAt;
      await provider.handleWebhookEvent(event.payload, event.signature);
      expect((await record(f.id)).updatedAt).toEqual(updatedAt);
      await expect(
        provider.handleWebhookEvent(event.payload, '0'.repeat(64))
      ).rejects.toThrow('Invalid webhook signature');
      await expectPreserved(f);
    });
  }
);
