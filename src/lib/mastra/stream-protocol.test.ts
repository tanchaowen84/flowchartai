import { describe, expect, it } from 'vitest';
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
});
