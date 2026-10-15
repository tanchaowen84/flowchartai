import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { developerCredentials, developerTokens } from '@/db/developer-schema';
import { session, user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticate, revokeCredential } from './access';
import { hash, resource } from './contract';
import {
  authorizationRequest,
  consent,
  exchangeToken,
  oauthEndpoint,
  registerClient,
  revokeToken,
} from './oauth';

describe.skipIf(!process.env.DEVELOPER_TEST_DATABASE_URL)(
  'OAuth PKCE and revocation on isolated Postgres',
  () => {
    const owner = `oauth-test-${randomUUID()}`;
    const verifier = 'v'.repeat(64);
    beforeAll(async () => {
      process.env.DATABASE_URL = process.env.DEVELOPER_TEST_DATABASE_URL;
      process.env.BILLING_V1_ENABLED = 'true';
      await (await getDb()).insert(user).values({
        id: owner,
        name: 'OAuth test',
        email: `${owner}@example.invalid`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    afterAll(async () => {
      await (await getDb()).delete(user).where(eq(user.id, owner));
    });
    async function start() {
      const client = await registerClient({
        client_name: 'SDK fixture',
        redirect_uris: ['http://127.0.0.1:65432/callback'],
      });
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: String(client.client_id),
        redirect_uri: 'http://127.0.0.1:65432/callback',
        resource: resource(),
        scope: 'account:read tasks:read offline_access',
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256')
          .update(verifier)
          .digest('base64url'),
        state: randomUUID(),
      });
      const redirect = new URL(await consent(owner, params, true));
      const exchange = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: String(client.client_id),
        redirect_uri: params.get('redirect_uri')!,
        resource: resource(),
        code: redirect.searchParams.get('code')!,
        code_verifier: verifier,
      });
      return { client, params, exchange, redirect };
    }
    const api = (token: unknown, path = '/api/mcp') =>
      new Request(`https://flowchartai.org${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
    it('preserves a registered loopback callback at the public NextRequest boundary', async () => {
      const callback = 'http://127.0.0.1:3051/callback';
      const client = await registerClient({ redirect_uris: [callback] });
      const url = new URL('/api/oauth/authorize', resource());
      url.search = new URLSearchParams({
        client_id: String(client.client_id),
        redirect_uri: callback,
        response_type: 'code',
        code_challenge: 'x'.repeat(43),
        code_challenge_method: 'S256',
        resource: resource(),
        state: 'opaque-state',
      }).toString();
      const response = await oauthEndpoint(new NextRequest(url), 'authorize');
      expect(response.status).toBe(302);
      expect(
        new URL(response.headers.get('location')!).searchParams.get(
          'redirect_uri'
        )
      ).toBe(callback);
    });
    it('identifies missing required authorization parameters before client lookup', async () => {
      const { params } = await start();
      for (const key of [
        'client_id',
        'redirect_uri',
        'response_type',
        'code_challenge',
        'code_challenge_method',
        'resource',
      ]) {
        const missing = new URLSearchParams(params);
        missing.delete(key);
        await expect(authorizationRequest(missing)).rejects.toMatchObject({
          code: 'invalid_request',
          message: `Missing authorization parameter: ${key}.`,
        });
      }
    });
    it('validates exact redirect, PKCE S256, scope and resource before consent', async () => {
      const { params } = await start();
      for (const [key, value] of [
        ['redirect_uri', 'https://evil.example/callback'],
        ['resource', 'https://spritefuse.com/api/mcp'],
        ['code_challenge_method', 'plain'],
        ['scope', 'admin'],
      ]) {
        const invalid = new URLSearchParams(params);
        invalid.set(key, value);
        await expect(authorizationRequest(invalid)).rejects.toBeTruthy();
      }
      await expect(
        registerClient({ redirect_uris: ['http://evil.example/callback'] })
      ).rejects.toBeTruthy();
    });
    it('exchanges a single-use code, protects PKCE and does not issue website sessions', async () => {
      const { exchange, params, redirect } = await start();
      expect(redirect.searchParams.get('state')).toBe(params.get('state'));
      const bad = new URLSearchParams(exchange);
      bad.set('code_verifier', 'x'.repeat(64));
      await expect(exchangeToken(bad)).rejects.toMatchObject({
        code: 'invalid_grant',
      });
      const token = await exchangeToken(exchange);
      expect(
        (await authenticate(api(token.access_token), true)).scopes
      ).toEqual(['account:read', 'tasks:read']);
      await expect(exchangeToken(exchange)).rejects.toMatchObject({
        code: 'invalid_grant',
      });
      const stored = await (await getDb())
        .select()
        .from(developerTokens)
        .where(eq(developerTokens.hash, hash(String(token.access_token))));
      expect(stored).toHaveLength(1);
      expect(JSON.stringify(stored)).not.toContain(String(token.access_token));
      expect(
        await (await getDb())
          .select()
          .from(session)
          .where(eq(session.userId, owner))
      ).toHaveLength(0);
      await expect(
        authenticate(api(token.access_token, '/api/v1/account'))
      ).rejects.toMatchObject({ status: 401 });
    });
    it('refresh rotates tokens; replay revokes the entire old connection', async () => {
      const { exchange, client } = await start();
      const first = await exchangeToken(exchange);
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: String(first.refresh_token),
        client_id: String(client.client_id),
        resource: resource(),
      });
      const second = await exchangeToken(params);
      await expect(
        authenticate(api(first.access_token), true)
      ).rejects.toMatchObject({ status: 401 });
      expect((await authenticate(api(second.access_token), true)).userId).toBe(
        owner
      );
      await expect(exchangeToken(params)).rejects.toMatchObject({
        code: 'invalid_grant',
      });
      await expect(
        authenticate(api(second.access_token), true)
      ).rejects.toMatchObject({ status: 401 });
    });
    it('wrong resource or client cannot exchange or revoke another grant', async () => {
      const { exchange, client } = await start();
      const wrong = new URLSearchParams(exchange);
      wrong.set('resource', 'https://example.com/mcp');
      await expect(exchangeToken(wrong)).rejects.toMatchObject({
        code: 'invalid_target',
      });
      const first = await exchangeToken(exchange);
      const wrongClient = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: String(first.refresh_token),
        client_id: randomUUID(),
        resource: resource(),
      });
      await expect(exchangeToken(wrongClient)).rejects.toMatchObject({
        code: 'invalid_grant',
      });
      await revokeToken(
        new URLSearchParams({
          token: String(first.access_token),
          client_id: 'wrong',
        })
      );
      expect((await authenticate(api(first.access_token), true)).userId).toBe(
        owner
      );
      await revokeToken(
        new URLSearchParams({
          token: String(first.access_token),
          client_id: String(client.client_id),
        })
      );
      await expect(
        authenticate(api(first.access_token), true)
      ).rejects.toMatchObject({ status: 401 });
    });
    it('dashboard revoke remains effective after reconnecting the same client', async () => {
      const { exchange, params } = await start();
      const old = await exchangeToken(exchange);
      const principal = await authenticate(api(old.access_token), true);
      await revokeCredential(owner, principal.credentialId);
      const redirect = new URL(await consent(owner, params, true));
      const next = new URLSearchParams(exchange);
      next.set('code', redirect.searchParams.get('code')!);
      const token = await exchangeToken(next);
      expect(
        (await authenticate(api(token.access_token), true)).credentialId
      ).not.toBe(principal.credentialId);
      await expect(
        authenticate(api(old.access_token), true)
      ).rejects.toMatchObject({ status: 401 });
    });
    it('expired access and connection policy deny access immediately', async () => {
      const { exchange } = await start();
      const token = await exchangeToken(exchange);
      const principal = await authenticate(api(token.access_token), true);
      await (await getDb())
        .update(developerCredentials)
        .set({ expiresAt: new Date(0) })
        .where(eq(developerCredentials.id, principal.credentialId));
      await expect(
        authenticate(api(token.access_token), true)
      ).rejects.toMatchObject({ status: 401 });
    });
  }
);
