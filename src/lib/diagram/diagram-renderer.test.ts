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
        semanticId: 'a_b',
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
      elementIdForEntity('diagram-1', 'edge', 'a_b'),
    ]);
    expect(skeleton[2]).toEqual(
      expect.objectContaining({
        start: { id: elementIdForEntity('diagram-1', 'node', 'a') },
        end: { id: elementIdForEntity('diagram-1', 'node', 'b') },
      })
    );
  });

  it('annotates rectangle, bound text, arrow, and edge label with semantic metadata', () => {
    const nodeAId = elementIdForEntity('diagram-1', 'node', 'a');
    const nodeBId = elementIdForEntity('diagram-1', 'node', 'b');
    const edgeId = elementIdForEntity('diagram-1', 'edge', 'a_b');
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
      expect.objectContaining({ semanticId: 'a_b', entityType: 'edge' })
    );
    expect(annotated[4]?.customData).toEqual(
      expect.objectContaining({ semanticId: 'a_b', entityType: 'label' })
    );
  });
});
