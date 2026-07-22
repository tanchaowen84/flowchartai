import { describe, expect, it } from 'vitest';
import {
  deriveFlowchartAiMetadataFromElements,
  emptyFlowchartAiMetadata,
  parseFlowchartAiMetadata,
} from './metadata';
import { applyDiagramPatch } from './patch-engine';
import { resolveDiagramTarget } from './target-resolver';

describe('flowchart AI metadata persistence', () => {
  it('loads valid metadata embedded in an Excalidraw file', () => {
    const content = JSON.stringify({
      elements: [],
      flowchartAi: {
        schemaVersion: 1,
        diagrams: {},
        mermaidDiagrams: {
          sequence: {
            diagramId: 'sequence',
            diagramType: 'sequenceDiagram',
            revision: 2,
            sourceMermaid: 'sequenceDiagram\nA->>B: Hi',
          },
        },
      },
    });

    expect(
      parseFlowchartAiMetadata(content).mermaidDiagrams?.sequence.revision
    ).toBe(2);
  });

  it('uses empty metadata for legacy or invalid files', () => {
    expect(parseFlowchartAiMetadata('{"elements":[]}')).toEqual(
      emptyFlowchartAiMetadata()
    );
    expect(parseFlowchartAiMetadata('not-json')).toEqual(
      emptyFlowchartAiMetadata()
    );
  });

  it('downgrades incompatible V1 diagrams per record without discarding valid metadata', () => {
    const document = (
      diagramId: string,
      sourceMermaid: string,
      overrides: Record<string, unknown> = {}
    ) => ({
      schemaVersion: 1,
      diagramId,
      diagramType: 'flowchart',
      mermaidKeyword: 'flowchart',
      direction: 'LR',
      revision: 3,
      sourceMermaid,
      nodes: [
        { semanticId: 'A', label: 'Start', shape: 'rectangle' },
        { semanticId: 'B', label: 'Done', shape: 'rectangle' },
      ],
      edges: [
        {
          semanticId: 'A__B',
          sourceSemanticId: 'A',
          targetSemanticId: 'B',
          lineStyle: 'solid',
        },
      ],
      groups: [],
      ...overrides,
    });
    const validSource = 'flowchart LR\n  A[Start] --> B[Done]';
    const edgeStyleSource =
      'flowchart LR\n  A[Start] --> B[Done]\n  linkStyle 0 stroke:#f00';
    const dottedSource = 'flowchart LR\n  A[Start] -.-> B[Done]';
    const oldShapeSource = 'flowchart LR\n  A[(Database)] --> B[Done]';

    const restored = parseFlowchartAiMetadata(
      JSON.stringify({
        flowchartAi: {
          schemaVersion: 1,
          diagrams: {
            valid: document('valid', validSource),
            'edge-style': document('edge-style', edgeStyleSource, {
              edges: [
                {
                  semanticId: 'A__B',
                  sourceSemanticId: 'A',
                  targetSemanticId: 'B',
                  lineStyle: 'solid',
                  style: { stroke: '#ff0000' },
                },
              ],
            }),
            dotted: document('dotted', dottedSource, {
              edges: [
                {
                  semanticId: 'A__B',
                  sourceSemanticId: 'A',
                  targetSemanticId: 'B',
                  lineStyle: 'dotted',
                },
              ],
            }),
            'old-shape': document('old-shape', oldShapeSource, {
              nodes: [
                { semanticId: 'A', label: 'Database', shape: 'cylinder' },
                { semanticId: 'B', label: 'Done', shape: 'rectangle' },
              ],
            }),
          },
          mermaidDiagrams: {
            sequence: {
              diagramId: 'sequence',
              diagramType: 'sequenceDiagram',
              revision: 7,
              sourceMermaid: 'sequenceDiagram\nA->>B: preserved',
            },
          },
        },
      })
    );

    expect(restored.diagrams).toEqual({
      valid: expect.objectContaining({
        diagramId: 'valid',
        sourceMermaid: validSource,
      }),
    });
    expect(restored.mermaidDiagrams).toEqual(
      expect.objectContaining({
        sequence: expect.objectContaining({ revision: 7 }),
        'edge-style': expect.objectContaining({
          diagramType: 'flowchart',
          revision: 3,
          sourceMermaid: edgeStyleSource,
        }),
        dotted: expect.objectContaining({
          diagramType: 'flowchart',
          revision: 3,
          sourceMermaid: dottedSource,
        }),
        'old-shape': expect.objectContaining({
          diagramType: 'flowchart',
          revision: 3,
          sourceMermaid: oldShapeSource,
        }),
      })
    );
  });

  it('restores the document revision from the scene after Undo', () => {
    const latest = {
      schemaVersion: 1 as const,
      diagrams: {
        main: {
          schemaVersion: 1 as const,
          diagramId: 'main',
          diagramType: 'flowchart' as const,
          mermaidKeyword: 'flowchart' as const,
          direction: 'LR' as const,
          revision: 1,
          sourceMermaid: 'flowchart LR\n  A[New] --> B[Keep]',
          nodes: [
            { semanticId: 'A', label: 'New', shape: 'rectangle' as const },
            { semanticId: 'B', label: 'Keep', shape: 'rectangle' as const },
          ],
          edges: [
            {
              semanticId: 'A__B',
              sourceSemanticId: 'A',
              targetSemanticId: 'B',
              lineStyle: 'solid' as const,
            },
          ],
          groups: [],
        },
      },
    };

    const restored = deriveFlowchartAiMetadataFromElements(
      [
        {
          id: 'flowchartai:main:node:A',
          customData: {
            aiGenerated: true,
            diagramId: 'main',
            diagramType: 'flowchart',
            revision: 0,
            originalMermaid: 'flowchart LR\n  A[Old] --> B[Keep]',
          },
        },
      ],
      latest
    );

    expect(restored.diagrams.main).toMatchObject({
      revision: 0,
      sourceMermaid: 'flowchart LR\n  A[Old] --> B[Keep]',
    });
  });

  it('removes metadata when Undo removes a newly created diagram', () => {
    expect(
      deriveFlowchartAiMetadataFromElements([], {
        schemaVersion: 1,
        diagrams: {},
        mermaidDiagrams: {
          created: {
            diagramId: 'created',
            diagramType: 'sequenceDiagram',
            revision: 0,
            sourceMermaid: 'sequenceDiagram\nA->>B: Hi',
          },
        },
      })
    ).toEqual(emptyFlowchartAiMetadata());
  });

  it('keeps Undo, save, reload, and the next patch on the same revision', () => {
    const undoElements = [
      {
        id: 'flowchartai:main:node:A',
        customData: {
          aiGenerated: true,
          diagramId: 'main',
          semanticId: 'A',
          entityType: 'node',
          diagramType: 'flowchart',
          revision: 0,
          originalMermaid: 'flowchart LR\n  A[Old] --> B[Keep]',
        },
      },
      {
        id: 'flowchartai:main:node:B',
        customData: {
          aiGenerated: true,
          diagramId: 'main',
          semanticId: 'B',
          entityType: 'node',
          diagramType: 'flowchart',
          revision: 0,
        },
      },
      {
        id: 'flowchartai:main:edge:A__B',
        customData: {
          aiGenerated: true,
          diagramId: 'main',
          semanticId: 'A__B',
          entityType: 'edge',
          diagramType: 'flowchart',
          revision: 0,
        },
      },
    ];
    const staleMetadata = {
      schemaVersion: 1 as const,
      diagrams: {},
      mermaidDiagrams: {
        main: {
          diagramId: 'main',
          diagramType: 'flowchart',
          revision: 1,
          sourceMermaid: 'flowchart LR\n  A[New] --> B[Keep]',
        },
      },
    };
    const afterUndo = deriveFlowchartAiMetadataFromElements(
      undoElements,
      staleMetadata
    );
    const afterReload = parseFlowchartAiMetadata(
      JSON.stringify({ elements: undoElements, flowchartAi: afterUndo })
    );
    const target = resolveDiagramTarget({
      elements: undoElements,
      selectedElementIds: {},
      metadata: afterReload,
    });

    expect(target).toMatchObject({
      status: 'resolved',
      diagramId: 'main',
      patchable: true,
      document: { revision: 0 },
    });
    if (target.status !== 'resolved' || !target.document) {
      throw new Error('Expected a restored managed diagram');
    }

    expect(
      applyDiagramPatch(target.document, {
        patchId: 'after-undo',
        diagramId: 'main',
        baseRevision: 0,
        operations: [
          {
            type: 'updateNode',
            semanticId: 'A',
            changes: { label: 'Patched after reload' },
          },
        ],
      })
    ).toMatchObject({ revision: 1 });
  });
});
