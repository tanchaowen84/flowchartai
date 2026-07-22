import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from './contracts';
import {
  annotateDiagramElements,
  buildFlowchartSkeleton,
  elementIdForEntity,
} from './diagram-renderer';

function makeDocument(): DiagramDocument {
  return {
    schemaVersion: 1,
    diagramId: 'diagram-1',
    diagramType: 'flowchart',
    mermaidKeyword: 'flowchart',
    direction: 'LR',
    revision: 2,
    sourceMermaid: 'flowchart LR\n  a[Start] --> b[Done]',
    nodes: [
      { semanticId: 'a', label: 'Start', shape: 'rectangle' },
      { semanticId: 'b', label: 'Done', shape: 'rectangle' },
    ],
    edges: [
      {
        semanticId: 'a__b',
        sourceSemanticId: 'a',
        targetSemanticId: 'b',
        label: 'next',
      },
    ],
    groups: [],
  };
}

describe('diagram renderer semantic identity', () => {
  it('builds stable node and edge skeleton ids without regenerating identity', () => {
    const skeleton = buildFlowchartSkeleton(makeDocument());

    expect(skeleton.map((element) => element.id)).toEqual([
      elementIdForEntity('diagram-1', 'node', 'a'),
      elementIdForEntity('diagram-1', 'node', 'b'),
      elementIdForEntity('diagram-1', 'edge', 'a__b'),
    ]);
    expect(skeleton[2]).toEqual(
      expect.objectContaining({
        start: { id: elementIdForEntity('diagram-1', 'node', 'a') },
        end: { id: elementIdForEntity('diagram-1', 'node', 'b') },
      })
    );
  });

  it('renders supported circle geometry and explicit node styles faithfully', () => {
    const document = makeDocument();
    document.nodes[0] = {
      semanticId: 'a',
      label: 'Styled circle',
      shape: 'circle',
      style: {
        fill: '#9fdfbf',
        stroke: '#2f7f3f',
        'stroke-width': '3px',
      },
    };

    const [circle] = buildFlowchartSkeleton(document);

    expect(circle).toEqual(
      expect.objectContaining({
        type: 'ellipse',
        backgroundColor: '#9fdfbf',
        strokeColor: '#2f7f3f',
        strokeWidth: 3,
      })
    );
    expect(circle?.width).toBe(circle?.height);
  });

  it('keeps cyclic flowcharts distributed across the requested direction', () => {
    const document = makeDocument();
    document.nodes = [
      { semanticId: 'start', label: 'Start', shape: 'rectangle' },
      { semanticId: 'review', label: 'Review', shape: 'diamond' },
      { semanticId: 'retry', label: 'Retry', shape: 'rectangle' },
      { semanticId: 'done', label: 'Done', shape: 'rectangle' },
    ];
    document.edges = [
      {
        semanticId: 'start__review',
        sourceSemanticId: 'start',
        targetSemanticId: 'review',
      },
      {
        semanticId: 'review__retry',
        sourceSemanticId: 'review',
        targetSemanticId: 'retry',
        label: 'rejected',
      },
      {
        semanticId: 'retry__review',
        sourceSemanticId: 'retry',
        targetSemanticId: 'review',
      },
      {
        semanticId: 'review__done',
        sourceSemanticId: 'review',
        targetSemanticId: 'done',
        label: 'approved',
      },
    ];

    const skeleton = buildFlowchartSkeleton(document);
    const nodeById = new Map(
      skeleton
        .filter((element) => element.type !== 'arrow')
        .map((element) => [element.id, element])
    );

    expect(
      nodeById.get(elementIdForEntity('diagram-1', 'node', 'start'))?.x
    ).toBeLessThan(
      nodeById.get(elementIdForEntity('diagram-1', 'node', 'review'))?.x || 0
    );
    expect(
      nodeById.get(elementIdForEntity('diagram-1', 'node', 'review'))?.x
    ).toBeLessThan(
      nodeById.get(elementIdForEntity('diagram-1', 'node', 'retry'))?.x || 0
    );
    expect(
      nodeById.get(elementIdForEntity('diagram-1', 'node', 'review'))?.x
    ).toBeLessThan(
      nodeById.get(elementIdForEntity('diagram-1', 'node', 'done'))?.x || 0
    );

    expect(
      skeleton.find(
        (element) =>
          element.id ===
          elementIdForEntity('diagram-1', 'edge', 'start__review')
      )
    ).toEqual(
      expect.objectContaining({
        x: 160,
        y: 40,
        width: 120,
        height: 0,
        points: [
          [0, 0],
          [120, 0],
        ],
      })
    );

    const reviewToRetry = skeleton.find(
      (element) =>
        element.id === elementIdForEntity('diagram-1', 'edge', 'review__retry')
    );
    const retryToReview = skeleton.find(
      (element) =>
        element.id === elementIdForEntity('diagram-1', 'edge', 'retry__review')
    );
    expect(reviewToRetry?.points).toHaveLength(3);
    expect(retryToReview?.points).toHaveLength(3);
    expect(reviewToRetry?.points?.[1]?.[1]).toBeGreaterThan(0);
    expect(retryToReview?.points?.[1]?.[1]).toBeLessThan(0);
  });

  it('annotates rectangle, bound text, arrow, and edge label with semantic metadata', () => {
    const nodeAId = elementIdForEntity('diagram-1', 'node', 'a');
    const nodeBId = elementIdForEntity('diagram-1', 'node', 'b');
    const edgeId = elementIdForEntity('diagram-1', 'edge', 'a__b');
    const converted = [
      {
        id: nodeAId,
        type: 'rectangle',
        boundElements: [{ id: 'label-a', type: 'text' }],
      },
      { id: 'label-a', type: 'text', containerId: nodeAId, text: 'Start' },
      { id: nodeBId, type: 'rectangle' },
      {
        id: edgeId,
        type: 'arrow',
        boundElements: [{ id: 'label-edge', type: 'text' }],
      },
      {
        id: 'label-edge',
        type: 'text',
        containerId: edgeId,
        text: 'next',
      },
    ];

    const annotated = annotateDiagramElements(converted, makeDocument());

    expect(annotated).toHaveLength(5);
    expect(annotated[0]?.customData).toEqual(
      expect.objectContaining({
        aiGenerated: true,
        diagramId: 'diagram-1',
        semanticId: 'a',
        entityType: 'node',
        revision: 2,
      })
    );
    expect(annotated[1]?.customData).toEqual(
      expect.objectContaining({ semanticId: 'a', entityType: 'label' })
    );
    expect(annotated[3]?.customData).toEqual(
      expect.objectContaining({ semanticId: 'a__b', entityType: 'edge' })
    );
    expect(annotated[4]?.customData).toEqual(
      expect.objectContaining({ semanticId: 'a__b', entityType: 'label' })
    );
  });
});
