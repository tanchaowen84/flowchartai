import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { developerCredentials } from '@/db/developer-schema';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticate, createKey, revokeCredential, rotateKey } from './access';
import { SCOPES } from './contract';

describe.skipIf(!process.env.DEVELOPER_TEST_DATABASE_URL)(
  'developer credential firewall on isolated Postgres',
  () => {
    const userId = `developer-test-${randomUUID()}`;
    beforeAll(async () => {
      const url = new URL(process.env.DEVELOPER_TEST_DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55449' ||
        url.pathname !== '/flowchart_developer_test'
      )
        throw new Error('Not isolated developer DB');
      process.env.DATABASE_URL = url.href;
      process.env.BILLING_V1_ENABLED = 'true';
      const db = await getDb();
      await db.insert(user).values({
        id: userId,
        name: 'API test',
        email: `${userId}@example.invalid`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: 200,
      });
    });
    afterAll(async () => {
      await (await getDb()).delete(user).where(eq(user.id, userId));
    });
    function request(key: string): Request {
      return new Request('https://flowchartai.org/api/v1/account', {
        headers: { authorization: `Bearer ${key}` },
      });
    }
    it('stores only hashes, returns secret once, grants exact scopes', async () => {
      const created = await createKey(userId, {
        name: 'one',
        scopes: ['diagrams:read'],
      });
      expect(created.key).toMatch(/^fca_key_/);
      const [stored] = await (await getDb())
        .select()
        .from(developerCredentials)
        .where(eq(developerCredentials.id, created.credential.id));
      expect(JSON.stringify(stored)).not.toContain(created.key);
      const principal = await authenticate(request(created.key));
      expect(principal.userId).toBe(userId);
      expect(principal.scopes).toEqual(['diagrams:read']);
    });
    it('rejects cookies and URL keys as API identities', async () => {
      await expect(
        authenticate(
          new Request('https://flowchartai.org/api/v1/account?api_key=fake', {
            headers: { cookie: 'better-auth.session_token=fake' },
          })
        )
      ).rejects.toMatchObject({ status: 401 });
    });
    it('revocation and expiry block subsequent requests', async () => {
      const created = await createKey(userId, {
        name: 'revoked',
        scopes: [...SCOPES],
      });
      await revokeCredential(userId, created.credential.id);
      await expect(authenticate(request(created.key))).rejects.toMatchObject({
        status: 401,
      });
      const exp = await createKey(userId, {
        name: 'expired',
        scopes: ['account:read'],
      });
      await (await getDb())
        .update(developerCredentials)
        .set({ expiresAt: new Date(0) })
        .where(eq(developerCredentials.id, exp.credential.id));
      await expect(authenticate(request(exp.key))).rejects.toMatchObject({
        status: 401,
      });
    });
    it('rotation is atomic, invalidates original and retains policy', async () => {
      const old = await createKey(userId, {
        name: 'rotate',
        scopes: ['account:read'],
        daily_credits: 20,
      });
      const next = await rotateKey(userId, old.credential.id);
      await expect(authenticate(request(old.key))).rejects.toMatchObject({
        status: 401,
      });
      expect((await authenticate(request(next.key))).scopes).toEqual([
        'account:read',
      ]);
      expect(next.credential.dailyCredits).toBe(20);
      expect(next.credential.expiresAt).toEqual(old.credential.expiresAt);
    });
    it('enforces the per-key rate limit atomically', async () => {
      const created = await createKey(userId, {
        name: 'limited',
        scopes: ['account:read'],
        requests_per_minute: 1,
      });
      const attempts = await Promise.allSettled([
        authenticate(request(created.key)),
        authenticate(request(created.key)),
      ]);
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { status: 429 },
      });
    });
    it('rechecks owner bans after key issuance', async () => {
      const created = await createKey(userId, {
        name: 'ban',
        scopes: ['account:read'],
      });
      await (await getDb())
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, userId));
      await expect(authenticate(request(created.key))).rejects.toMatchObject({
        status: 403,
      });
      await (await getDb())
        .update(user)
        .set({ banned: false })
        .where(eq(user.id, userId));
    });
  }
);
