import { describe, expect, it } from 'vitest';
import { reconcileDiagramElements } from './canvas-reconciler';

function aiElement(
  id: string,
  diagramId: string,
  semanticId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 60,
    version: 1,
    customData: {
      aiGenerated: true,
      diagramId,
      semanticId,
      entityType: 'node',
      diagramType: 'flowchart',
      revision: 1,
    },
    ...overrides,
  };
}

describe('reconcileDiagramElements', () => {
  it('patches only changed semantic entities and preserves positions and user elements', () => {
    const userElement = { id: 'user-drawing', type: 'freedraw', x: 700, y: 80 };
    const currentA = aiElement('a-element', 'diagram-1', 'a');
    const currentB = aiElement('b-element', 'diagram-1', 'b', {
      x: 300,
      y: 120,
    });
    const otherDiagram = aiElement('other-element', 'diagram-2', 'other');
    const nextA = aiElement('new-a-id', 'diagram-1', 'a', {
      x: 900,
      y: 900,
      backgroundColor: '#ff0000',
    });
    const nextB = aiElement('new-b-id', 'diagram-1', 'b', {
      x: 999,
      y: 999,
    });

    const result = reconcileDiagramElements({
      currentElements: [userElement, currentA, currentB, otherDiagram],
      nextElements: [nextA, nextB],
      diagramId: 'diagram-1',
      changedSemanticIds: new Set(['a']),
      mode: 'patch',
    });

    expect(result).toContain(userElement);
    expect(result).toContain(currentB);
    expect(result).toContain(otherDiagram);
    expect(result.find((element) => element.id === 'a-element')).toEqual(
      expect.objectContaining({
        id: 'a-element',
        x: 10,
        y: 20,
        backgroundColor: '#ff0000',
      })
    );
    expect(result.some((element) => element.id === 'new-b-id')).toBe(false);
  });

  it('removes a changed entity that is absent from the next render', () => {
    const currentA = aiElement('a-element', 'diagram-1', 'a');
    const currentB = aiElement('b-element', 'diagram-1', 'b');

    const result = reconcileDiagramElements({
      currentElements: [currentA, currentB],
      nextElements: [aiElement('new-a-id', 'diagram-1', 'a')],
      diagramId: 'diagram-1',
      changedSemanticIds: new Set(['b']),
      mode: 'patch',
    });

    expect(result.map((element) => element.id)).toEqual(['a-element']);
  });

  it('full replace removes only the explicit target diagram', () => {
    const userElement = { id: 'user-drawing', type: 'freedraw', x: 0, y: 0 };
    const target = aiElement('target-old', 'diagram-1', 'target');
    const otherDiagram = aiElement('other-element', 'diagram-2', 'other');
    const replacement = aiElement('target-new', 'diagram-1', 'replacement');

    const result = reconcileDiagramElements({
      currentElements: [userElement, target, otherDiagram],
      nextElements: [replacement],
      diagramId: 'diagram-1',
      changedSemanticIds: new Set(),
      mode: 'replace',
    });

    expect(result).toEqual([userElement, otherDiagram, replacement]);
  });
});
