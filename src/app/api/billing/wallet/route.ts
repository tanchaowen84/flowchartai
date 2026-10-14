import { getDb } from '@/db';
import {
  billingSubscriptions,
  billingTasks,
  creditsHistory,
} from '@/db/schema';
import { billingError, billingSession } from '@/lib/billing/http';
import { walletSummary } from '@/lib/billing/wallet';
import { desc, eq } from 'drizzle-orm';
export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const wallet = await walletSummary(owner.id);
    const db = await getDb();
    const history = await db
      .select({
        amount: creditsHistory.amount,
        type: creditsHistory.type,
        description: creditsHistory.description,
        createdAt: creditsHistory.createdAt,
      })
      .from(creditsHistory)
      .where(eq(creditsHistory.userId, owner.id))
      .orderBy(desc(creditsHistory.createdAt))
      .limit(20);
    const subscriptions = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, owner.id));
    return Response.json(
      { ...wallet, history, subscriptions },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return billingError(error);
  }
}
