/** OAuth code + PKCE server. Opaque resource-bound tokens have a live revocation fence. */
import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  developerClients,
  developerCodes,
  developerCredentials,
  developerTokens,
} from '@/db/developer-schema';
import { user } from '@/db/schema';
import type { BillingTx } from '@/lib/billing/wallet';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { assertLive, ownerPolicy, rateLimit } from './access';
import {
  DeveloperError,
  SCOPES,
  hash,
  origin,
  resource,
  secret,
} from './contract';
import { json, readBody } from './http';

export function validRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
export const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(100).default('MCP client'),
  redirect_uris: z
    .array(z.string().max(2048).refine(validRedirect))
    .min(1)
    .max(10),
  token_endpoint_auth_method: z.literal('none').default('none'),
  grant_types: z
    .array(z.enum(['authorization_code', 'refresh_token']))
    .default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.literal('code')).default(['code']),
});
export async function registerClient(
  input: unknown
): Promise<Record<string, unknown>> {
  const data = registrationSchema.parse(input);
  const clientId = randomUUID();
  await (await getDb()).insert(developerClients).values({
    id: clientId,
    name: data.client_name,
    redirectUris: [...new Set(data.redirect_uris)],
  });
  return {
    ...data,
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}
export async function authorizationRequest(params: URLSearchParams): Promise<{
  client: typeof developerClients.$inferSelect;
  redirectUri: string;
  challenge: string;
  scopes: string[];
  state: string;
  offline: boolean;
}> {
  for (const key of params.keys())
    if (params.getAll(key).length !== 1)
      throw new DeveloperError(
        'invalid_request',
        'Duplicate authorization parameter.'
      );
  for (const key of [
    'client_id',
    'redirect_uri',
    'response_type',
    'code_challenge',
    'code_challenge_method',
    'resource',
  ])
    if (!params.get(key))
      throw new DeveloperError(
        'invalid_request',
        `Missing authorization parameter: ${key}.`
      );
  const clientId = params.get('client_id') || '';
  const [client] = await (await getDb())
    .select()
    .from(developerClients)
    .where(eq(developerClients.id, clientId));
  const redirectUri = params.get('redirect_uri') || '';
  if (!client)
    throw new DeveloperError('invalid_request', 'Unknown OAuth client.');
  if (!client.redirectUris.includes(redirectUri)) {
    throw new DeveloperError(
      'invalid_request',
      'Redirect URI must exactly match the registered value.'
    );
  }
  if (
    params.get('response_type') !== 'code' ||
    params.get('code_challenge_method') !== 'S256' ||
    params.get('resource') !== resource()
  )
    throw new DeveloperError(
      'invalid_request',
      'Use code, PKCE S256 and the exact MCP resource.'
    );
  const challenge = params.get('code_challenge') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge))
    throw new DeveloperError('invalid_request', 'Invalid PKCE challenge.');
  const scopes = [
    ...new Set(
      (params.get('scope') || SCOPES.join(' ')).split(' ').filter(Boolean)
    ),
  ];
  if (
    !scopes.length ||
    scopes.some(
      (s) =>
        s !== 'offline_access' && !(SCOPES as readonly string[]).includes(s)
    )
  )
    throw new DeveloperError(
      'invalid_scope',
      'Request supported developer scopes.'
    );
  return {
    client,
    redirectUri,
    challenge,
    scopes: scopes.filter((s) => s !== 'offline_access'),
    state: params.get('state') || '',
    offline: scopes.includes('offline_access'),
  };
}
export async function consent(
  userId: string,
  params: URLSearchParams,
  approved: boolean
): Promise<string> {
  const request = await authorizationRequest(params);
  const url = new URL(request.redirectUri);
  if (request.state) url.searchParams.set('state', request.state);
  if (!approved) {
    url.searchParams.set('error', 'access_denied');
    return url.href;
  }
  await (await getDb()).transaction(async (tx) => {
    await tx.select().from(user).where(eq(user.id, userId)).for('update');
    const policy = await ownerPolicy(userId, tx);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(developerCredentials)
      .where(
        and(
          eq(developerCredentials.userId, userId),
          sql`${developerCredentials.revokedAt} IS NULL`,
          sql`${developerCredentials.expiresAt}>now()`
        )
      );
    if (count >= 100)
      throw new DeveloperError(
        'connection_limit',
        'Revoke an unused credential before connecting another client.',
        409
      );
    const code = secret('fca_code_');
    const id = randomUUID();
    await tx.insert(developerCredentials).values({
      id,
      userId,
      kind: 'oauth',
      name: request.client.name,
      prefix: 'OAuth',
      clientId: request.client.id,
      scopes: request.scopes,
      dailyCredits: policy.dailyCredits,
      dailyRequests: policy.dailyRequests,
      expiresAt: new Date(Date.now() + 365 * 86400000),
    });
    await tx.insert(developerCodes).values({
      hash: hash(code),
      credentialId: id,
      clientId: request.client.id,
      redirectUri: request.redirectUri,
      challenge: request.challenge,
      resource: resource(),
      offline: request.offline,
      expiresAt: new Date(Date.now() + 5 * 60000),
    });
    url.searchParams.set('code', code);
  });
  return url.href;
}
async function issueTokens(
  tx: BillingTx,
  credentialId: string,
  scopes: string[],
  offline: boolean,
  familyId: string = randomUUID()
): Promise<Record<string, unknown>> {
  const access = secret('fca_oat_');
  const refresh = offline ? secret('fca_ort_') : null;
  await tx.insert(developerTokens).values([
    {
      hash: hash(access),
      credentialId,
      familyId,
      kind: 'access',
      resource: resource(),
      expiresAt: new Date(Date.now() + 10 * 60000),
    },
    ...(refresh
      ? [
          {
            hash: hash(refresh),
            credentialId,
            familyId,
            kind: 'refresh',
            resource: resource(),
            expiresAt: new Date(Date.now() + 30 * 86400000),
          },
        ]
      : []),
  ]);
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: 600,
    scope: [...scopes, ...(offline ? ['offline_access'] : [])].join(' '),
    ...(refresh ? { refresh_token: refresh } : {}),
  };
}
export async function exchangeToken(
  params: URLSearchParams
): Promise<Record<string, unknown>> {
  for (const key of params.keys())
    if (params.getAll(key).length !== 1)
      throw new DeveloperError('invalid_request', 'Duplicate token parameter.');
  if (params.get('resource') !== resource())
    throw new DeveloperError('invalid_target', 'Use the exact MCP resource.');
  const result = await (await getDb()).transaction(async (tx) => {
    const grant = params.get('grant_type');
    const clientId = params.get('client_id');
    if (grant === 'authorization_code') {
      const [code] = await tx
        .select()
        .from(developerCodes)
        .where(eq(developerCodes.hash, hash(params.get('code') || '')))
        .for('update');
      const verifier = params.get('code_verifier') || '';
      if (
        !code ||
        code.consumedAt ||
        code.expiresAt <= new Date() ||
        code.clientId !== clientId ||
        code.redirectUri !== params.get('redirect_uri') ||
        code.resource !== resource() ||
        !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
        createHash('sha256').update(verifier).digest('base64url') !==
          code.challenge
      )
        throw new DeveloperError(
          'invalid_grant',
          'Invalid authorization code, redirect or PKCE verifier.'
        );
      const [credential] = await tx
        .select()
        .from(developerCredentials)
        .where(eq(developerCredentials.id, code.credentialId))
        .for('update');
      assertLive(credential);
      await ownerPolicy(credential.userId, tx);
      await tx
        .update(developerCodes)
        .set({ consumedAt: new Date() })
        .where(eq(developerCodes.hash, code.hash));
      return issueTokens(tx, credential.id, credential.scopes, code.offline);
    }
    if (grant === 'refresh_token') {
      const [token] = await tx
        .select()
        .from(developerTokens)
        .where(
          eq(developerTokens.hash, hash(params.get('refresh_token') || ''))
        )
        .for('update');
      if (
        !token ||
        token.kind !== 'refresh' ||
        token.expiresAt <= new Date() ||
        token.resource !== resource()
      )
        throw new DeveloperError('invalid_grant', 'Invalid refresh token.');
      const [credential] = await tx
        .select()
        .from(developerCredentials)
        .where(eq(developerCredentials.id, token.credentialId))
        .for('update');
      assertLive(credential);
      if (credential.clientId !== clientId)
        throw new DeveloperError(
          'invalid_grant',
          'Token belongs to another client.'
        );
      if (token.consumedAt) {
        // Commit the revocation instead of rolling it back with an exception.
        await tx
          .update(developerCredentials)
          .set({ revokedAt: new Date() })
          .where(eq(developerCredentials.id, credential.id));
        return { reuse: true };
      }
      await ownerPolicy(credential.userId, tx);
      if (
        params.has('scope') &&
        params.get('scope') !==
          [...credential.scopes, 'offline_access'].join(' ')
      )
        throw new DeveloperError(
          'invalid_scope',
          'Reconnect to change scopes.'
        );
      await tx
        .update(developerTokens)
        .set({ consumedAt: new Date() })
        .where(eq(developerTokens.hash, token.hash));
      // Rotate access tokens too: a refresh supersedes the previous access token.
      await tx
        .update(developerTokens)
        .set({ expiresAt: new Date() })
        .where(
          and(
            eq(developerTokens.familyId, token.familyId),
            eq(developerTokens.kind, 'access')
          )
        );
      return issueTokens(
        tx,
        credential.id,
        credential.scopes,
        true,
        token.familyId
      );
    }
    throw new DeveloperError(
      'unsupported_grant_type',
      'Use authorization_code or refresh_token.'
    );
  });
  if (result.reuse)
    throw new DeveloperError(
      'invalid_grant',
      'Refresh token reuse detected. Reconnect this client.'
    );
  return result;
}
export async function revokeToken(params: URLSearchParams): Promise<void> {
  const db = await getDb();
  const [token] = await db
    .select()
    .from(developerTokens)
    .where(eq(developerTokens.hash, hash(params.get('token') || '')));
  if (!token) return;
  const [credential] = await db
    .select()
    .from(developerCredentials)
    .where(eq(developerCredentials.id, token.credentialId));
  if (credential?.clientId === params.get('client_id'))
    await db
      .update(developerCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(developerCredentials.id, credential.id));
}
export const protectedResourceMetadata = (): Record<string, unknown> => ({
  resource: resource(),
  authorization_servers: [origin()],
  scopes_supported: [...SCOPES, 'offline_access'],
  bearer_methods_supported: ['header'],
  resource_name: 'FlowchartAI MCP',
  resource_documentation: `${origin()}/developers/docs`,
});
export const authorizationMetadata = (): Record<string, unknown> => ({
  issuer: origin(),
  authorization_endpoint: `${origin()}/api/oauth/authorize`,
  token_endpoint: `${origin()}/api/oauth/token`,
  registration_endpoint: `${origin()}/api/oauth/register`,
  revocation_endpoint: `${origin()}/api/oauth/revoke`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['none'],
  code_challenge_methods_supported: ['S256'],
  scopes_supported: [...SCOPES, 'offline_access'],
});
export async function oauthEndpoint(
  request: Request,
  action: string
): Promise<Response> {
  try {
    await rateLimit(
      `oauth:${action}:${request.headers.get('x-forwarded-for')?.split(',')[0] || 'local'}`,
      action === 'register' ? 10 : 120,
      action === 'register' ? 3600 : 60
    );
    if (action === 'register')
      return json(
        await registerClient(JSON.parse(await readBody(request, 16000))),
        201
      );
    if (action === 'authorize') {
      await authorizationRequest(new URL(request.url).searchParams);
      return Response.redirect(
        `${origin()}/developers/consent?${new URL(request.url).searchParams}`,
        302
      );
    }
    if (
      !request.headers
        .get('content-type')
        ?.startsWith('application/x-www-form-urlencoded')
    )
      throw new DeveloperError(
        'invalid_request',
        'Send form-encoded parameters.'
      );
    const params = new URLSearchParams(await readBody(request, 16000));
    if (action === 'token') return json(await exchangeToken(params));
    if (action === 'revoke') {
      await revokeToken(params);
      return new Response(null, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return json({ error: 'invalid_request' }, 404);
  } catch (error) {
    const known = error instanceof DeveloperError;
    return json(
      {
        error: known ? error.code : 'invalid_request',
        error_description: known ? error.message : 'Invalid OAuth request.',
      },
      known ? error.status : 400
    );
  }
}
