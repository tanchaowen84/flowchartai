import { getDb } from '@/db';
import { billingTasks } from '@/db/schema';
import { billingError, billingSession } from '@/lib/billing/http';
import { finalizeTask } from '@/lib/billing/wallet';
import { and, eq } from 'drizzle-orm';
export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    const db = await getDb();
    const [task] = await db
      .select()
      .from(billingTasks)
      .where(and(eq(billingTasks.id, id), eq(billingTasks.userId, owner.id)));
    if (!task)
      return Response.json({ error: 'Task not found' }, { status: 404 });
    return Response.json(
      {
        id: task.id,
        firstDiagram:
          task.firstDiagram && Boolean((task.result as any)?.delivery),
        state: task.state,
        result: task.result,
        charged: task.charged,
        resultHash: task.resultHash,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return billingError(error);
  }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await billingSession(request);
    const body = await request.json();
    if (typeof body.taskId !== 'string')
      return Response.json({ error: 'Invalid task' }, { status: 400 });
    // Result receipt only: usage, amount and repair funding remain server-owned.
    if (body.action === 'commit') {
      if (
        typeof body.resultHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.resultHash)
      )
        return Response.json(
          { error: 'Invalid result receipt' },
          { status: 400 }
        );
      return Response.json(
        await finalizeTask(
          owner.id,
          body.taskId,
          body.resultHash,
          undefined,
          typeof body.flowchartId === 'string' ? body.flowchartId : undefined
        )
      );
    }
    return Response.json(await finalizeTask(owner.id, body.taskId));
  } catch (error) {
    return billingError(error);
  }
}
