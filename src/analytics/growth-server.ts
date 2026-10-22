/** [INPUT] Authenticated owner and verified business keys.
 * [OUTPUT] Internal, best-effort, idempotent observations; no third-party sender.
 * [POS] Growth joins for TAN-599. Schema migration precedes flag enablement.
 */
import { getDb } from '@/db';
import { growthAcquisition, growthEvents } from '@/db/growth-schema';
import { billingCheckouts, billingTasks, flowcharts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { type Acquisition, registrationAcquisition } from './acquisition';
import { sanitizeEventProperties } from './core-goals';
import { hasLiveSceneContent, hasNativeExportContent } from './export-content';
export function growthEnabled(): boolean {
  return process.env.GROWTH_MEASUREMENT === 'true';
}
export function hasSavedContent(content: string): boolean {
  try {
    const doc = JSON.parse(content);
    return doc.editorKind === 'drawio'
      ? hasNativeExportContent(doc)
      : Array.isArray(doc.elements) && hasLiveSceneContent(doc.elements);
  } catch {
    return false;
  }
}
export async function bindAcquisition(
  userId: string,
  registeredAt: Date,
  value: Acquisition | null
): Promise<boolean> {
  if (!growthEnabled()) return false;
  try {
    const db = await getDb();
    const observation = registrationAcquisition(value, registeredAt.getTime());
    await db
      .insert(growthAcquisition)
      .values({
        userId,
        captureKey: observation.captureKey || null,
        observation,
      })
      .onConflictDoNothing();
    // A capture can belong to only one account, including concurrent bind attempts.
    await db
      .insert(growthAcquisition)
      .values({
        userId,
        observation: registrationAcquisition(null, registeredAt.getTime()),
      })
      .onConflictDoNothing();
    return true;
  } catch {
    console.warn('growth_acquisition_write_failed');
    return false;
  }
}
export interface GrowthObservation {
  id: string;
  name:
    | 'result_ready'
    | 'result_delivered'
    | 'save_succeeded'
    | 'export_initiated'
    | 'paywall_viewed'
    | 'checkout_handoff';
  taskId?: string;
  flowchartId?: string;
  checkoutId?: string;
  source?: 'paywall' | 'pricing';
  properties?: Record<string, unknown>;
}
export async function recordGrowth(
  userId: string,
  event: GrowthObservation
): Promise<boolean> {
  if (!growthEnabled()) return false;
  try {
    const db = await getDb();
    let taskResult: Record<string, any> | undefined;
    let deliveredAt: Date | undefined;
    // Ownership is always checked here, even for events originating in server code.
    if (event.taskId) {
      const [task] = await db
        .select()
        .from(billingTasks)
        .where(
          and(
            eq(billingTasks.id, event.taskId),
            eq(billingTasks.userId, userId)
          )
        );
      if (!task || !['ready', 'committed'].includes(task.state)) return false;
      taskResult = task.result as Record<string, any>;
      if (event.name === 'result_delivered') deliveredAt = task.updatedAt;
      if (
        event.name === 'result_delivered' &&
        (!taskResult?.delivery?.nodeIds?.length || task.state !== 'committed')
      )
        return false;
    }
    if (event.flowchartId) {
      const [file] = await db
        .select({ content: flowcharts.content })
        .from(flowcharts)
        .where(
          and(
            eq(flowcharts.id, event.flowchartId),
            eq(flowcharts.userId, userId)
          )
        );
      if (!file || !hasSavedContent(file.content)) return false;
      if (event.taskId) {
        const document = JSON.parse(file.content);
        if (
          !taskResult?.delivery ||
          document.documentId !== taskResult.delivery.documentId ||
          document.revision < taskResult.delivery.revision
        )
          return false;
      }
    }
    if (event.checkoutId) {
      const [checkout] = await db
        .select({ url: billingCheckouts.checkoutUrl })
        .from(billingCheckouts)
        .where(
          and(
            eq(billingCheckouts.id, event.checkoutId),
            eq(billingCheckouts.userId, userId)
          )
        );
      if (!checkout?.url || new URL(checkout.url).protocol !== 'https:')
        return false;
    }
    await db
      .insert(growthEvents)
      .values({
        ...event,
        id:
          event.name === 'result_ready' && event.taskId
            ? `ready:${event.taskId}`
            : event.id,
        recordedAt: deliveredAt,
        userId,
        properties: sanitizeEventProperties(event.properties || {}),
      })
      .onConflictDoNothing();
    return true;
  } catch {
    console.warn('growth_event_write_failed');
    return false;
  }
}
