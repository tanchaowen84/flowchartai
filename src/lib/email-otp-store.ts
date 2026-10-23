/**
 * [INPUT] Normalized email and OTP operation.
 * [OUTPUT] Transaction-scoped PostgreSQL advisory lock and bounded guard state.
 * [POS] Cross-instance serialization using existing verification storage; no schema migration.
 * [UPDATE] Keep guard state contract and auth integration tests in sync.
 */
import { createHash } from 'node:crypto';
import { verification } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { OtpGuardState, OtpGuardStore } from './email-otp-guard';

let lockClient: ReturnType<typeof postgres> | undefined;

export const emailOtpStore: OtpGuardStore = {
  async withLock(email, action) {
    // Separate bounded pool: a lock must not occupy the pool needed by auth
    // or its registration-wallet hook while waiting for those queries.
    lockClient ??= postgres(process.env.DATABASE_URL!, {
      prepare: false,
      max: 2,
    });
    const db = drizzle(lockClient);
    const key = `otp-guard:${createHash('sha256').update(email).digest('hex')}`;
    return db.transaction(async (tx) => {
      // The lock also covers Better Auth's separate queries, across all app instances.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`
      );
      return action({
        async read() {
          const [row] = await tx
            .select()
            .from(verification)
            .where(eq(verification.id, key));
          if (!row || row.expiresAt < new Date()) return null;
          return JSON.parse(row.value) as OtpGuardState;
        },
        async write(state) {
          const record = {
            id: key,
            identifier: key,
            value: JSON.stringify(state),
            expiresAt: new Date(state.windowStarted + 5 * 60 * 1000),
            updatedAt: new Date(),
          };
          await tx
            .insert(verification)
            .values({ ...record, createdAt: new Date() })
            .onConflictDoUpdate({ target: verification.id, set: record });
        },
        async clearCodes() {
          await tx
            .delete(verification)
            .where(eq(verification.identifier, `sign-in-otp-${email}`));
        },
      });
    });
  },
};
