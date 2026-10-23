import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  account,
  creditBuckets,
  session,
  user,
  verification,
} from '@/db/schema';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { guardEmailOtp } from './email-otp-guard';
import { emailOtpStore } from './email-otp-store';

const fixture = vi.hoisted(() => ({
  outbox: [] as Array<{ to: string; otp: string }>,
  fail: false,
}));
vi.mock('@/mail', () => ({
  sendEmail: vi.fn(async (data) => {
    if (fixture.fail) return false;
    fixture.outbox.push({ to: data.to, otp: data.context.otp });
    return true;
  }),
}));
vi.mock('@/newsletter', () => ({ subscribe: vi.fn(async () => true) }));

const enabled = Boolean(process.env.AUTH_TEST_DATABASE_URL);
describe.skipIf(!enabled)(
  'real auth + isolated PostgreSQL + wallet integration',
  () => {
    let auth: typeof import('./auth')['auth'];
    let db: Awaited<ReturnType<typeof getDb>>;
    const emails: string[] = [];
    beforeAll(async () => {
      const url = new URL(process.env.AUTH_TEST_DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '5597' ||
        url.pathname !== '/tan597'
      )
        throw new Error('Refusing non-isolated auth database');
      process.env.DATABASE_URL = url.toString();
      process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3597';
      process.env.BETTER_AUTH_SECRET =
        'isolated-auth-test-secret-minimum-32-characters';
      process.env.BILLING_V1_ENABLED = 'true';
      process.env.GOOGLE_CLIENT_ID = 'local-test';
      process.env.GOOGLE_CLIENT_SECRET = 'local-test';
      db = await getDb();
      auth = (await import('./auth')).auth;
    });
    afterAll(async () => {
      if (!db) return;
      for (const email of emails) {
        await db.delete(user).where(eq(user.email, email));
        await db
          .delete(verification)
          .where(eq(verification.identifier, `sign-in-otp-${email}`));
      }
    });
    const newEmail = () => {
      const email = `tan597-${randomUUID()}@example.invalid`;
      emails.push(email);
      return email;
    };
    const call = (path: string, body: object) =>
      guardEmailOtp(
        new Request(`http://localhost:3597/api/auth/${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3597',
          },
          body: JSON.stringify(body),
        }),
        emailOtpStore,
        (request) => auth.handler(request)
      );
    const send = (email: string) =>
      call('email-otp/send-verification-otp', { email, type: 'sign-in' });
    const verify = (email: string, otp: string) =>
      call('sign-in/email-otp', { email, otp });
    const code = (email: string) =>
      fixture.outbox.filter((m) => m.to === email).at(-1)!.otp;
    const owners = (email: string) =>
      db.select().from(user).where(eq(user.email, email));

    it('creates one verified user/session/grant only after verification, including concurrent retry', async () => {
      const email = newEmail();
      expect((await send(email)).status).toBe(200);
      expect(await owners(email)).toHaveLength(0);
      expect((await verify(email, 'wrong!')).status).toBe(400);
      expect(await owners(email)).toHaveLength(0);
      const results = await Promise.all([
        verify(email, code(email)),
        verify(email, code(email)),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
      const [owner] = await owners(email);
      expect(owner.emailVerified).toBe(true);
      expect(owner.credits).toBe(20);
      const grants = await db
        .select()
        .from(creditBuckets)
        .where(
          and(
            eq(creditBuckets.userId, owner.id),
            eq(creditBuckets.source, 'registration')
          )
        );
      expect(grants).toHaveLength(1);
      expect(grants[0].granted).toBe(20);
      const response = results.find((r) => r.status === 200)!;
      expect(response.headers.get('set-cookie')).toContain('session_token');
      const cookie = response.headers
        .get('set-cookie')!
        .split(/,(?=\s*better-auth\.)/)
        .map((s) => s.trim().split(';')[0])
        .join('; ');
      const readback = await auth.handler(
        new Request('http://localhost:3597/api/auth/get-session', {
          headers: { cookie },
        })
      );
      expect((await readback.json()).user.id).toBe(owner.id);
    });

    it.each([false, true])(
      'recovers an existing emailVerified=%s account without a new account or grant',
      async (verified) => {
        const email = newEmail();
        const id = `tan597-${randomUUID()}`;
        await db.insert(user).values({
          id,
          email,
          name: 'Existing',
          emailVerified: verified,
          createdAt: new Date(),
          updatedAt: new Date(),
          credits: 7,
        });
        await db.insert(account).values({
          id: randomUUID(),
          accountId: id,
          providerId: 'credential',
          userId: id,
          password: 'existing-fixture',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        expect((await send(email)).status).toBe(200);
        expect((await verify(email, code(email))).status).toBe(200);
        const readback = await owners(email);
        expect(readback).toHaveLength(1);
        expect(readback[0]).toMatchObject({
          id,
          emailVerified: true,
          credits: 7,
        });
        expect(
          await db
            .select()
            .from(creditBuckets)
            .where(eq(creditBuckets.userId, id))
        ).toHaveLength(0);
      }
    );

    it('rejects expired code and cannot revive an older code after newest code is consumed', async () => {
      const email = newEmail();
      await send(email);
      const old = code(email);
      await db
        .update(verification)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(verification.identifier, `sign-in-otp-${email}`));
      expect((await verify(email, old)).status).toBe(400);
      expect(await owners(email)).toHaveLength(0);
      const guardId = `otp-guard:${createHash('sha256').update(email).digest('hex')}`;
      await db.execute(
        sql`update verification set value = jsonb_set(value::jsonb, '{lastSend}', '0')::text where id = ${guardId}`
      );
      await send(email);
      expect((await verify(email, code(email))).status).toBe(200);
      expect((await verify(email, old)).status).toBe(400);
      expect(
        await db
          .select()
          .from(verification)
          .where(eq(verification.identifier, `sign-in-otp-${email}`))
      ).toHaveLength(0);
    });

    it('a resent live code supersedes an older live code, including after successful sign-in', async () => {
      const email = newEmail();
      await send(email);
      const old = code(email);
      const guardId = `otp-guard:${createHash('sha256').update(email).digest('hex')}`;
      await db.execute(
        sql`update verification set value = jsonb_set(value::jsonb, '{lastSend}', '0')::text where id = ${guardId}`
      );
      expect((await send(email)).status).toBe(200);
      expect(
        await db
          .select()
          .from(verification)
          .where(eq(verification.identifier, `sign-in-otp-${email}`))
      ).toHaveLength(1);
      expect((await verify(email, code(email))).status).toBe(200);
      expect((await verify(email, old)).status).toBe(400);
    });

    it('keeps password login and its original continuation for an existing verified account', async () => {
      const email = newEmail();
      const id = `tan597-${randomUUID()}`;
      await db.insert(user).values({
        id,
        email,
        name: 'Password fixture',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: 9,
      });
      await db.insert(account).values({
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: await hashPassword('test-password-597'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const response = await call('sign-in/email', {
        email,
        password: 'test-password-597',
        callbackURL: '/canvas/original?panel=ai#draft',
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toContain('session_token');
      expect((await response.json()).url).toContain(
        '/canvas/original?panel=ai#draft'
      );
      expect((await owners(email))[0]).toMatchObject({ id, credits: 9 });
    });

    it('keeps the complete return URL in Google OAuth state without contacting Google', async () => {
      const callback = '/pricing?offer=pro_year_202610#selected-plan';
      const response = await call('sign-in/social', {
        provider: 'google',
        callbackURL: callback,
        disableRedirect: true,
      });
      expect(response.status).toBe(200);
      expect((await response.json()).url).toContain('accounts.google.com');
      const states = await db.select().from(verification);
      expect(states.some((row) => row.value.includes(callback))).toBe(true);
    });

    it('does not exhaust the authentication pool when distinct email requests overlap', async () => {
      const batch = Array.from({ length: 12 }, newEmail);
      const sent = await Promise.all(batch.map(send));
      expect(sent.every((response) => response.status === 200)).toBe(true);
      const signedIn = await Promise.all(
        batch.map((email) => verify(email, code(email)))
      );
      expect(signedIn.every((response) => response.status === 200)).toBe(true);
    });

    it('rejects form/multipart and malformed JSON before any send or account creation', async () => {
      const email = newEmail();
      const size = fixture.outbox.length;
      for (const type of [
        'application/x-www-form-urlencoded',
        'multipart/form-data',
      ]) {
        const response = await guardEmailOtp(
          new Request(
            'http://localhost:3597/api/auth/email-otp/send-verification-otp',
            {
              method: 'POST',
              headers: {
                'content-type': type,
                origin: 'http://localhost:3597',
              },
              body: new URLSearchParams({ email, type: 'sign-in' }).toString(),
            }
          ),
          emailOtpStore,
          (request) => auth.handler(request)
        );
        expect(response.status).toBe(415);
      }
      const malformed = await guardEmailOtp(
        new Request('http://localhost:3597/api/auth/sign-in/email-otp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        }),
        emailOtpStore,
        (request) => auth.handler(request)
      );
      expect(malformed.status).toBe(400);
      expect(fixture.outbox).toHaveLength(size);
      expect(await owners(email)).toHaveLength(0);
      await send(email);
      const formVerify = await guardEmailOtp(
        new Request('http://localhost:3597/api/auth/sign-in/email-otp', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            origin: 'http://localhost:3597',
          },
          body: new URLSearchParams({ email, otp: code(email) }).toString(),
        }),
        emailOtpStore,
        (request) => auth.handler(request)
      );
      expect(formVerify.status).toBe(415);
      expect((await verify(email, code(email))).status).toBe(200);
    });

    it('send failure creates no account or usable verification and retry is bounded', async () => {
      const email = newEmail();
      fixture.fail = true;
      try {
        expect((await send(email)).status).toBe(500);
      } finally {
        fixture.fail = false;
      }
      expect(await owners(email)).toHaveLength(0);
      expect(
        await db
          .select()
          .from(verification)
          .where(eq(verification.identifier, `sign-in-otp-${email}`))
      ).toHaveLength(0);
      expect((await send(email)).status).toBe(429);
    });
  }
);
