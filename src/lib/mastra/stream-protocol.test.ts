import { describe, expect, it, vi } from 'vitest';
import { createMastraStreamMapper, mapMastraChunk } from './stream-protocol';

const baseChunk = { runId: 'run-1', from: 'AGENT' };

describe('mapMastraChunk', () => {
  it('maps Mastra text deltas to the stable existing SSE shape', () => {
    expect(
      mapMastraChunk({
        ...baseChunk,
        type: 'text-delta',
        payload: { id: 'text-1', text: 'Mapping your flow.' },
      })
    ).toEqual({ type: 'text', content: 'Mapping your flow.' });
  });

  it.each(['tool-call-input-streaming-start', 'tool-call-delta', 'tool-call'])(
    'never exposes incomplete tool data from %s',
    (type) => {
      expect(
        mapMastraChunk({
          ...baseChunk,
          type,
          payload: {
            toolCallId: 'call-1',
            toolName: 'generate_flowchart',
            argsTextDelta: '{"kind":"patch',
            args: { incomplete: true },
          },
        })
      ).toBeNull();
    }
  );

  it('emits a browser canvas command only from a completed tool result', () => {
    const command = {
      kind: 'render-mermaid',
      operation: 'create',
      diagramId: 'diagram-1',
      diagramType: 'flowchart',
      mermaidCode: 'flowchart LR\n  a[A] --> b[B]',
      description: 'A to B',
    };

    expect(
      mapMastraChunk({
        ...baseChunk,
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'generate_flowchart',
          result: command,
        },
      })
    ).toEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'generate_flowchart',
      args: command,
    });
  });

  it('maps abort, error, and finish without fabricating a successful tool call', () => {
    expect(
      mapMastraChunk({ ...baseChunk, type: 'abort', payload: {} })
    ).toEqual({ type: 'aborted' });
    expect(
      mapMastraChunk({
        ...baseChunk,
        type: 'error',
        payload: { error: new Error('provider failed') },
      })
    ).toEqual({ type: 'error', error: 'provider failed' });
    expect(
      mapMastraChunk({
        ...baseChunk,
        type: 'finish',
        payload: { stepResult: { reason: 'stop' }, output: { usage: {} } },
      })
    ).toEqual({ type: 'finish', toolCallsCompleted: false });
  });

  it('marks finish complete only after a valid completed tool result', () => {
    const mapper = createMastraStreamMapper();

    expect(
      mapper.map({
        ...baseChunk,
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'generate_flowchart',
          result: {
            kind: 'render-mermaid',
            operation: 'create',
            diagramId: 'diagram-1',
            diagramType: 'flowchart',
            mermaidCode: 'flowchart LR\n  a[A] --> b[B]',
            description: 'A to B',
          },
        },
      })
    ).toEqual(expect.objectContaining({ type: 'tool-call' }));
    expect(
      mapper.map({
        ...baseChunk,
        type: 'finish',
        payload: { stepResult: { reason: 'stop' }, output: { usage: {} } },
      })
    ).toEqual({ type: 'finish', toolCallsCompleted: true });
  });

  it('closes the mapper on abort and ignores every later chunk', () => {
    const mapper = createMastraStreamMapper();

    expect(mapper.map({ ...baseChunk, type: 'abort', payload: {} })).toEqual({
      type: 'aborted',
    });
    expect(
      mapper.map({
        ...baseChunk,
        type: 'tool-result',
        payload: {
          toolCallId: 'late-call',
          toolName: 'generate_flowchart',
          result: { kind: 'late-command' },
        },
      })
    ).toBeNull();
    expect(
      mapper.map({
        ...baseChunk,
        type: 'finish',
        payload: { stepResult: { reason: 'stop' }, output: { usage: {} } },
      })
    ).toBeNull();
  });

  it('reports invalid tool output with safe validation paths only', () => {
    const onDiagnostic = vi.fn();
    const mapper = createMastraStreamMapper({ onDiagnostic });

    expect(
      mapper.map({
        ...baseChunk,
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'generate_flowchart',
          result: {
            kind: 'patch-diagram',
            patch: {
              diagramId: 'diagram-secret',
              baseRevision: 'wrong',
              operations: [],
            },
          },
        },
      })
    ).toEqual({
      type: 'error',
      error: 'Agent returned an invalid canvas command',
    });

    expect(onDiagnostic).toHaveBeenCalledWith({
      stage: 'tool_validation',
      status: 'failed',
      code: 'invalid_canvas_command',
      validationIssues: expect.arrayContaining([
        expect.objectContaining({
          code: expect.any(String),
          path: expect.any(String),
        }),
      ]),
    });
    expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain(
      'diagram-secret'
    );
  });

  it('reports tool failures without returning raw tool arguments', () => {
    const onDiagnostic = vi.fn();
    const mapper = createMastraStreamMapper({ onDiagnostic });

    mapper.map({
      ...baseChunk,
      type: 'tool-error',
      payload: {
        toolName: 'generate_flowchart',
        args: {
          prompt: 'private prompt',
          patch: { diagramId: 'diagram-secret' },
        },
        error: new Error('Revision conflict: expected 2, received 1'),
      },
    });

    expect(onDiagnostic).toHaveBeenCalledWith({
      stage: 'tool_validation',
      status: 'failed',
      code: 'revision_conflict',
      errorName: 'Error',
    });
    expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain(
      'private prompt'
    );
    expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain(
      'diagram-secret'
    );
  });
});
