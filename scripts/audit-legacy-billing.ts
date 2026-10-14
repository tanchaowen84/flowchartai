/** Read-only by default. Never alters contract prices, periods, balances or historical ledger. */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '../src/db';
import { payment } from '../src/db/schema';
import {
  type LegacyPlan,
  hasPaidAccess,
  legacyPlanForPayment,
} from '../src/lib/billing/policy';
async function main(): Promise<void> {
  const db = await getDb();
  const columns = await db.execute(
    sql`select column_name from information_schema.columns where table_schema='public' and table_name='payment'`
  );
  const snapshots = Array.from(columns).some(
    (r: any) => r.column_name === 'legacy_plan'
  );
  const rows = await db
    .select({
      id: payment.id,
      priceId: payment.priceId,
      status: payment.status,
      periodEnd: payment.periodEnd,
      cancelAtPeriodEnd: payment.cancelAtPeriodEnd,
      metadata: payment.metadata,
      ...(snapshots
        ? { provider: payment.provider, legacyPlan: payment.legacyPlan }
        : {}),
    })
    .from(payment)
    .where(
      and(eq(payment.type, 'subscription'), gt(payment.periodEnd, new Date()))
    );
  const mapFile = process.argv
    .find((a) => a.startsWith('--mapping='))
    ?.split('=')[1];
  const mappings: Record<string, LegacyPlan> = mapFile
    ? JSON.parse(await readFile(mapFile, 'utf8'))
    : {};
  const active = rows.filter((p) => p.provider !== 'waffo' && hasPaidAccess(p));
  const unresolved = active.filter(
    (p) => !legacyPlanForPayment(p) && !mappings[p.priceId]
  );
  const report = {
    activeContracts: active.length,
    alreadyFrozen: active.filter((p) => p.legacyPlan).length,
    hobby: active.filter((p) => legacyPlanForPayment(p) === 'hobby').length,
    professional: active.filter(
      (p) => legacyPlanForPayment(p) === 'professional'
    ).length,
    unresolvedProductIds: [...new Set(unresolved.map((p) => p.priceId))],
    balancesOrLedgerChanged: false,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--apply')) {
    if (!snapshots)
      throw new Error('Apply additive migration before freezing snapshots');
    if (unresolved.length)
      throw new Error(
        'Resolve historical products before freezing their benefits'
      );
    if (!process.argv.includes('--confirm-target'))
      throw new Error(
        '--apply requires --confirm-target after read-only report review'
      );
    await db.transaction(async (tx) => {
      for (const row of active) {
        const plan = legacyPlanForPayment(row) || mappings[row.priceId];
        if (!['hobby', 'professional'].includes(plan))
          throw new Error('Invalid legacy mapping');
        await tx
          .update(payment)
          .set({ legacyPlan: plan })
          .where(eq(payment.id, row.id));
      }
    });
    console.log('Only legacy plan identifiers frozen.');
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Audit failed');
  process.exit(1);
});
