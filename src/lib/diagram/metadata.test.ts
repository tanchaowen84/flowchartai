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
          diagramType: 'flowchart',
          revision: 0,
          originalMermaid: 'flowchart LR\n  A[Old] --> B[Keep]',
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
