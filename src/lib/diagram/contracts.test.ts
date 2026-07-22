import { describe, expect, it } from 'vitest';
import { diagramDocumentSchema, diagramPatchSchema } from './contracts';

describe('diagram contracts', () => {
  it('accepts a versioned flowchart document with stable semantic ids', () => {
    const result = diagramDocumentSchema.parse({
      schemaVersion: 1,
      diagramId: 'diagram-1',
      diagramType: 'flowchart',
      mermaidKeyword: 'flowchart',
      direction: 'LR',
      revision: 3,
      sourceMermaid: 'flowchart LR\n  start[Renamed label] --> done[Done]',
      nodes: [
        { semanticId: 'start', label: 'Renamed label', shape: 'rectangle' },
        { semanticId: 'done', label: 'Done', shape: 'rectangle' },
      ],
      edges: [
        {
          semanticId: 'start__done',
          sourceSemanticId: 'start',
          targetSemanticId: 'done',
        },
      ],
      groups: [],
    });

    expect(result.nodes[0]?.semanticId).toBe('start');
    expect(result.nodes[0]?.label).toBe('Renamed label');
  });

  it('rejects dangling edge references', () => {
    const result = diagramDocumentSchema.safeParse({
      schemaVersion: 1,
      diagramId: 'diagram-1',
      diagramType: 'flowchart',
      mermaidKeyword: 'graph',
      direction: 'TD',
      revision: 0,
      sourceMermaid: 'graph TD\n  a --> missing',
      nodes: [{ semanticId: 'a', label: 'A', shape: 'rectangle' }],
      edges: [
        {
          semanticId: 'a__missing',
          sourceSemanticId: 'a',
          targetSemanticId: 'missing',
        },
      ],
      groups: [],
    });

    expect(result.success).toBe(false);
  });

  it('accepts only the patchable node style allowlist', () => {
    const base = {
      schemaVersion: 1 as const,
      diagramId: 'styled',
      diagramType: 'flowchart' as const,
      mermaidKeyword: 'flowchart' as const,
      direction: 'LR' as const,
      revision: 0,
      sourceMermaid: 'flowchart LR\n  A[Start]',
      edges: [],
      groups: [],
    };

    expect(
      diagramDocumentSchema.safeParse({
        ...base,
        nodes: [
          {
            semanticId: 'A',
            label: 'Start',
            shape: 'rectangle',
            style: {
              fill: '#ffffff',
              stroke: '#111111',
              'stroke-width': '2px',
            },
          },
        ],
      }).success
    ).toBe(true);
    expect(
      diagramDocumentSchema.safeParse({
        ...base,
        nodes: [
          {
            semanticId: 'A',
            label: 'Start',
            shape: 'rectangle',
            style: { fill: '#ffffff', color: '#111111' },
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects edge color/style data outside the patchable dialect', () => {
    const result = diagramDocumentSchema.safeParse({
      schemaVersion: 1,
      diagramId: 'styled-edge',
      diagramType: 'flowchart',
      mermaidKeyword: 'flowchart',
      direction: 'LR',
      revision: 0,
      sourceMermaid: 'flowchart LR\n  A --> B',
      nodes: [
        { semanticId: 'A', label: 'A', shape: 'rectangle' },
        { semanticId: 'B', label: 'B', shape: 'rectangle' },
      ],
      edges: [
        {
          semanticId: 'A__B',
          sourceSemanticId: 'A',
          targetSemanticId: 'B',
          style: { stroke: '#ff0000' },
        },
      ],
      groups: [],
    });

    expect(result.success).toBe(false);
  });

  it('requires canonical source__target edge ids and rejects parallel edges', () => {
    const base = {
      schemaVersion: 1 as const,
      diagramId: 'canonical-edges',
      diagramType: 'flowchart' as const,
      mermaidKeyword: 'flowchart' as const,
      direction: 'LR' as const,
      revision: 0,
      sourceMermaid: 'flowchart LR\n  start --> done',
      nodes: [
        { semanticId: 'start', label: 'Start', shape: 'rectangle' as const },
        { semanticId: 'done', label: 'Done', shape: 'rectangle' as const },
      ],
      groups: [],
    };

    expect(
      diagramDocumentSchema.safeParse({
        ...base,
        edges: [
          {
            semanticId: 'edge-1',
            sourceSemanticId: 'start',
            targetSemanticId: 'done',
          },
        ],
      }).success
    ).toBe(false);
    expect(
      diagramDocumentSchema.safeParse({
        ...base,
        edges: [
          {
            semanticId: 'start__done',
            sourceSemanticId: 'start',
            targetSemanticId: 'done',
          },
          {
            semanticId: 'start__done__2',
            sourceSemanticId: 'start',
            targetSemanticId: 'done',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('does not allow updateEdge to change its endpoints', () => {
    const result = diagramPatchSchema.safeParse({
      patchId: 'move-edge',
      diagramId: 'diagram-1',
      baseRevision: 1,
      operations: [
        {
          type: 'updateEdge',
          semanticId: 'start__done',
          changes: { targetSemanticId: 'other' },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it.each(['#12345', '#1234567'])(
    'rejects non-canonical hexadecimal color %s',
    (color) => {
      expect(
        diagramDocumentSchema.safeParse({
          schemaVersion: 1,
          diagramId: 'invalid-color',
          diagramType: 'flowchart',
          mermaidKeyword: 'flowchart',
          direction: 'LR',
          revision: 0,
          sourceMermaid: 'flowchart LR\n  A[Start]',
          nodes: [
            {
              semanticId: 'A',
              label: 'Start',
              shape: 'rectangle',
              style: { fill: color },
            },
          ],
          edges: [],
          groups: [],
        }).success
      ).toBe(false);
    }
  );

  it('validates every supported patch operation without arbitrary size limits', () => {
    const result = diagramPatchSchema.parse({
      patchId: 'patch-1',
      diagramId: 'diagram-1',
      baseRevision: 3,
      operations: [
        {
          type: 'addNode',
          node: { semanticId: 'review', label: 'Review', shape: 'diamond' },
        },
        {
          type: 'updateNode',
          semanticId: 'start',
          changes: { label: 'Begin' },
        },
        { type: 'removeNode', semanticId: 'obsolete' },
        {
          type: 'addEdge',
          edge: {
            semanticId: 'start__review',
            sourceSemanticId: 'start',
            targetSemanticId: 'review',
          },
        },
        {
          type: 'updateEdge',
          semanticId: 'start__done',
          changes: { label: 'approved' },
        },
        { type: 'removeEdge', semanticId: 'obsolete__edge' },
      ],
    });

    expect(result.operations).toHaveLength(6);
  });
});
