import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const boundary = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  providerCalls: [] as { params: any; options: any }[],
}));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => (boundary.user ? { user: boundary.user } : null),
    },
  },
}));
vi.mock('@waffo/pancake-ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waffo/pancake-ts')>();
  return {
    ...actual,
    WaffoPancake: class {
      checkout = {
        authenticated: {
          create: async (params: any, options: any) => {
            boundary.providerCalls.push({ params, options });
            return {
              sessionId: `SES_${params.orderMerchantExternalId}`,
              checkoutUrl: `https://checkout.fixture.invalid/${params.orderMerchantExternalId}`,
            };
          },
        },
      };
    },
  };
});

import { POST as createCheckout } from '@/app/api/billing/checkout/route';
import { POST as createQuote } from '@/app/api/billing/experiment-quote/route';
import { getDb } from '@/db';
import { billingCheckouts, creditBuckets, user } from '@/db/schema';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env.UNIFIED_FLOWCHART_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)(
  'unified pricing authenticated HTTP routes',
  () => {
    let db: Awaited<ReturnType<typeof getDb>>;
    let remoteStatus = 200;
    let suppliedQuote: ReturnType<typeof quote> | null = null;
    let anonymousId = randomUUID();
    const owners: string[] = [];
    const remoteCalls: { url: string; body: any; headers: Headers }[] = [];
    const base = 'http://localhost:3999';

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
      vi.stubEnv('SITE_INSIGHTS_EXPERIMENTS_ENABLED', 'true');
      vi.stubEnv('SITE_INSIGHTS_ENVIRONMENT', 'staging');
      vi.stubEnv('SITE_INSIGHTS_SITE_ID', 'flowchart');
      vi.stubEnv('SITE_INSIGHTS_ENDPOINT', 'http://127.0.0.1:3998/insights');
      vi.stubEnv('SITE_INSIGHTS_WRITE_KEY', 'isolated-unified-write-key');
      vi.stubEnv('WAFFO_ENVIRONMENT', 'test');
      vi.stubEnv('WAFFO_MERCHANT_ID', 'fixture-merchant');
      vi.stubEnv('WAFFO_PRIVATE_KEY', 'fixture-only-no-provider-network');
      vi.stubEnv('WAFFO_TEST_PRODUCT_PACK_SMALL', 'PRODUCT_unified_small');
      vi.stubEnv('NEXT_PUBLIC_BASE_URL', base);
      db = await getDb();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : input.toString();
          if (
            !url.startsWith(
              'http://127.0.0.1:3998/insights/api/v1/experiments/server/'
            )
          ) {
            throw new Error(
              `Unexpected outbound network in isolated route test: ${new URL(url).origin}`
            );
          }
          const body = JSON.parse(
            typeof init?.body === 'string'
              ? init.body
              : input instanceof Request
                ? await input.text()
                : '{}'
          );
          const headers = new Headers(
            init?.headers ||
              (input instanceof Request ? input.headers : undefined)
          );
          remoteCalls.push({ url, body, headers });
          if (remoteStatus !== 200)
            return Response.json(
              { error: 'Synthetic Insights outage' },
              { status: remoteStatus }
            );
          return Response.json({ quote: suppliedQuote });
        })
      );
    });
    beforeEach(() => {
      boundary.user = null;
      boundary.providerCalls.length = 0;
      remoteCalls.length = 0;
      remoteStatus = 200;
      suppliedQuote = null;
      anonymousId = randomUUID();
      vi.stubEnv('SITE_INSIGHTS_EXPERIMENTS_ENABLED', 'true');
    });
    afterAll(async () => {
      if (db)
        for (const id of owners) await db.delete(user).where(eq(user.id, id));
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    async function owner() {
      const id = `unified-routes-${randomUUID()}`;
      const email = `${id}@example.invalid`;
      owners.push(id);
      await db.insert(user).values({
        id,
        email,
        name: 'Isolated route fixture',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: 0,
      });
      boundary.user = { id, email };
      return boundary.user;
    }
    function quote(userId: string) {
      const now = Date.now();
      return {
        id: randomUUID(),
        site_id: 'flowchart',
        environment: 'staging',
        user_id: userId,
        anonymous_id: anonymousId,
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
          token: `fixture-token-${randomUUID()}`,
        },
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + 600000).toISOString(),
      };
    }
    function request(
      path: string,
      body: unknown,
      cookie = `insights_anon_flowchart=${anonymousId}`
    ) {
      return new Request(`${base}/api/billing/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, cookie },
        body: JSON.stringify(body),
      });
    }

    it('owns quote identity, target and eligibility on the server and uses a private credential', async () => {
      const own = await owner();
      suppliedQuote = quote(own.id);
      const requestId = randomUUID();
      const response = await createQuote(
        request('experiment-quote', { request_id: requestId })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ quote: suppliedQuote });
      expect(remoteCalls).toHaveLength(1);
      expect(remoteCalls[0].url).toMatch(/\/quotes$/);
      expect(remoteCalls[0].body).toMatchObject({
        site_id: 'flowchart',
        target: 'credit-pack-price',
        anonymous_id: anonymousId,
        user_id: own.id,
        request_id: requestId,
        eligible: true,
      });
      expect(remoteCalls[0].headers.get('authorization')).toBe(
        'Bearer isolated-unified-write-key'
      );
    });

    it('requires authentication, valid anonymous identity and a valid request identifier', async () => {
      expect(
        (
          await createQuote(
            request('experiment-quote', { request_id: randomUUID() })
          )
        ).status
      ).toBe(401);
      await owner();
      for (const cookie of ['', 'insights_anon_flowchart=not-a-uuid']) {
        const response = await createQuote(
          request('experiment-quote', { request_id: randomUUID() }, cookie)
        );
        if (response.status === 200)
          expect(await response.json()).toEqual({ quote: null });
        else expect(response.status).toBeGreaterThanOrEqual(400);
      }
      for (const body of [
        { request_id: 'not-a-uuid' },
        { request_id: randomUUID(), eligible: true, user_id: 'forged-owner' },
      ]) {
        expect(
          (await createQuote(request('experiment-quote', body))).status
        ).toBe(400);
      }
      expect(remoteCalls).toHaveLength(0);
      expect(boundary.providerCalls).toHaveLength(0);
    });

    it('resolves only the quote ID for the authenticated owner and creates its exact priced checkout', async () => {
      const own = await owner();
      suppliedQuote = quote(own.id);
      const response = await createCheckout(
        request('checkout', { quote_id: suppliedQuote.id })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(remoteCalls).toHaveLength(1);
      expect(remoteCalls[0].url).toMatch(/\/quotes\/resolve$/);
      expect(remoteCalls[0].body).toMatchObject({
        site_id: 'flowchart',
        quote_id: suppliedQuote.id,
        user_id: own.id,
      });
      expect(boundary.providerCalls).toHaveLength(1);
      expect(boundary.providerCalls[0].params).toMatchObject({
        currency: 'USD',
        buyerIdentity: own.id,
        priceSnapshot: { amount: '12.34' },
      });
      const [saved] = await db
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.id, body.id));
      expect(saved.experimentQuote).toEqual(suppliedQuote);
    });

    it('rejects client price, credits, offer and variant overrides instead of forwarding them', async () => {
      const own = await owner();
      suppliedQuote = quote(own.id);
      for (const patch of [
        { amount_minor: 1 },
        { credits: 999999 },
        { currency: 'EUR' },
        { offerKey: 'pack_large' },
        { variant: 'A' },
        { user_id: 'other' },
      ]) {
        const response = await createCheckout(
          request('checkout', { quote_id: suppliedQuote.id, ...patch })
        );
        expect(response.status).toBe(400);
      }
      expect(remoteCalls).toHaveLength(0);
      expect(boundary.providerCalls).toHaveLength(0);
    });

    it('keeps a displayed quote unavailable on resolution outage, unknown, foreign or expired quote', async () => {
      const own = await owner();
      const shown = quote(own.id);
      for (const q of [
        null,
        { ...shown, user_id: 'foreign-owner' },
        { ...shown, expires_at: new Date(Date.now() - 1000).toISOString() },
      ]) {
        suppliedQuote = q;
        expect(
          (await createCheckout(request('checkout', { quote_id: shown.id })))
            .status
        ).toBeGreaterThanOrEqual(400);
      }
      suppliedQuote = shown;
      remoteStatus = 503;
      expect(
        (await createCheckout(request('checkout', { quote_id: shown.id })))
          .status
      ).toBeGreaterThanOrEqual(500);
      expect(boundary.providerCalls).toHaveLength(0);
      expect(
        await db
          .select()
          .from(billingCheckouts)
          .where(eq(billingCheckouts.userId, own.id))
      ).toHaveLength(0);
    });

    it('does not treat a previous buyer with zero remaining credits as a new buyer', async () => {
      const own = await owner();
      const orderId = `fixture-paid-${randomUUID()}`;
      await db.insert(billingCheckouts).values({
        id: randomUUID(),
        userId: own.id,
        offerKey: 'pack_small',
        environment: 'test',
        state: 'paid',
        orderId,
      });
      await db.insert(creditBuckets).values({
        id: randomUUID(),
        userId: own.id,
        source: 'pack',
        sourceKey: `waffo:order:${orderId}`,
        granted: 1500,
        remaining: 0,
        paymentId: orderId,
      });
      suppliedQuote = null;
      const result = await createQuote(
        request('experiment-quote', { request_id: randomUUID() })
      );
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ quote: null });
      for (const call of remoteCalls) expect(call.body.eligible).toBe(false);
      suppliedQuote = quote(own.id);
      expect(
        (
          await createCheckout(
            request('checkout', { quote_id: suppliedQuote.id })
          )
        ).status
      ).toBeGreaterThanOrEqual(400);
      expect(boundary.providerCalls).toHaveLength(0);
    });

    it('disables new experimental quotes without breaking ordinary checkout', async () => {
      const own = await owner();
      vi.stubEnv('SITE_INSIGHTS_EXPERIMENTS_ENABLED', 'false');
      const result = await createQuote(
        request('experiment-quote', { request_id: randomUUID() })
      );
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ quote: null });
      expect(remoteCalls).toHaveLength(0);
      const normal = await createCheckout(
        request('checkout', { offerKey: 'pack_small' })
      );
      expect(normal.status).toBe(200);
      expect(boundary.providerCalls).toHaveLength(1);
      expect(boundary.providerCalls[0].params.priceSnapshot).toBeUndefined();
      expect(boundary.providerCalls[0].params.buyerIdentity).toBe(own.id);
    });
  }
);
