/** Hashed developer credentials never enter Better Auth's session pipeline. */
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import {
  developerCredentials,
  developerRateWindows,
  developerSettings,
  developerTokens,
} from '@/db/developer-schema';
import { user } from '@/db/schema';
import { billingEnabled } from '@/lib/billing/policy';
import type { BillingTx } from '@/lib/billing/wallet';
import { and, eq, sql } from 'drizzle-orm';
import {
  DeveloperError,
  type Principal,
  hash,
  keySchema,
  resource,
  secret,
} from './contract';

export type Credential = typeof developerCredentials.$inferSelect;
export function publicCredential(
  credential: Credential
): Omit<Credential, 'secretHash'> {
  const { secretHash: _, ...safe } = credential;
  return safe;
}
export function assertLive(
  credential: Credential | undefined
): asserts credential is Credential {
  if (!credential || credential.revokedAt || credential.expiresAt <= new Date())
    throw new DeveloperError(
      'unauthorized',
      'This credential is invalid, expired or revoked.',
      401
    );
}
export async function ownerPolicy(
  userId: string,
  tx?: BillingTx
): Promise<typeof developerSettings.$inferSelect> {
  const db = tx || (await getDb());
  const [owner] = await db
    .select({ id: user.id, banned: user.banned, banExpires: user.banExpires })
    .from(user)
    .where(eq(user.id, userId));
  if (
    !owner ||
    (owner.banned && (!owner.banExpires || owner.banExpires > new Date()))
  )
    throw new DeveloperError(
      'account_unavailable',
      'This account is unavailable.',
      403
    );
  const [settings] = await db
    .select()
    .from(developerSettings)
    .where(eq(developerSettings.userId, userId));
  if (settings && !settings.enabled)
    throw new DeveloperError(
      'developer_disabled',
      'Developer access is disabled.',
      403
    );
  return (
    settings || {
      userId,
      enabled: true,
      dailyCredits: 1000,
      dailyRequests: 100,
    }
  );
}
async function insertKey(
  tx: BillingTx,
  userId: string,
  input: unknown
): Promise<{ key: string; credential: ReturnType<typeof publicCredential> }> {
  const data = keySchema.parse(input);
  const key = secret('fca_key_');
  const [credential] = await tx
    .insert(developerCredentials)
    .values({
      id: randomUUID(),
      userId,
      kind: 'key',
      name: data.name,
      prefix: key.slice(0, 16),
      secretHash: hash(key),
      scopes: [...new Set(data.scopes)],
      dailyCredits: data.daily_credits,
      dailyRequests: data.daily_requests,
      rateLimit: data.requests_per_minute,
      expiresAt: new Date(Date.now() + data.expires_in_days * 86400000),
    })
    .returning();
  return { key, credential: publicCredential(credential) };
}
export async function createKey(
  userId: string,
  input: unknown
): Promise<{ key: string; credential: ReturnType<typeof publicCredential> }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.select().from(user).where(eq(user.id, userId)).for('update');
    await ownerPolicy(userId, tx);
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
        'key_limit',
        'Revoke an unused credential before creating another.',
        409
      );
    return insertKey(tx, userId, input);
  });
}
export async function revokeCredential(
  userId: string,
  id: string
): Promise<void> {
  const [row] = await (await getDb())
    .update(developerCredentials)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(developerCredentials.id, id),
        eq(developerCredentials.userId, userId)
      )
    )
    .returning({ id: developerCredentials.id });
  if (!row) throw new DeveloperError('not_found', 'Credential not found.', 404);
}
export async function rotateKey(
  userId: string,
  id: string
): Promise<{ key: string; credential: ReturnType<typeof publicCredential> }> {
  return (await getDb()).transaction(async (tx) => {
    await tx.select().from(user).where(eq(user.id, userId)).for('update');
    await ownerPolicy(userId, tx);
    const [old] = await tx
      .select()
      .from(developerCredentials)
      .where(
        and(
          eq(developerCredentials.id, id),
          eq(developerCredentials.userId, userId)
        )
      )
      .for('update');
    assertLive(old);
    if (old.kind !== 'key')
      throw new DeveloperError(
        'invalid_credential',
        'Reconnect OAuth clients from the client application.'
      );
    const result = await insertKey(tx, userId, {
      name: old.name,
      scopes: old.scopes,
      daily_credits: old.dailyCredits,
      daily_requests: old.dailyRequests,
      requests_per_minute: old.rateLimit,
      expires_in_days: Math.max(
        1,
        Math.ceil((old.expiresAt.getTime() - Date.now()) / 86400000)
      ),
    });
    await tx
      .update(developerCredentials)
      .set({ expiresAt: old.expiresAt })
      .where(eq(developerCredentials.id, result.credential.id));
    await tx
      .update(developerCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(developerCredentials.id, id));
    return {
      ...result,
      credential: { ...result.credential, expiresAt: old.expiresAt },
    };
  });
}
export async function rateLimit(
  bucket: string,
  limit: number,
  seconds = 60
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const window = Math.floor(now / (seconds * 1000));
  const [row] = await db
    .insert(developerRateWindows)
    .values({
      id: `${hash(bucket)}:${window}`,
      count: 1,
      expiresAt: new Date((window + 1) * seconds * 1000),
    })
    .onConflictDoUpdate({
      target: developerRateWindows.id,
      set: { count: sql`${developerRateWindows.count}+1` },
    })
    .returning();
  if (row.count > limit)
    throw new DeveloperError(
      'rate_limited',
      'Request limit reached. Retry after the current window.',
      429
    );
  // Bounded opportunistic retention; never a business scheduling dependency.
  if (window % 20 === 0)
    await db.execute(
      sql`DELETE FROM developer_rate_windows WHERE id IN (SELECT id FROM developer_rate_windows WHERE expires_at < now() - interval '1 hour' LIMIT 500)`
    );
}
export async function activeCredential(
  principal: Principal,
  tx?: BillingTx
): Promise<Credential> {
  const db = tx || (await getDb());
  const [credential] = await db
    .select()
    .from(developerCredentials)
    .where(
      and(
        eq(developerCredentials.id, principal.credentialId),
        eq(developerCredentials.userId, principal.userId)
      )
    );
  assertLive(credential);
  await ownerPolicy(principal.userId, tx);
  return credential;
}
export async function authenticate(
  request: Request,
  allowOAuth = false
): Promise<Principal> {
  if (!billingEnabled() || process.env.DEVELOPER_API_ENABLED === 'false')
    throw new DeveloperError(
      'developer_unavailable',
      'Developer access is not available.',
      503
    );
  const authorization = request.headers.get('authorization');
  const key = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : request.headers.get('x-api-key');
  if (!key || key.length > 256 || !/^[A-Za-z0-9_-]+$/.test(key))
    throw new DeveloperError(
      'unauthorized',
      'Send a developer API key in Authorization: Bearer.',
      401
    );
  const db = await getDb();
  let credential: Credential | undefined;
  let channel: Principal['channel'] = 'api';
  if (key.startsWith('fca_key_')) {
    [credential] = await db
      .select()
      .from(developerCredentials)
      .where(
        and(
          eq(developerCredentials.secretHash, hash(key)),
          eq(developerCredentials.kind, 'key')
        )
      );
  } else if (allowOAuth && key.startsWith('fca_oat_')) {
    const [token] = await db
      .select()
      .from(developerTokens)
      .where(eq(developerTokens.hash, hash(key)));
    if (
      token?.kind === 'access' &&
      token.resource === resource() &&
      token.expiresAt > new Date()
    ) {
      [credential] = await db
        .select()
        .from(developerCredentials)
        .where(eq(developerCredentials.id, token.credentialId));
      channel = 'mcp';
    }
  }
  assertLive(credential);
  await ownerPolicy(credential.userId);
  await rateLimit(`credential:${credential.id}`, credential.rateLimit);
  await rateLimit(`owner:${credential.userId}`, 120);
  await db
    .update(developerCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(developerCredentials.id, credential.id));
  return {
    userId: credential.userId,
    credentialId: credential.id,
    scopes: credential.scopes,
    channel,
  };
}
