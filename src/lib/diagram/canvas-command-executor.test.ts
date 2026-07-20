import { describe, expect, it, vi } from 'vitest';
import { prepareCanvasCommand } from './canvas-command-executor';
import type { CanvasCommand, FlowchartAiMetadata } from './contracts';
import type { DiagramTargetResolution } from './target-resolver';

const metadata: FlowchartAiMetadata = {
  schemaVersion: 1,
  diagrams: {
    main: {
      schemaVersion: 1,
      diagramId: 'main',
      diagramType: 'flowchart',
      mermaidKeyword: 'flowchart',
      direction: 'LR',
      revision: 0,
      sourceMermaid: 'flowchart LR\n  A[Old] --> B[Keep]',
      nodes: [
        { semanticId: 'A', label: 'Old', shape: 'rectangle' },
        { semanticId: 'B', label: 'Keep', shape: 'rectangle' },
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
    },
  },
};

const target: DiagramTargetResolution = {
  status: 'resolved',
  diagramId: 'main',
  document: metadata.diagrams.main,
  patchable: true,
};

const currentElements = [
  { id: 'user-note', x: 500, y: 500 },
  {
    id: 'node-a-current',
    x: 10,
    y: 20,
    customData: { diagramId: 'main', semanticId: 'A', entityType: 'node' },
  },
  {
    id: 'node-b-current',
    x: 300,
    y: 20,
    customData: { diagramId: 'main', semanticId: 'B', entityType: 'node' },
  },
  {
    id: 'edge-current',
    x: 100,
    y: 20,
    customData: {
      diagramId: 'main',
      semanticId: 'A__B',
      entityType: 'edge',
    },
  },
];

describe('prepareCanvasCommand', () => {
  it('creates a managed flowchart without removing user elements', async () => {
    const command: CanvasCommand = {
      kind: 'render-mermaid',
      operation: 'create',
      diagramId: 'created',
      diagramType: 'flowchart',
      mermaidCode: 'flowchart LR\n  A[Start] --> B[Done]',
      description: 'Create',
    };
    const userElement = { id: 'user-note', x: 500, y: 500 };

    const prepared = await prepareCanvasCommand({
      command,
      currentElements: [userElement],
      metadata: { schemaVersion: 1, diagrams: {} },
      targetResolution: { status: 'none' },
      renderFlowchart: async () => [
        {
          id: 'created-node',
          x: 0,
          y: 0,
          customData: {
            diagramId: 'created',
            semanticId: 'A',
            entityType: 'node',
          },
        },
      ],
    });

    expect(prepared.nextElements[0]).toBe(userElement);
    expect(prepared.nextMetadata.diagrams.created).toMatchObject({
      diagramId: 'created',
      revision: 0,
    });
  });

  it('patches one diagram and preserves untouched elements exactly', async () => {
    const command: CanvasCommand = {
      kind: 'patch-diagram',
      description: 'Rename A',
      patch: {
        patchId: 'patch-1',
        diagramId: 'main',
        baseRevision: 0,
        operations: [
          {
            type: 'updateNode',
            semanticId: 'A',
            changes: { label: 'New' },
          },
        ],
      },
    };
    const renderFlowchart = vi.fn(async () => [
      {
        id: 'node-a-next',
        x: 0,
        y: 0,
        customData: { diagramId: 'main', semanticId: 'A', entityType: 'node' },
      },
      {
        id: 'node-b-next',
        x: 280,
        y: 0,
        customData: { diagramId: 'main', semanticId: 'B', entityType: 'node' },
      },
      {
        id: 'edge-next',
        x: 90,
        y: 0,
        customData: {
          diagramId: 'main',
          semanticId: 'A__B',
          entityType: 'edge',
        },
      },
    ]);

    const prepared = await prepareCanvasCommand({
      command,
      currentElements,
      metadata,
      targetResolution: target,
      renderFlowchart,
    });

    expect(prepared.nextElements[0]).toBe(currentElements[0]);
    expect(
      prepared.nextElements.find((element) => element.id === 'node-b-current')
    ).toBe(currentElements[2]);
    expect(
      prepared.nextElements.find((element) => element.id === 'edge-current')
    ).toBe(currentElements[3]);
    expect(
      prepared.nextElements.find((element) => element.id === 'node-a-current')
    ).toMatchObject({ x: 10, y: 20 });
    expect(
      prepared.nextElements.filter(
        (element) =>
          (element.customData as Record<string, unknown> | undefined)
            ?.originalMermaid
      )
    ).toEqual([
      expect.objectContaining({
        customData: expect.objectContaining({
          diagramId: 'main',
          originalMermaid: expect.stringContaining('A[New]'),
          revision: 1,
        }),
      }),
    ]);
    expect(prepared.nextMetadata.diagrams.main.revision).toBe(1);
    expect(prepared.operation).toBe('patch');
  });

  it('bumps the metadata carrier version so Excalidraw history captures it', async () => {
    const elementsWithCarrier = currentElements.map((element) =>
      element.id === 'node-a-current'
        ? {
            ...element,
            version: 1,
            versionNonce: 111,
            updated: 100,
            customData: {
              ...element.customData,
              aiGenerated: true,
              diagramType: 'flowchart',
              originalMermaid: metadata.diagrams.main.sourceMermaid,
              revision: 0,
            },
          }
        : element
    );
    const prepared = await prepareCanvasCommand({
      command: {
        kind: 'patch-diagram',
        description: 'Rename B while A carries metadata',
        patch: {
          patchId: 'patch-carrier',
          diagramId: 'main',
          baseRevision: 0,
          operations: [
            {
              type: 'updateNode',
              semanticId: 'B',
              changes: { label: 'Changed B' },
            },
          ],
        },
      },
      currentElements: elementsWithCarrier,
      metadata,
      targetResolution: target,
      renderFlowchart: async () => [
        {
          id: 'node-a-next',
          x: 0,
          y: 0,
          customData: {
            diagramId: 'main',
            semanticId: 'A',
            entityType: 'node',
          },
        },
        {
          id: 'node-b-next',
          x: 280,
          y: 0,
          customData: {
            diagramId: 'main',
            semanticId: 'B',
            entityType: 'node',
          },
        },
        {
          id: 'edge-next',
          x: 90,
          y: 0,
          customData: {
            diagramId: 'main',
            semanticId: 'A__B',
            entityType: 'edge',
          },
        },
      ],
    });
    const carrier = prepared.nextElements.find(
      (element) => element.id === 'node-a-current'
    );

    expect(carrier).toMatchObject({
      id: 'node-a-current',
      x: 10,
      y: 20,
      version: 2,
      customData: {
        originalMermaid: expect.stringContaining('B[Changed B]'),
        revision: 1,
      },
    });
    expect(
      (carrier as { versionNonce?: number } | undefined)?.versionNonce
    ).not.toBe(111);
    expect(
      (carrier as { updated?: number } | undefined)?.updated
    ).toBeGreaterThan(100);
  });

  it('rejects a mutation when the target is ambiguous', async () => {
    const command: CanvasCommand = {
      kind: 'render-mermaid',
      operation: 'replace',
      diagramId: 'main',
      targetDiagramId: 'main',
      diagramType: 'flowchart',
      mermaidCode: 'flowchart LR\n  A --> B',
      description: 'Replace',
    };

    await expect(
      prepareCanvasCommand({
        command,
        currentElements,
        metadata,
        targetResolution: {
          status: 'ambiguous',
          diagramIds: ['main', 'other'],
        },
        renderFlowchart: async () => [],
      })
    ).rejects.toThrow(/ambiguous/i);
  });

  it('rejects create when the existing diagram target is ambiguous', async () => {
    await expect(
      prepareCanvasCommand({
        command: {
          kind: 'render-mermaid',
          operation: 'create',
          diagramId: 'new-diagram',
          diagramType: 'flowchart',
          mermaidCode: 'flowchart LR\n  A --> B',
          description: 'Create despite ambiguity',
        },
        currentElements,
        metadata,
        targetResolution: {
          status: 'ambiguous',
          diagramIds: ['main', 'other'],
        },
        renderFlowchart: async () => [],
      })
    ).rejects.toThrow(/ambiguous/i);
  });

  it('fully replaces only the explicit non-flowchart target', async () => {
    const command: CanvasCommand = {
      kind: 'render-mermaid',
      operation: 'replace',
      diagramId: 'main',
      targetDiagramId: 'main',
      diagramType: 'sequenceDiagram',
      mermaidCode: 'sequenceDiagram\n  A->>B: Hello',
      description: 'Replace with sequence',
    };

    const prepared = await prepareCanvasCommand({
      command,
      currentElements,
      metadata,
      targetResolution: target,
      renderMermaid: async () => ({
        elements: [{ id: 'sequence-new', x: 0, y: 0, type: 'rectangle' }],
        files: {},
      }),
    });

    expect(prepared.nextElements).toContain(currentElements[0]);
    expect(
      prepared.nextElements.some((element) => element.id === 'node-b-current')
    ).toBe(false);
    expect(prepared.nextElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sequence-new',
          customData: expect.objectContaining({ diagramId: 'main' }),
        }),
      ])
    );
    expect(prepared.nextMetadata.diagrams.main).toBeUndefined();
    expect(prepared.nextMetadata.mermaidDiagrams?.main.diagramType).toBe(
      'sequenceDiagram'
    );
  });

  it('does not mutate metadata when rendering or patching fails', async () => {
    const original = structuredClone(metadata);
    await expect(
      prepareCanvasCommand({
        command: {
          kind: 'render-mermaid',
          operation: 'create',
          diagramId: 'broken',
          diagramType: 'sequenceDiagram',
          mermaidCode: 'sequenceDiagram\nA->>B: Hi',
          description: 'Broken render',
        },
        currentElements,
        metadata,
        targetResolution: { status: 'none' },
        renderMermaid: async () => {
          throw new Error('render failed');
        },
      })
    ).rejects.toThrow('render failed');
    expect(metadata).toEqual(original);

    await expect(
      prepareCanvasCommand({
        command: {
          kind: 'patch-diagram',
          description: 'Stale patch',
          patch: {
            patchId: 'stale',
            diagramId: 'main',
            baseRevision: 99,
            operations: [
              {
                type: 'updateNode',
                semanticId: 'A',
                changes: { label: 'Never committed' },
              },
            ],
          },
        },
        currentElements,
        metadata,
        targetResolution: target,
        renderFlowchart: async () => [],
      })
    ).rejects.toThrow(/revision/i);
    expect(metadata).toEqual(original);
  });
});
