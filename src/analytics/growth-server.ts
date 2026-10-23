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
/** Server-only receipt from UPDATE ... RETURNING, captured before deferring.
 * Later edits/deletion must not erase a successfully committed save milestone.
 * Never accept this receipt from the browser measurement endpoint.
 */
export async function recordConfirmedSave(
  userId: string,
  file: { id: string; userId: string; content: string },
  recordedAt: Date,
  occurrenceId: string
): Promise<boolean> {
  if (
    !growthEnabled() ||
    file.userId !== userId ||
    !hasSavedContent(file.content)
  )
    return false;
  try {
    const db = await getDb();
    await db
      .insert(growthEvents)
      .values({
        id: `save:${file.id}:${occurrenceId}`,
        name: 'save_succeeded',
        userId,
        flowchartId: file.id,
        recordedAt,
        properties: {},
      })
      .onConflictDoNothing();
    return true;
  } catch {
    console.warn('growth_save_write_failed');
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
  /** Server-only milestone time, captured before deferring the write. */
  recordedAt?: Date;
}
export async function recordGrowth(
  userId: string,
  event: GrowthObservation
): Promise<boolean> {
  if (!growthEnabled()) return false;
  if (event.name === 'result_delivered' && !event.taskId) return false;
  try {
    const db = await getDb();
    let taskResult: Record<string, any> | undefined;
    let deliveredAt: Date | undefined;
    let linkedFileId = event.flowchartId;
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
      if (
        event.name === 'result_ready' &&
        !taskResult?.delivery &&
        !taskResult?.events?.some(
          (item: any) =>
            item.type === 'tool-call' &&
            ['render-mermaid', 'patch-diagram'].includes(item.args?.kind)
        )
      )
        return false;
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
      if (!file || !hasSavedContent(file.content)) {
        // The committed task is durable delivery evidence even when a later
        // clear/delete makes the best-effort deferred file lookup unavailable.
        if (event.name !== 'result_delivered') return false;
        linkedFileId = undefined;
      } else if (event.taskId) {
        const document = JSON.parse(file.content);
        if (taskResult?.delivery) {
          if (document.documentId !== taskResult.delivery.documentId) {
            if (event.name !== 'result_delivered') return false;
            linkedFileId = undefined;
          }
          // Ready is client-observed on this same document; only server delivery
          // asserts that this revision has also reached persistence.
          if (
            event.name === 'result_delivered' &&
            document.revision < taskResult.delivery.revision
          )
            linkedFileId = undefined;
        } else if (
          event.name === 'result_ready' &&
          event.properties?.editor === 'excalidraw'
        ) {
          const command = taskResult?.events?.find(
            (item: any) => item.type === 'tool-call'
          )?.args;
          const diagramId = command?.patch?.diagramId || command?.diagramId;
          const linked =
            diagramId &&
            document.elements?.some(
              (item: any) =>
                !item.isDeleted && item.customData?.diagramId === diagramId
            );
          // Keep a valid client-ready task observation even when old saved files
          // lack diagram metadata. Never invent a same-file association.
          if (!linked) linkedFileId = undefined;
        } else return false;
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
        flowchartId: linkedFileId,
        id:
          event.name === 'result_ready' && event.taskId
            ? `ready:${event.taskId}`
            : event.id,
        recordedAt: deliveredAt || event.recordedAt,
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
