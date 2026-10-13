export type AssistantPhase =
  | 'idle'
  | 'thinking'
  | 'responding'
  | 'building'
  | 'preparing'
  | 'editing'
  | 'rendering'
  | 'complete'
  | 'cancelling';

export interface DiagramTaskStatus {
  active: boolean;
  phase: AssistantPhase;
  startedAt: number | null;
  outcome: 'ready' | 'done' | 'failed' | 'cancelled';
}

/** Text output does not mean that a drawing task is finished. */
export function taskStatusLabel(status: DiagramTaskStatus): string {
  if (!status.active)
    return {
      ready: 'Ready',
      done: 'Diagram updated',
      failed: 'Request failed · diagram kept',
      cancelled: 'Cancelled · diagram kept',
    }[status.outcome];
  return {
    idle: 'Processing request…',
    thinking: 'Understanding your request…',
    responding: 'Preparing the response…',
    building: 'Building diagram objects…',
    preparing: 'Preparing layout and connections…',
    editing: 'Preparing the change…',
    rendering: 'Applying to the canvas…',
    complete: 'Diagram applied · completing request…',
    cancelling: 'Cancelling request…',
  }[status.phase];
}
