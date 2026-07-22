import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from './contracts';
import { isPatchableFlowchart } from './flowchart-parser';
import { serializeDiagramToMermaid } from './serializer';

describe('serializeDiagramToMermaid', () => {
  it('writes node styles in capability order and never emits edge style lines', () => {
    const document = {
      schemaVersion: 1,
      diagramId: 'styled',
      diagramType: 'flowchart',
      mermaidKeyword: 'flowchart',
      direction: 'LR',
      revision: 1,
      sourceMermaid: '',
      nodes: [
        {
          semanticId: 'start-node',
          label: 'Start',
          shape: 'rectangle',
          style: {
            'stroke-width': '2px',
            fill: '#fddf9f',
            stroke: '#d68f2f',
          },
        },
        {
          semanticId: 'done-node',
          label: 'Done',
          shape: 'circle',
        },
      ],
      edges: [
        {
          semanticId: 'start-node__done-node',
          sourceSemanticId: 'start-node',
          targetSemanticId: 'done-node',
          lineStyle: 'dashed',
          style: { stroke: '#ff0000' },
        },
      ],
      groups: [],
    } as unknown as DiagramDocument;

    const source = serializeDiagramToMermaid(document);

    expect(source).toContain(
      'style start-node fill:#fddf9f,stroke:#d68f2f,stroke-width:2px'
    );
    expect(source).not.toContain('style start-node__done-node');
    expect(isPatchableFlowchart(source)).toBe(true);
  });
});
