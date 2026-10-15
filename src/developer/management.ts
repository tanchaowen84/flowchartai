import { getDb } from '@/db';
import {
  developerCredentials,
  developerSettings,
  developerTasks,
} from '@/db/developer-schema';
import { auth } from '@/lib/auth';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  createKey,
  ownerPolicy,
  publicCredential,
  revokeCredential,
  rotateKey,
} from './access';
import { DeveloperError, limitsSchema } from './contract';
import { failure, json, readBody, sameOrigin } from './http';
import { consent } from './oauth';
import { dailyUsage, publicTask } from './service';

export async function websiteOwner(request: Request): Promise<string> {
  const login = await auth.api.getSession({ headers: request.headers });
  if (!login?.user.id)
    throw new DeveloperError(
      'unauthorized',
      'Sign in to manage developer access.',
      401
    );
  // Explicitly query the current user; the website cookie cache is not an authorization source.
  await ownerPolicy(login.user.id);
  return login.user.id;
}
export async function management(request: Request): Promise<Response> {
  try {
    if (request.method !== 'GET') sameOrigin(request);
    const userId = await websiteOwner(request);
    const db = await getDb();
    if (request.method === 'GET') {
      const credentials = await db
        .select()
        .from(developerCredentials)
        .where(eq(developerCredentials.userId, userId))
        .orderBy(
          sql`${developerCredentials.revokedAt} IS NULL DESC`,
          sql`${developerCredentials.expiresAt} > now() DESC`,
          desc(developerCredentials.createdAt)
        )
        .limit(150);
      const tasks = await db
        .select()
        .from(developerTasks)
        .where(eq(developerTasks.userId, userId))
        .orderBy(desc(developerTasks.createdAt))
        .limit(30);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const byCredential = await db
        .select({
          credentialId: developerTasks.credentialId,
          credits: sql<number>`coalesce(sum(${developerTasks.charged}),0)::int`,
          requests: sql<number>`count(*) filter (where ${developerTasks.operation} in ('generate','edit'))::int`,
        })
        .from(developerTasks)
        .where(
          and(
            eq(developerTasks.userId, userId),
            gte(developerTasks.createdAt, today)
          )
        )
        .groupBy(developerTasks.credentialId);
      return json({
        settings: await ownerPolicy(userId),
        credentials: credentials.map((c) => ({
          ...publicCredential(c),
          usage: byCredential.find((u) => u.credentialId === c.id) || {
            credits: 0,
            requests: 0,
          },
        })),
        usage: await dailyUsage(userId),
        tasks: tasks.map((t) => {
          const { diagram, ...safe } = publicTask(t);
          return safe;
        }),
      });
    }
    const body = z
      .object({
        action: z.enum(['create', 'rotate', 'revoke', 'settings', 'consent']),
        id: z.string().uuid().optional(),
        input: z.unknown().optional(),
        query: z.string().max(16000).optional(),
        approved: z.boolean().optional(),
      })
      .strict()
      .parse(JSON.parse(await readBody(request, 32768)));
    if (body.action === 'create')
      return json(await createKey(userId, body.input), 201);
    if (body.action === 'rotate' && body.id)
      return json(await rotateKey(userId, body.id), 201);
    if (body.action === 'revoke' && body.id) {
      await revokeCredential(userId, body.id);
      return json({ revoked: true });
    }
    if (body.action === 'settings') {
      const settings = limitsSchema.strict().parse(body.input);
      await db
        .insert(developerSettings)
        .values({
          userId,
          dailyCredits: settings.daily_credits,
          dailyRequests: settings.daily_requests,
        })
        .onConflictDoUpdate({
          target: developerSettings.userId,
          set: {
            dailyCredits: settings.daily_credits,
            dailyRequests: settings.daily_requests,
          },
        });
      return json({ settings: await ownerPolicy(userId) });
    }
    if (
      body.action === 'consent' &&
      body.query &&
      typeof body.approved === 'boolean'
    )
      return json({
        redirect: await consent(
          userId,
          new URLSearchParams(body.query),
          body.approved
        ),
      });
    throw new DeveloperError('invalid_request', 'Missing action fields.');
  } catch (error) {
    return failure(error);
  }
}
