import { describe, expect, it } from 'vitest';
import type { FlowchartAiMetadata } from './contracts';
import { resolveDiagramTarget } from './target-resolver';

function element(
  id: string,
  diagramId?: string,
  originalMermaid?: string,
  generatedAt?: number,
  semanticId?: string,
  entityType?: string
) {
  return {
    id,
    customData: {
      aiGenerated: true,
      diagramId,
      originalMermaid,
      generatedAt,
      semanticId,
      entityType,
    },
  };
}

const metadata: FlowchartAiMetadata = {
  schemaVersion: 1,
  diagrams: {},
  mermaidDiagrams: {
    first: {
      diagramId: 'first',
      diagramType: 'sequenceDiagram',
      revision: 0,
      sourceMermaid: 'sequenceDiagram\n A->>B: one',
    },
    second: {
      diagramId: 'second',
      diagramType: 'sequenceDiagram',
      revision: 0,
      sourceMermaid: 'sequenceDiagram\n C->>D: two',
    },
  },
};

describe('resolveDiagramTarget', () => {
  it('uses the selected diagram before considering canvas ambiguity', () => {
    const result = resolveDiagramTarget({
      elements: [element('a', 'first'), element('b', 'second')],
      selectedElementIds: { b: true },
      metadata,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'resolved', diagramId: 'second' })
    );
  });

  it('resolves the sole managed diagram automatically', () => {
    const result = resolveDiagramTarget({
      elements: [element('a', 'first'), { id: 'user-element' }],
      selectedElementIds: {},
      metadata,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'resolved', diagramId: 'first' })
    );
  });

  it('does not mutate when multiple diagrams are ambiguous', () => {
    const result = resolveDiagramTarget({
      elements: [element('a', 'first'), element('b', 'second')],
      selectedElementIds: {},
      metadata,
    });

    expect(result).toEqual({
      status: 'ambiguous',
      diagramIds: ['first', 'second'],
    });
  });

  it('safely groups one legacy diagram by original Mermaid for lazy upgrade', () => {
    const source = 'flowchart LR\n  a --> b';
    const result = resolveDiagramTarget({
      elements: [
        element('legacy-a', undefined, source),
        element('legacy-b', undefined, source),
      ],
      selectedElementIds: {},
      metadata: { schemaVersion: 1, diagrams: {} },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        legacy: true,
        sourceMermaid: source,
        elementIds: ['legacy-a', 'legacy-b'],
      })
    );
  });

  it('expands a selected legacy element to the complete generated diagram', () => {
    const source = 'flowchart LR\n  a --> b';
    const result = resolveDiagramTarget({
      elements: [
        element('legacy-a', undefined, source, 1000),
        element('legacy-b', undefined, source, 1000),
      ],
      selectedElementIds: { 'legacy-a': true },
      metadata: { schemaVersion: 1, diagrams: {} },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        elementIds: ['legacy-a', 'legacy-b'],
      })
    );
  });

  it('keeps two legacy generations separate when their Mermaid is identical', () => {
    const source = 'flowchart LR\n  a --> b';
    const result = resolveDiagramTarget({
      elements: [
        element('first-a', undefined, source, 1000),
        element('first-b', undefined, source, 1000),
        element('second-a', undefined, source, 5000),
        element('second-b', undefined, source, 5000),
      ],
      selectedElementIds: { 'second-a': true },
      metadata: { schemaVersion: 1, diagrams: {} },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        elementIds: ['second-a', 'second-b'],
      })
    );
  });

  it('lazy-upgrades a supported Mermaid record only when scene semantic ids align', () => {
    const source = `flowchart LR
  start-node[Start] --> done-node((Done))
  style start-node fill:#fddf9f,stroke:#d68f2f,stroke-width:2px`;
    const styledMetadata: FlowchartAiMetadata = {
      schemaVersion: 1,
      diagrams: {},
      mermaidDiagrams: {
        styled: {
          diagramId: 'styled',
          diagramType: 'flowchart',
          revision: 2,
          sourceMermaid: source,
        },
      },
    };

    const result = resolveDiagramTarget({
      elements: [
        element('start-shape', 'styled', source, 1000, 'start-node', 'node'),
        element('done-shape', 'styled', source, 1000, 'done-node', 'node'),
        element(
          'edge-shape',
          'styled',
          source,
          1000,
          'start-node__done-node',
          'edge'
        ),
      ],
      selectedElementIds: {},
      metadata: styledMetadata,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        diagramId: 'styled',
        patchable: true,
        document: expect.objectContaining({
          diagramId: 'styled',
          revision: 2,
        }),
      })
    );
  });

  it('requires targeted replace when a legacy scene uses full element ids', () => {
    const source = `flowchart LR
  A[Start] --> B[Done]
  style A fill:#fddf9f,stroke:#d68f2f,stroke-width:2px`;
    const result = resolveDiagramTarget({
      elements: [
        element('legacy-a', 'styled', source, 1000, 'full:rectangle:0', 'node'),
        element('legacy-b', 'styled', source, 1000, 'full:rectangle:1', 'node'),
        element('legacy-edge', 'styled', source, 1000, 'full:arrow:2', 'edge'),
      ],
      selectedElementIds: {},
      metadata: {
        schemaVersion: 1,
        diagrams: {},
        mermaidDiagrams: {
          styled: {
            diagramId: 'styled',
            diagramType: 'flowchart',
            revision: 4,
            sourceMermaid: source,
          },
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        diagramId: 'styled',
        patchable: false,
      })
    );
    if (result.status === 'resolved') {
      expect(result.document).toBeUndefined();
      expect(result.mermaidDiagram?.revision).toBe(4);
    }
  });

  it('does not patch a managed document whose scene semantic ids drifted', () => {
    const source = `flowchart LR
  A[Start] --> B[Done]
  style A fill:#fddf9f,stroke:#d68f2f,stroke-width:2px`;
    const result = resolveDiagramTarget({
      elements: [
        element('legacy-a', 'styled', source, 1000, 'full:rectangle:0', 'node'),
        element('legacy-b', 'styled', source, 1000, 'full:rectangle:1', 'node'),
        element('legacy-edge', 'styled', source, 1000, 'full:arrow:2', 'edge'),
      ],
      selectedElementIds: {},
      metadata: {
        schemaVersion: 1,
        diagrams: {
          styled: {
            schemaVersion: 1,
            diagramId: 'styled',
            diagramType: 'flowchart',
            mermaidKeyword: 'flowchart',
            direction: 'LR',
            revision: 4,
            sourceMermaid: source,
            nodes: [
              {
                semanticId: 'A',
                label: 'Start',
                shape: 'rectangle',
                style: {
                  fill: '#fddf9f',
                  stroke: '#d68f2f',
                  'stroke-width': '2px',
                },
              },
              { semanticId: 'B', label: 'Done', shape: 'rectangle' },
            ],
            edges: [
              {
                semanticId: 'A__B',
                sourceSemanticId: 'A',
                targetSemanticId: 'B',
              },
            ],
            groups: [],
          },
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        diagramId: 'styled',
        patchable: false,
      })
    );
  });

  it.each(['node', 'edge'] as const)(
    'does not align a scene with duplicate %s semantic containers',
    (duplicateType) => {
      const source = 'flowchart LR\n  A[Start] --> B[Done]';
      const baseElements = [
        element('node-a', 'main', source, 1000, 'A', 'node'),
        element('node-b', 'main', source, 1000, 'B', 'node'),
        element('edge-a-b', 'main', source, 1000, 'A__B', 'edge'),
      ];
      const duplicate =
        duplicateType === 'node'
          ? element('node-a-copy', 'main', source, 1000, 'A', 'node')
          : element('edge-a-b-copy', 'main', source, 1000, 'A__B', 'edge');
      const result = resolveDiagramTarget({
        elements: [...baseElements, duplicate],
        selectedElementIds: {},
        metadata: {
          schemaVersion: 1,
          diagrams: {
            main: {
              schemaVersion: 1,
              diagramId: 'main',
              diagramType: 'flowchart',
              mermaidKeyword: 'flowchart',
              direction: 'LR',
              revision: 1,
              sourceMermaid: source,
              nodes: [
                { semanticId: 'A', label: 'Start', shape: 'rectangle' },
                { semanticId: 'B', label: 'Done', shape: 'rectangle' },
              ],
              edges: [
                {
                  semanticId: 'A__B',
                  sourceSemanticId: 'A',
                  targetSemanticId: 'B',
                },
              ],
              groups: [],
            },
          },
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          status: 'resolved',
          diagramId: 'main',
          patchable: false,
          patchBlockReason: 'scene-semantic-id-mismatch',
        })
      );
    }
  );
});
