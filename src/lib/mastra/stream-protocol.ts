import { canvasCommandSchema } from '../diagram/contracts';
import {
  type FlowchartDiagnosticEvent,
  classifyFlowchartError,
  extractSafeValidationIssues,
  getSafeErrorName,
} from './flowchart-diagnostics';

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

interface MastraStreamMapperOptions {
  onDiagnostic?: (event: FlowchartDiagnosticEvent) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Agent stream failed';
}

export function createMastraStreamMapper(
  options: MastraStreamMapperOptions = {}
): MastraStreamMapper {
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
          options.onDiagnostic?.({
            stage: 'tool_validation',
            status: 'failed',
            code: 'invalid_canvas_command',
            validationIssues: extractSafeValidationIssues(command.error),
          });
          return {
            type: 'error',
            error: 'Agent returned an invalid canvas command',
          };
        }

        completedToolCall = true;
        options.onDiagnostic?.({
          stage: 'tool_validation',
          status: 'success',
          code: 'canvas_command_valid',
          commandKind: command.data.kind,
          operation:
            command.data.kind === 'patch-diagram'
              ? 'patch'
              : command.data.operation,
          operationCount:
            command.data.kind === 'patch-diagram'
              ? command.data.patch.operations.length
              : undefined,
        });
        return {
          type: 'tool-call',
          toolCallId: chunk.payload.toolCallId || '',
          toolName: 'generate_flowchart',
          args: command.data,
        };
      }

      if (chunk?.type === 'abort') {
        terminated = true;
        options.onDiagnostic?.({
          stage: 'sse_map',
          status: 'aborted',
          code: 'stream_aborted',
        });
        return { type: 'aborted' };
      }

      if (chunk?.type === 'error' || chunk?.type === 'tool-error') {
        terminated = true;
        const error = chunk.payload?.error;
        options.onDiagnostic?.({
          stage: chunk.type === 'tool-error' ? 'tool_validation' : 'sse_map',
          status: 'failed',
          code:
            chunk.type === 'tool-error'
              ? classifyFlowchartError(error)
              : 'agent_stream_error',
          errorName: getSafeErrorName(error),
          validationIssues:
            extractSafeValidationIssues(error).length > 0
              ? extractSafeValidationIssues(error)
              : undefined,
        });
        return {
          type: 'error',
          error: errorMessage(chunk.payload?.error),
        };
      }

      if (chunk?.type === 'finish') {
        terminated = true;
        options.onDiagnostic?.({
          stage: 'sse_map',
          status: 'success',
          code: 'stream_finished',
          toolCallsCompleted: completedToolCall,
        });
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
