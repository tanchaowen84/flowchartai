import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Authentication and the provider network are the only external seams. Quote
// persistence, checkout reuse, raw signature verification and fulfillment run
// against the real implementation and a dedicated localhost PostgreSQL DB.
const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
}));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        authState.user ? { user: authState.user } : null,
    },
  },
}));

import { GET as checkoutStatus } from '@/app/api/billing/checkout/route';
import { POST as webhook } from '@/app/api/webhooks/waffo/route';
import { getDb } from '@/db';
import {
  billingCheckouts,
  billingEvents,
  creditBuckets,
  user,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { createWaffoCheckout } from './waffo';

const databaseUrl = process.env.UNIFIED_FLOWCHART_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)(
  'unified pricing provider and signed fulfillment',
  () => {
    let db: Awaited<ReturnType<typeof getDb>>;
    const owners: string[] = [];
    const orders: string[] = [];
    const checkoutMetadata = new Map<string, Record<string, string>>();
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const store = 'STO_unified_contract_fixture';

    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        !url.pathname.endsWith('_test')
      ) {
        throw new Error('Refusing a non-localhost *_test billing database');
      }
      vi.stubEnv('DATABASE_URL', url.toString());
      vi.stubEnv('BILLING_V1_ENABLED', 'true');
      vi.stubEnv('SITE_INSIGHTS_ENVIRONMENT', 'staging');
      vi.stubEnv('SITE_INSIGHTS_SITE_ID', 'flowchart');
      vi.stubEnv('WAFFO_ENVIRONMENT', 'test');
      vi.stubEnv('WAFFO_STORE_ID', store);
      vi.stubEnv('WAFFO_TEST_PRODUCT_PACK_SMALL', 'PRODUCT_unified_small');
      vi.stubEnv('WAFFO_TEST_PRODUCT_PACK_LARGE', 'PRODUCT_unified_large');
      vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3999');
      vi.stubEnv(
        'WAFFO_WEBHOOK_TEST_PUBLIC_KEY',
        keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
      );
      db = await getDb();
    });
    afterAll(async () => {
      if (db) {
        for (const id of orders)
          await db.delete(billingEvents).where(eq(billingEvents.orderId, id));
        for (const id of owners) await db.delete(user).where(eq(user.id, id));
      }
      vi.unstubAllEnvs();
    });

    async function owner() {
      const id = `unified-billing-${randomUUID()}`;
      const email = `${id}@example.invalid`;
      owners.push(id);
      await db.insert(user).values({
        id,
        email,
        name: 'Isolated unified fixture',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: 0,
      });
      return { id, email };
    }
    function quote(userId: string) {
      const now = Date.now();
      return {
        id: randomUUID(),
        site_id: 'flowchart',
        environment: 'staging',
        user_id: userId,
        anonymous_id: randomUUID(),
        target: 'credit-pack-price',
        assignment: {
          experiment_id: randomUUID(),
          variant: 'B' as const,
          value: {
            kind: 'pricing' as const,
            offer_key: 'pack_small',
            amount_minor: 1234,
            currency: 'USD' as const,
            credits: 1876,
          },
          token: `local-exposure-${randomUUID()}`,
        },
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + 600000).toISOString(),
      };
    }
    function provider() {
      const create = vi.fn(async (params: any, _options: any) => {
        checkoutMetadata.set(params.orderMerchantExternalId, params.metadata);
        return {
          sessionId: `SES_${params.orderMerchantExternalId}`,
          checkoutUrl: `https://checkout.fixture.invalid/${params.orderMerchantExternalId}`,
        };
      });
      return {
        create,
        client: { checkout: { authenticated: { create } } } as any,
      };
    }
    async function checkout(
      own: { id: string; email: string },
      q = quote(own.id),
      network = provider()
    ) {
      const result = await createWaffoCheckout(
        own.id,
        own.email,
        'pack_small',
        'http://localhost:3999/settings/billing?payment=return',
        network.client,
        null,
        q
      );
      return { result, q, network };
    }
    function completed(
      checkoutId: string,
      own: { id: string },
      amount = '12.34'
    ) {
      const order = `ORD_${randomUUID()}`;
      orders.push(order);
      return {
        id: randomUUID(),
        eventId: `PAY_${order}`,
        eventType: 'order.completed',
        timestamp: new Date().toISOString(),
        mode: 'test',
        storeId: store,
        data: {
          orderId: order,
          orderMerchantExternalId: checkoutId,
          merchantProvidedBuyerIdentity: own.id,
          orderMetadata: checkoutMetadata.get(checkoutId) || {
            offerKey: 'pack_small',
          },
          paymentId: `PAY_${order}`,
          paymentStatus: 'succeeded',
          currency: 'USD',
          amount,
          chargedAmount: amount,
        },
      };
    }
    async function deliver(event: any, tamper = false) {
      const raw = JSON.stringify(event);
      const time = Date.now();
      const signer = createSign('RSA-SHA256');
      signer.update(`${time}.${raw}`);
      return webhook(
        new Request('http://localhost:3999/api/webhooks/waffo', {
          method: 'POST',
          headers: {
            'x-waffo-signature': `t=${time},v1=${signer.sign(keys.privateKey, 'base64')}`,
          },
          body: tamper ? `${raw} ` : raw,
        })
      );
    }
    async function balance(id: string) {
      const [row] = await db
        .select({ credits: user.credits })
        .from(user)
        .where(eq(user.id, id));
      return row.credits;
    }

    it('persists the immutable quote and sends its exact amount through the provider SDK', async () => {
      const own = await owner();
      const { result, q, network } = await checkout(own);
      expect(network.create).toHaveBeenCalledTimes(1);
      const [params, options] = network.create.mock.calls[0];
      expect(params).toMatchObject({
        productId: 'PRODUCT_unified_small',
        currency: 'USD',
        buyerIdentity: own.id,
        orderMerchantExternalId: result.id,
        priceSnapshot: { amount: '12.34', taxCategory: expect.any(String) },
      });
      expect(options).toEqual({ idempotencyKey: `checkout-${result.id}` });
      expect(params.expiresInSeconds).toBeGreaterThan(0);
      expect(params.expiresInSeconds).toBeLessThanOrEqual(600);
      const [saved] = await db
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.id, result.id));
      expect(saved).toMatchObject({
        userId: own.id,
        offerKey: 'pack_small',
        state: 'pending',
        environment: 'test',
        experimentQuote: q,
      });
      expect(await balance(own.id)).toBe(0);
    });

    it('reuses the same quote checkout under retries and concurrent calls', async () => {
      const own = await owner();
      const q = quote(own.id);
      const network = provider();
      const rows = await Promise.all(
        Array.from({ length: 4 }, () => checkout(own, q, network))
      );
      const id = rows[0].result.id;
      expect(new Set(rows.map((x) => x.result.id))).toEqual(new Set([id]));
      for (const [params, options] of network.create.mock.calls) {
        expect(params.priceSnapshot.amount).toBe('12.34');
        expect(options.idempotencyKey).toBe(`checkout-${id}`);
      }
      const retry = await checkout(own, q, network);
      expect(retry.result).toEqual(rows[0].result);
      const saved = await db
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.userId, own.id));
      expect(saved).toHaveLength(1);
    });

    it('retries provider failure using the durable checkout and same idempotency key', async () => {
      const own = await owner();
      const q = quote(own.id);
      const network = provider();
      network.create.mockRejectedValueOnce(
        new Error('Synthetic provider transport failure')
      );
      await expect(checkout(own, q, network)).rejects.toThrow();
      expect(await balance(own.id)).toBe(0);
      const [first] = await db
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.userId, own.id));
      expect(first.experimentQuote).toEqual(q);
      const retried = await checkout(own, q, network);
      expect(retried.result.id).toBe(first.id);
      expect(network.create.mock.calls[0][1]).toEqual(
        network.create.mock.calls[1][1]
      );
      expect(network.create.mock.calls[1][0].priceSnapshot.amount).toBe(
        '12.34'
      );
    });

    it('rejects expired and foreign quote ownership before provider handoff', async () => {
      const own = await owner();
      const other = await owner();
      const network = provider();
      await expect(checkout(own, quote(other.id), network)).rejects.toThrow();
      const expired = {
        ...quote(own.id),
        expires_at: new Date(Date.now() - 1000).toISOString(),
      };
      await expect(checkout(own, expired, network)).rejects.toThrow();
      expect(network.create).not.toHaveBeenCalled();
      expect(
        await db
          .select()
          .from(billingCheckouts)
          .where(eq(billingCheckouts.userId, own.id))
      ).toHaveLength(0);
    });

    it('does not silently substitute an ordinary open checkout for an experimental quote', async () => {
      const own = await owner();
      const network = provider();
      const ordinary = await createWaffoCheckout(
        own.id,
        own.email,
        'pack_small',
        'http://localhost:3999/settings/billing?payment=return',
        network.client
      );
      const q = quote(own.id);
      const outcome = await checkout(own, q, network).then(
        (value) => ({ value }),
        (error) => ({ error })
      );
      if ('value' in outcome) {
        expect(outcome.value.result.id).not.toBe(ordinary.id);
        const call = network.create.mock.calls.find(
          ([params]) =>
            params.orderMerchantExternalId === outcome.value.result.id
        );
        expect(call?.[0].priceSnapshot.amount).toBe('12.34');
      } else {
        expect(outcome.error).toBeInstanceOf(Error);
      }
    });

    it('fulfills a signed quote payment once and returns the exact purchased credits', async () => {
      const own = await owner();
      const { result } = await checkout(own);
      const event = completed(result.id, own);
      const accepted = await Promise.all([deliver(event), deliver(event)]);
      for (const r of accepted) expect(r.status).toBe(200);
      expect(
        (
          await deliver({
            ...event,
            id: randomUUID(),
            timestamp: new Date().toISOString(),
          })
        ).status
      ).toBe(200);
      expect(await balance(own.id)).toBe(1876);
      const grants = await db
        .select()
        .from(creditBuckets)
        .where(
          and(
            eq(creditBuckets.userId, own.id),
            eq(creditBuckets.source, 'pack')
          )
        );
      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({
        granted: 1876,
        remaining: 1876,
        expiresAt: null,
        paymentId: event.data.orderId,
      });
      authState.user = own;
      const status = await checkoutStatus(
        new Request(
          `http://localhost:3999/api/billing/checkout?id=${result.id}`
        )
      );
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({
        state: 'paid',
        fulfilled: true,
        creditsAdded: 1876,
      });
      authState.user = await owner();
      expect(
        (
          await checkoutStatus(
            new Request(
              `http://localhost:3999/api/billing/checkout?id=${result.id}`
            )
          )
        ).status
      ).toBe(404);
    });

    it('rejects tampered signatures and signed amount, owner or currency mismatches without any grant', async () => {
      const own = await owner();
      const { result } = await checkout(own);
      const event = completed(result.id, own);
      expect((await deliver(event, true)).status).toBe(401);
      for (const patch of [
        { amount: '0.01', chargedAmount: '0.01' },
        { listPrice: { subtotal: '0.01', total: '12.34', taxAmount: '12.33' } },
        { subtotal: '0.01' },
        { currency: 'EUR' },
        { merchantProvidedBuyerIdentity: 'other-owner' },
        { paymentStatus: 'pending' },
      ]) {
        expect(
          (
            await deliver({
              ...event,
              id: randomUUID(),
              data: { ...event.data, ...patch },
            })
          ).status
        ).toBeGreaterThanOrEqual(400);
      }
      expect(await balance(own.id)).toBe(0);
      expect(
        await db
          .select()
          .from(creditBuckets)
          .where(
            and(
              eq(creditBuckets.userId, own.id),
              eq(creditBuckets.source, 'pack')
            )
          )
      ).toHaveLength(0);
      const [saved] = await db
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.id, result.id));
      expect(saved.state).toBe('pending');
      // A later correct signed delivery must remain retryable after rejected ones.
      expect((await deliver(event)).status).toBe(200);
      expect(await balance(own.id)).toBe(1876);
    });

    it('ignores forged monetary and credit metadata in a valid signed provider event', async () => {
      const own = await owner();
      const { result } = await checkout(own);
      const event = completed(result.id, own);
      event.data.orderMetadata = {
        ...event.data.orderMetadata,
        credits: '999999',
        amount_minor: '1',
        variant: 'A',
      };
      expect((await deliver(event)).status).toBe(200);
      expect(await balance(own.id)).toBe(1876);
    });

    it('keeps ordinary pack checkout and fulfillment on the existing catalog price', async () => {
      const own = await owner();
      const network = provider();
      const result = await createWaffoCheckout(
        own.id,
        own.email,
        'pack_small',
        'http://localhost:3999/settings/billing?payment=return',
        network.client
      );
      expect(network.create.mock.calls[0][0].priceSnapshot).toBeUndefined();
      const event = completed(result.id, own, '10.00');
      expect((await deliver(event)).status).toBe(200);
      expect(await balance(own.id)).toBe(1500);
      authState.user = own;
      expect(
        await (
          await checkoutStatus(
            new Request(
              `http://localhost:3999/api/billing/checkout?id=${result.id}`
            )
          )
        ).json()
      ).toMatchObject({ fulfilled: true, creditsAdded: 1500 });
    });
  }
);
