import { describe, expect, it } from 'vitest';
import type { FlowchartAiMetadata } from './contracts';
import { resolveDiagramTarget } from './target-resolver';

function element(
  id: string,
  diagramId?: string,
  originalMermaid?: string,
  generatedAt?: number
) {
  return {
    id,
    customData: {
      aiGenerated: true,
      diagramId,
      originalMermaid,
      generatedAt,
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
});
