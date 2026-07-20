import { describe, expect, it } from 'vitest';
import type { DiagramDocument, DiagramPatch } from './contracts';
import { applyDiagramPatch } from './patch-engine';

function makeDocument(): DiagramDocument {
  return {
    schemaVersion: 1,
    diagramId: 'diagram-1',
    diagramType: 'flowchart',
    mermaidKeyword: 'flowchart',
    direction: 'LR',
    revision: 2,
    sourceMermaid: 'flowchart LR\n  a[A] --> b[B]',
    nodes: [
      { semanticId: 'a', label: 'A', shape: 'rectangle' },
      { semanticId: 'b', label: 'B', shape: 'rectangle' },
    ],
    edges: [
      {
        semanticId: 'a_b',
        sourceSemanticId: 'a',
        targetSemanticId: 'b',
      },
    ],
    groups: [],
  };
}

function makePatch(
  operations: DiagramPatch['operations'],
  overrides: Partial<DiagramPatch> = {}
): DiagramPatch {
  return {
    patchId: 'patch-1',
    diagramId: 'diagram-1',
    baseRevision: 2,
    operations,
    ...overrides,
  };
}

describe('applyDiagramPatch', () => {
  it('atomically applies node and edge additions, updates, and removals', () => {
    const original = makeDocument();
    const next = applyDiagramPatch(
      original,
      makePatch([
        {
          type: 'addNode',
          node: { semanticId: 'c', label: 'C', shape: 'ellipse' },
        },
        { type: 'updateNode', semanticId: 'a', changes: { label: 'Start' } },
        { type: 'removeEdge', semanticId: 'a_b' },
        {
          type: 'addEdge',
          edge: {
            semanticId: 'a_c',
            sourceSemanticId: 'a',
            targetSemanticId: 'c',
            label: 'next',
          },
        },
        {
          type: 'updateEdge',
          semanticId: 'a_c',
          changes: { label: 'continue' },
        },
      ])
    );

    expect(next.revision).toBe(3);
    expect(next.nodes.map((node) => node.semanticId)).toEqual(['a', 'b', 'c']);
    expect(next.nodes[0]?.label).toBe('Start');
    expect(next.edges).toEqual([
      expect.objectContaining({ semanticId: 'a_c', label: 'continue' }),
    ]);
    expect(next.sourceMermaid).toContain('flowchart LR');
    expect(original).toEqual(makeDocument());
  });

  it('allows explicit edge removal and node removal in one atomic patch', () => {
    const next = applyDiagramPatch(
      makeDocument(),
      makePatch([
        { type: 'removeNode', semanticId: 'b' },
        { type: 'removeEdge', semanticId: 'a_b' },
      ])
    );

    expect(next.nodes.map((node) => node.semanticId)).toEqual(['a']);
    expect(next.edges).toEqual([]);
  });

  it('rejects revision conflicts before mutation', () => {
    const original = makeDocument();

    expect(() =>
      applyDiagramPatch(
        original,
        makePatch([], { baseRevision: original.revision - 1 })
      )
    ).toThrow(/revision/i);
    expect(original).toEqual(makeDocument());
  });

  it('rejects node removal when referenced edges were not explicitly removed', () => {
    const original = makeDocument();

    expect(() =>
      applyDiagramPatch(
        original,
        makePatch([{ type: 'removeNode', semanticId: 'b' }])
      )
    ).toThrow(/edge|reference/i);
    expect(original).toEqual(makeDocument());
  });

  it('rolls back every operation when the final document has an invalid reference', () => {
    const original = makeDocument();

    expect(() =>
      applyDiagramPatch(
        original,
        makePatch([
          {
            type: 'updateNode',
            semanticId: 'a',
            changes: { label: 'Should roll back' },
          },
          {
            type: 'addEdge',
            edge: {
              semanticId: 'broken',
              sourceSemanticId: 'a',
              targetSemanticId: 'missing',
            },
          },
        ])
      )
    ).toThrow(/reference|missing/i);
    expect(original.nodes[0]?.label).toBe('A');
  });
});
