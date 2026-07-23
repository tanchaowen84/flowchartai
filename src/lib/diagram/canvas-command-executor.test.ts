import { describe, expect, it, vi } from 'vitest';
import { prepareCanvasCommand } from './canvas-command-executor';
import type { ReconcilerElement } from './canvas-reconciler';
import type {
  CanvasCommand,
  DiagramDocument,
  DiagramPatchOperation,
  FlowchartAiMetadata,
} from './contracts';
import {
  annotateDiagramElements,
  buildFlowchartSkeleton,
} from './diagram-renderer';
import { deriveFlowchartAiMetadataFromElements } from './metadata';
import {
  type DiagramTargetResolution,
  resolveDiagramTarget,
} from './target-resolver';

async function renderManagedFlowchart(
  document: DiagramDocument
): Promise<ReconcilerElement[]> {
  return annotateDiagramElements(
    buildFlowchartSkeleton(document),
    document
  ) as ReconcilerElement[];
}

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

    const renderFlowchart = vi.fn(async (document: DiagramDocument) => [
      {
        id: 'created-node',
        x: 0,
        y: 0,
        customData: {
          diagramId: document.diagramId,
          semanticId: 'A',
          entityType: 'node',
        },
      },
    ]);
    const prepared = await prepareCanvasCommand<ReconcilerElement>({
      command,
      currentElements: [userElement],
      metadata: { schemaVersion: 1, diagrams: {} },
      targetResolution: { status: 'none' },
      renderFlowchart,
    });

    expect(prepared.nextElements[0]).toBe(userElement);
    expect(prepared.nextMetadata.diagrams.created).toMatchObject({
      diagramId: 'created',
      revision: 0,
      nodes: [
        expect.objectContaining({
          semanticId: 'A',
          style: {
            fill: '#f8fafc',
            stroke: '#334155',
            'stroke-width': '2px',
          },
        }),
        expect.objectContaining({
          semanticId: 'B',
          style: {
            fill: '#f8fafc',
            stroke: '#334155',
            'stroke-width': '2px',
          },
        }),
      ],
    });
    expect(renderFlowchart).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            semanticId: 'A',
            style: expect.objectContaining({ fill: '#f8fafc' }),
          }),
        ]),
      })
    );
    expect(prepared.sourceMermaid).toContain(
      'style A fill:#f8fafc,stroke:#334155,stroke-width:2px'
    );
    expect(prepared.nextMetadata.diagrams.created.sourceMermaid).toBe(
      prepared.sourceMermaid
    );
    expect(
      prepared.nextElements.find(
        (element) => element.customData?.diagramId === 'created'
      )?.customData?.originalMermaid
    ).toBe(prepared.sourceMermaid);

    const reloaded = deriveFlowchartAiMetadataFromElements(
      prepared.nextElements,
      prepared.nextMetadata
    );
    expect(reloaded.diagrams.created.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          semanticId: 'A',
          style: expect.objectContaining({ fill: '#f8fafc' }),
        }),
      ])
    );
  });

  it('preserves explicit partial styles while theming only unstyled nodes on create', async () => {
    const prepared = await prepareCanvasCommand({
      command: {
        kind: 'render-mermaid',
        operation: 'create',
        diagramId: 'partial-style',
        diagramType: 'flowchart',
        mermaidCode: `flowchart LR
  A[Explicit] --> B[Default]
  style A fill:#abcdef`,
        description: 'Create partially styled flowchart',
      },
      currentElements: [],
      metadata: { schemaVersion: 1, diagrams: {} },
      targetResolution: { status: 'none' },
      renderFlowchart: async () => [
        {
          id: 'partial-a',
          x: 0,
          y: 0,
          customData: {
            diagramId: 'partial-style',
            semanticId: 'A',
            entityType: 'node',
          },
        },
      ],
    });

    expect(prepared.nextMetadata.diagrams['partial-style'].nodes).toEqual([
      expect.objectContaining({
        semanticId: 'A',
        style: { fill: '#abcdef' },
      }),
      expect.objectContaining({
        semanticId: 'B',
        style: {
          fill: '#f8fafc',
          stroke: '#334155',
          'stroke-width': '2px',
        },
      }),
    ]);
  });

  it('creates a styled managed flowchart and patches it without replacement', async () => {
    const styledSource = `flowchart LR
  start-node[Start] --> done-node((Done))
  style start-node fill:#fddf9f,stroke:#d68f2f,stroke-width:2px
  style done-node fill:#9fdfbf,stroke:#2f7f3f,stroke-width:2px`;
    const renderFlowchart = vi.fn(async () => [
      {
        id: 'start-node-rendered',
        x: 0,
        y: 0,
        customData: {
          diagramId: 'styled-created',
          semanticId: 'start-node',
          entityType: 'node',
        },
      },
      {
        id: 'done-node-rendered',
        x: 280,
        y: 0,
        customData: {
          diagramId: 'styled-created',
          semanticId: 'done-node',
          entityType: 'node',
        },
      },
      {
        id: 'edge-rendered',
        x: 90,
        y: 0,
        customData: {
          diagramId: 'styled-created',
          semanticId: 'start-node__done-node',
          entityType: 'edge',
        },
      },
    ]);
    const renderMermaid = vi.fn(async () => ({
      elements: [{ id: 'legacy-render', x: 0, y: 0 }],
      files: {},
    }));

    const created = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'render-mermaid',
        operation: 'create',
        diagramId: 'styled-created',
        diagramType: 'flowchart',
        mermaidCode: styledSource,
        description: 'Create styled flowchart',
      },
      currentElements: [{ id: 'user-note', x: 500, y: 500 }],
      metadata: { schemaVersion: 1, diagrams: {} },
      targetResolution: { status: 'none' },
      renderFlowchart,
      renderMermaid,
    });

    expect(renderFlowchart).toHaveBeenCalledOnce();
    expect(renderMermaid).not.toHaveBeenCalled();
    expect(created.nextMetadata.diagrams['styled-created']).toMatchObject({
      diagramId: 'styled-created',
      revision: 0,
      nodes: expect.arrayContaining([
        expect.objectContaining({
          semanticId: 'done-node',
          style: expect.objectContaining({ fill: '#9fdfbf' }),
        }),
      ]),
    });
    expect(
      created.nextMetadata.mermaidDiagrams?.['styled-created']
    ).toBeUndefined();

    const document = created.nextMetadata.diagrams['styled-created'];
    const patched = await prepareCanvasCommand({
      command: {
        kind: 'patch-diagram',
        description: 'Rename Done',
        patch: {
          patchId: 'patch-styled-created',
          diagramId: 'styled-created',
          baseRevision: 0,
          operations: [
            {
              type: 'updateNode',
              semanticId: 'done-node',
              changes: { label: 'Ready' },
            },
          ],
        },
      },
      currentElements: created.nextElements,
      metadata: created.nextMetadata,
      targetResolution: {
        status: 'resolved',
        diagramId: 'styled-created',
        document,
        patchable: true,
      },
      renderFlowchart,
    });

    expect(patched.operation).toBe('patch');
    expect(patched.diagramId).toBe('styled-created');
    expect(patched.nextMetadata.diagrams['styled-created']).toMatchObject({
      diagramId: 'styled-created',
      revision: 1,
      nodes: expect.arrayContaining([
        expect.objectContaining({
          semanticId: 'done-node',
          label: 'Ready',
          style: expect.objectContaining({ fill: '#9fdfbf' }),
        }),
      ]),
    });
    expect(
      patched.nextMetadata.mermaidDiagrams?.['styled-created']
    ).toBeUndefined();
  });

  it('updates real canvas style after create, label patch, and style patch', async () => {
    const userElement = { id: 'user-note-real', x: 700, y: 400 };
    const created = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'render-mermaid',
        operation: 'create',
        diagramId: 'styled-real',
        diagramType: 'flowchart',
        mermaidCode: `flowchart LR
  A[Start] --> B[Done]
  style A fill:#fddf9f,stroke:#d68f2f,stroke-width:2px
  style B fill:#9fdfbf,stroke:#2f7f3f,stroke-width:2px`,
        description: 'Create styled canvas',
      },
      currentElements: [userElement],
      metadata: { schemaVersion: 1, diagrams: {} },
      targetResolution: { status: 'none' },
      renderFlowchart: renderManagedFlowchart,
    });
    const untouchedB = created.nextElements.find(
      (element) => element.customData?.semanticId === 'B'
    );
    const untouchedEdge = created.nextElements.find(
      (element) => element.customData?.semanticId === 'A__B'
    );
    const initialA = created.nextElements.find(
      (element) =>
        element.customData?.semanticId === 'A' &&
        element.customData?.entityType === 'node'
    );
    const labelTarget = resolveDiagramTarget({
      elements: created.nextElements,
      selectedElementIds: {},
      metadata: created.nextMetadata,
    });
    expect(labelTarget).toEqual(
      expect.objectContaining({ status: 'resolved', patchable: true })
    );
    if (labelTarget.status !== 'resolved' || !labelTarget.document) {
      throw new Error('Expected styled create to resolve as patchable');
    }

    const labelPatched = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'patch-diagram',
        description: 'Rename Start',
        patch: {
          patchId: 'rename-real',
          diagramId: 'styled-real',
          baseRevision: 0,
          operations: [
            {
              type: 'updateNode',
              semanticId: 'A',
              changes: { label: 'Ready' },
            },
          ],
        },
      },
      currentElements: created.nextElements,
      metadata: created.nextMetadata,
      targetResolution: labelTarget,
      renderFlowchart: renderManagedFlowchart,
    });
    const styleTarget = resolveDiagramTarget({
      elements: labelPatched.nextElements,
      selectedElementIds: {},
      metadata: labelPatched.nextMetadata,
    });
    if (styleTarget.status !== 'resolved' || !styleTarget.document) {
      throw new Error('Expected label patch to remain patchable');
    }

    const stylePatched = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'patch-diagram',
        description: 'Make Ready green',
        patch: {
          patchId: 'style-real',
          diagramId: 'styled-real',
          baseRevision: 1,
          operations: [
            {
              type: 'updateNode',
              semanticId: 'A',
              changes: {
                style: {
                  fill: '#9fdfbf',
                  stroke: '#d68f2f',
                  'stroke-width': '2px',
                },
              },
            },
          ],
        },
      },
      currentElements: labelPatched.nextElements,
      metadata: labelPatched.nextMetadata,
      targetResolution: styleTarget,
      renderFlowchart: renderManagedFlowchart,
    });
    const finalA = stylePatched.nextElements.find(
      (element) =>
        element.customData?.semanticId === 'A' &&
        element.customData?.entityType === 'node'
    );

    expect(finalA).toEqual(
      expect.objectContaining({
        id: initialA?.id,
        x: initialA?.x,
        y: initialA?.y,
        backgroundColor: '#9fdfbf',
        strokeColor: '#d68f2f',
        strokeWidth: 2,
      })
    );
    expect(stylePatched.nextElements[0]).toBe(userElement);
    expect(stylePatched.nextElements).toContain(untouchedB);
    expect(stylePatched.nextElements).toContain(untouchedEdge);
    expect(stylePatched.nextMetadata.diagrams['styled-real'].revision).toBe(2);
  });

  it('keeps edge add, update, remove, metadata derivation, and next patch patchable', async () => {
    let prepared = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'render-mermaid',
        operation: 'create',
        diagramId: 'edge-roundtrip',
        diagramType: 'flowchart',
        mermaidCode: 'flowchart LR\n  A[Start] --> B[Review]',
        description: 'Create edge roundtrip graph',
      },
      currentElements: [],
      metadata: { schemaVersion: 1, diagrams: {} },
      targetResolution: { status: 'none' },
      renderFlowchart: renderManagedFlowchart,
    });

    const applyAndReload = async (
      patchId: string,
      baseRevision: number,
      operations: DiagramPatchOperation[]
    ) => {
      const derived = deriveFlowchartAiMetadataFromElements(
        prepared.nextElements,
        prepared.nextMetadata
      );
      const resolution = resolveDiagramTarget({
        elements: prepared.nextElements,
        selectedElementIds: {},
        metadata: derived,
      });
      expect(resolution).toEqual(
        expect.objectContaining({ status: 'resolved', patchable: true })
      );
      if (resolution.status !== 'resolved' || !resolution.document) {
        throw new Error('Expected edge roundtrip to remain patchable');
      }
      prepared = await prepareCanvasCommand<ReconcilerElement>({
        command: {
          kind: 'patch-diagram',
          description: patchId,
          patch: {
            patchId,
            diagramId: 'edge-roundtrip',
            baseRevision,
            operations,
          },
        },
        currentElements: prepared.nextElements,
        metadata: derived,
        targetResolution: resolution,
        renderFlowchart: renderManagedFlowchart,
      });
      expect(prepared.operation).toBe('patch');
    };

    await applyAndReload('add-edge', 0, [
      {
        type: 'addNode',
        node: { semanticId: 'C', label: 'Done', shape: 'circle' },
      },
      {
        type: 'addEdge',
        edge: {
          semanticId: 'B__C',
          sourceSemanticId: 'B',
          targetSemanticId: 'C',
          lineStyle: 'solid',
        },
      },
    ]);
    await applyAndReload('update-edge', 1, [
      {
        type: 'updateEdge',
        semanticId: 'B__C',
        changes: { label: 'approved', lineStyle: 'dashed' },
      },
    ]);
    await applyAndReload('remove-edge', 2, [
      { type: 'removeEdge', semanticId: 'B__C' },
      { type: 'removeNode', semanticId: 'C' },
    ]);

    const finalMetadata = deriveFlowchartAiMetadataFromElements(
      prepared.nextElements,
      prepared.nextMetadata
    );
    const finalTarget = resolveDiagramTarget({
      elements: prepared.nextElements,
      selectedElementIds: {},
      metadata: finalMetadata,
    });
    expect(finalTarget).toEqual(
      expect.objectContaining({
        status: 'resolved',
        patchable: true,
        document: expect.objectContaining({ revision: 3 }),
      })
    );
  });

  it('turns a full-id scene into an aligned managed document via targeted replace', async () => {
    const legacySource = 'flowchart LR\n  A[Old] --> B[Keep]';
    const userElement = {
      id: 'user-kept',
      x: 900,
      y: 100,
      customData: undefined,
    };
    const fullElements = [
      userElement,
      {
        id: 'full-node-a',
        type: 'rectangle',
        x: 10,
        y: 20,
        customData: {
          aiGenerated: true,
          diagramId: 'legacy-full',
          semanticId: 'full:rectangle:0',
          entityType: 'node',
          originalMermaid: legacySource,
          revision: 4,
        },
      },
      {
        id: 'full-node-b',
        type: 'rectangle',
        x: 300,
        y: 20,
        customData: {
          aiGenerated: true,
          diagramId: 'legacy-full',
          semanticId: 'full:rectangle:1',
          entityType: 'node',
          revision: 4,
        },
      },
      {
        id: 'full-edge',
        type: 'arrow',
        x: 100,
        y: 20,
        customData: {
          aiGenerated: true,
          diagramId: 'legacy-full',
          semanticId: 'full:arrow:2',
          entityType: 'edge',
          revision: 4,
        },
      },
    ];
    const legacyMetadata: FlowchartAiMetadata = {
      schemaVersion: 1,
      diagrams: {},
      mermaidDiagrams: {
        'legacy-full': {
          diagramId: 'legacy-full',
          diagramType: 'flowchart',
          revision: 4,
          sourceMermaid: legacySource,
        },
      },
    };
    const replaceTarget = resolveDiagramTarget({
      elements: fullElements,
      selectedElementIds: {},
      metadata: legacyMetadata,
    });
    expect(replaceTarget).toEqual(
      expect.objectContaining({ status: 'resolved', patchable: false })
    );

    const replaced = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'render-mermaid',
        operation: 'replace',
        diagramId: 'legacy-full',
        targetDiagramId: 'legacy-full',
        diagramType: 'flowchart',
        mermaidCode: `flowchart LR
  A[Ready] --> B[Keep]
  style A fill:#9fdfbf,stroke:#2f7f3f,stroke-width:2px`,
        description: 'Explicitly replace legacy full-id scene',
      },
      currentElements: fullElements,
      metadata: legacyMetadata,
      targetResolution: replaceTarget,
      renderFlowchart: renderManagedFlowchart,
    });

    expect(replaced.nextElements).toContain(userElement);
    expect(
      replaced.nextElements.some((element) =>
        String(element.customData?.semanticId || '').startsWith('full:')
      )
    ).toBe(false);
    expect(replaced.nextMetadata.diagrams['legacy-full']).toMatchObject({
      revision: 5,
      nodes: expect.arrayContaining([
        expect.objectContaining({ semanticId: 'A', label: 'Ready' }),
        expect.objectContaining({
          semanticId: 'B',
          label: 'Keep',
          style: undefined,
        }),
      ]),
    });
    expect(replaced.sourceMermaid).toContain('A[Ready] --> B[Keep]');
    expect(replaced.sourceMermaid).not.toContain('style B');
    expect(
      replaced.nextMetadata.mermaidDiagrams?.['legacy-full']
    ).toBeUndefined();

    const alignedTarget = resolveDiagramTarget({
      elements: replaced.nextElements,
      selectedElementIds: {},
      metadata: replaced.nextMetadata,
    });
    expect(alignedTarget).toEqual(
      expect.objectContaining({ status: 'resolved', patchable: true })
    );
    if (alignedTarget.status !== 'resolved' || !alignedTarget.document) {
      throw new Error('Expected targeted replace to create an aligned target');
    }
    const patched = await prepareCanvasCommand<ReconcilerElement>({
      command: {
        kind: 'patch-diagram',
        description: 'Patch after targeted replace',
        patch: {
          patchId: 'patch-after-replace',
          diagramId: 'legacy-full',
          baseRevision: 5,
          operations: [
            {
              type: 'updateNode',
              semanticId: 'B',
              changes: { label: 'Still kept' },
            },
          ],
        },
      },
      currentElements: replaced.nextElements,
      metadata: replaced.nextMetadata,
      targetResolution: alignedTarget,
      renderFlowchart: renderManagedFlowchart,
    });
    expect(patched).toMatchObject({ operation: 'patch' });
    expect(patched.nextMetadata.diagrams['legacy-full'].revision).toBe(6);
  });

  it('rejects local patching when the scene semantic ids do not match the document', async () => {
    await expect(
      prepareCanvasCommand({
        command: {
          kind: 'patch-diagram',
          description: 'Unsafe legacy patch',
          patch: {
            patchId: 'unsafe-legacy-patch',
            diagramId: 'main',
            baseRevision: 0,
            operations: [
              {
                type: 'updateNode',
                semanticId: 'A',
                changes: { label: 'Unsafe' },
              },
            ],
          },
        },
        currentElements: [
          {
            id: 'legacy-node',
            customData: {
              diagramId: 'main',
              semanticId: 'full:rectangle:0',
              entityType: 'node',
            },
          },
        ],
        metadata,
        targetResolution: target,
        renderFlowchart: async () => [],
      })
    ).rejects.toThrow(/scene|semantic|targeted replacement/i);
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
    expect(prepared.nextMetadata.diagrams.main.nodes).toEqual([
      expect.objectContaining({ semanticId: 'A', style: undefined }),
      expect.objectContaining({ semanticId: 'B', style: undefined }),
    ]);
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
