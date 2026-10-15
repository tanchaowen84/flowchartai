import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/billing/http', () => ({
  billingSession: async () => ({ id: state.userId }),
  billingError: () => Response.json({ error: 'failed' }, { status: 503 }),
}));
import { GET } from '@/app/api/billing/checkout/route';
import { getDb } from '@/db';
import { billingCheckouts, user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { grantBucket, lockWallet } from './wallet';
describe.skipIf(!process.env.BILLING_TEST_DATABASE_URL)(
  'trusted checkout fulfillment',
  () => {
    let db: Awaited<ReturnType<typeof getDb>>;
    const owners: string[] = [];
    beforeAll(async () => {
      const u = new URL(process.env.BILLING_TEST_DATABASE_URL!);
      if (
        u.hostname !== '127.0.0.1' ||
        u.port !== '55469' ||
        u.pathname !== '/flowchart_paywall_test'
      )
        throw new Error('Refusing non-test database');
      process.env.DATABASE_URL = u.toString();
      db = await getDb();
    });
    afterAll(async () => {
      for (const id of owners) await db.delete(user).where(eq(user.id, id));
    });
    it('requires both a trusted paid receipt and correlated fulfillment, and never reveals another owner checkout', async () => {
      const id = randomUUID();
      const other = randomUUID();
      const checkoutId = randomUUID();
      const order = 'order_' + randomUUID();
      owners.push(id, other);
      for (const u of owners)
        await db.insert(user).values({
          id: u,
          name: 'Checkout fixture',
          email: u + '@example.invalid',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          credits: 0,
        });
      await db.insert(billingCheckouts).values({
        id: checkoutId,
        userId: id,
        offerKey: 'pack_small',
        environment: 'test',
        state: 'pending',
        orderId: order,
      });
      const req = () =>
        new Request('http://localhost/api/billing/checkout?id=' + checkoutId);
      state.userId = other;
      expect((await GET(req())).status).toBe(404);
      state.userId = id;
      expect((await (await GET(req())).json()).fulfilled).toBe(false);
      await db
        .update(billingCheckouts)
        .set({ state: 'paid' })
        .where(eq(billingCheckouts.id, checkoutId));
      expect((await (await GET(req())).json()).fulfilled).toBe(false);
      await db.transaction(async (tx) => {
        await lockWallet(tx, id);
        await grantBucket(tx, {
          userId: id,
          amount: 1500,
          source: 'pack',
          sourceKey: order,
          paymentId: order,
        });
      });
      expect(await (await GET(req())).json()).toMatchObject({
        fulfilled: true,
        creditsAdded: 1500,
        state: 'paid',
      });
      expect(await (await GET(req())).json()).toMatchObject({
        fulfilled: true,
        creditsAdded: 1500,
      });
    });
  }
);
