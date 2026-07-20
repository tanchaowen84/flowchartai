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
          semanticId: 'start_done',
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
          semanticId: 'a_missing',
          sourceSemanticId: 'a',
          targetSemanticId: 'missing',
        },
      ],
      groups: [],
    });

    expect(result.success).toBe(false);
  });

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
            semanticId: 'start_review',
            sourceSemanticId: 'start',
            targetSemanticId: 'review',
          },
        },
        {
          type: 'updateEdge',
          semanticId: 'start_done',
          changes: { label: 'approved' },
        },
        { type: 'removeEdge', semanticId: 'obsolete_edge' },
      ],
    });

    expect(result.operations).toHaveLength(6);
  });
});
