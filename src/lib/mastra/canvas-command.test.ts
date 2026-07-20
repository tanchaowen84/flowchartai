import { describe, expect, it } from 'vitest';
import { createCanvasCommand } from './canvas-command';

describe('createCanvasCommand', () => {
  it('creates a server-owned diagram id and derives the Mermaid family', () => {
    expect(
      createCanvasCommand(
        {
          action: 'create',
          mermaidCode: 'graph TD\n  a --> b',
          description: 'A graph',
        },
        () => 'server-diagram-id'
      )
    ).toEqual({
      kind: 'render-mermaid',
      operation: 'create',
      diagramId: 'server-diagram-id',
      diagramType: 'flowchart',
      mermaidCode: 'graph TD\n  a --> b',
      description: 'A graph',
    });
  });

  it('requires an explicit target for replacement', () => {
    expect(() =>
      createCanvasCommand({
        action: 'replace',
        mermaidCode: 'sequenceDiagram\n  A->>B: Hello',
        description: 'Sequence',
      })
    ).toThrow(/target/i);
  });

  it('passes a validated patch as a complete browser command', () => {
    const patch = {
      patchId: 'patch-1',
      diagramId: 'diagram-1',
      baseRevision: 1,
      operations: [
        {
          type: 'updateNode' as const,
          semanticId: 'a',
          changes: { label: 'Updated' },
        },
      ],
    };

    expect(
      createCanvasCommand({
        action: 'patch',
        patch,
        description: 'Update A',
      })
    ).toEqual({
      kind: 'patch-diagram',
      patch,
      description: 'Update A',
    });
  });
});
