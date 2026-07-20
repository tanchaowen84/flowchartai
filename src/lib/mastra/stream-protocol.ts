import { canvasCommandSchema } from '../diagram/contracts';

export type StableAgentEvent =
  | { type: 'text'; content: string }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: 'generate_flowchart';
      args: unknown;
    }
  | { type: 'finish'; toolCallsCompleted: boolean }
  | { type: 'error'; error: string }
  | { type: 'aborted' };

export interface MastraStreamMapper {
  map: (chunk: any) => StableAgentEvent | null;
  isTerminated: () => boolean;
  hasCompletedToolCall: () => boolean;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Agent stream failed';
}

export function createMastraStreamMapper(): MastraStreamMapper {
  let terminated = false;
  let completedToolCall = false;

  return {
    map(chunk: any): StableAgentEvent | null {
      if (terminated) return null;

      if (
        chunk?.type === 'text-delta' &&
        typeof chunk.payload?.text === 'string'
      ) {
        return { type: 'text', content: chunk.payload.text };
      }

      if (
        chunk?.type === 'tool-result' &&
        chunk.payload?.toolName === 'generate_flowchart'
      ) {
        const command = canvasCommandSchema.safeParse(chunk.payload.result);
        if (!command.success) {
          terminated = true;
          return {
            type: 'error',
            error: 'Agent returned an invalid canvas command',
          };
        }

        completedToolCall = true;
        return {
          type: 'tool-call',
          toolCallId: chunk.payload.toolCallId || '',
          toolName: 'generate_flowchart',
          args: command.data,
        };
      }

      if (chunk?.type === 'abort') {
        terminated = true;
        return { type: 'aborted' };
      }

      if (chunk?.type === 'error' || chunk?.type === 'tool-error') {
        terminated = true;
        return {
          type: 'error',
          error: errorMessage(chunk.payload?.error),
        };
      }

      if (chunk?.type === 'finish') {
        terminated = true;
        return { type: 'finish', toolCallsCompleted: completedToolCall };
      }

      return null;
    },
    isTerminated: () => terminated,
    hasCompletedToolCall: () => completedToolCall,
  };
}

export function mapMastraChunk(chunk: any): StableAgentEvent | null {
  return createMastraStreamMapper().map(chunk);
}
