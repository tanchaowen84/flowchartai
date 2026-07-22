import { describe, expect, it } from 'vitest';
import {
  getMermaidDiagramType,
  isPatchableFlowchart,
  parseFlowchartMermaid,
} from './flowchart-parser';
import { applyDiagramPatch } from './patch-engine';

describe('flowchart Mermaid parser', () => {
  it('parses stable node ids, shapes, edges, labels, styles, and direction', () => {
    const source = `flowchart LR
      start[Start] -->|continue| review{Approved}
      review -.-> done([Done])
      style start fill:#fddf9f,stroke:#d68f2f`;

    const document = parseFlowchartMermaid(source, {
      diagramId: 'diagram-1',
      revision: 4,
    });

    expect(document).toEqual(
      expect.objectContaining({
        diagramId: 'diagram-1',
        mermaidKeyword: 'flowchart',
        direction: 'LR',
        revision: 4,
      })
    );
    expect(document.nodes).toEqual([
      expect.objectContaining({
        semanticId: 'start',
        label: 'Start',
        shape: 'rectangle',
        style: { fill: '#fddf9f', stroke: '#d68f2f' },
      }),
      expect.objectContaining({
        semanticId: 'review',
        label: 'Approved',
        shape: 'diamond',
      }),
      expect.objectContaining({
        semanticId: 'done',
        label: 'Done',
        shape: 'stadium',
      }),
    ]);
    expect(document.edges).toEqual([
      expect.objectContaining({
        sourceSemanticId: 'start',
        targetSemanticId: 'review',
        label: 'continue',
        lineStyle: 'solid',
      }),
      expect.objectContaining({
        sourceSemanticId: 'review',
        targetSemanticId: 'done',
        lineStyle: 'dashed',
      }),
    ]);
    expect(isPatchableFlowchart(source)).toBe(true);
    expect(getMermaidDiagramType(source)).toBe('flowchart');
  });

  it('parses graph as the same patchable document family', () => {
    const document = parseFlowchartMermaid('graph TD\n  a --> b', {
      diagramId: 'diagram-2',
    });

    expect(document.mermaidKeyword).toBe('graph');
    expect(document.nodes.map((node) => node.semanticId)).toEqual(['a', 'b']);
    expect(isPatchableFlowchart(document.sourceMermaid)).toBe(true);
  });

  it('detects subgraph structure and refuses local patch instead of losing it', () => {
    const source = `flowchart LR
      subgraph auth[Authentication]
        login[Login] --> verify{Valid}
      end
      verify --> home[Home]`;
    const document = parseFlowchartMermaid(source, {
      diagramId: 'diagram-grouped',
    });

    expect(document.groups).toEqual([
      {
        semanticId: 'auth',
        label: 'Authentication',
        nodeSemanticIds: ['login', 'verify'],
      },
    ]);
    expect(isPatchableFlowchart(source)).toBe(false);
    expect(() =>
      applyDiagramPatch(document, {
        patchId: 'patch-grouped',
        diagramId: document.diagramId,
        baseRevision: document.revision,
        operations: [
          {
            type: 'updateNode',
            semanticId: 'home',
            changes: { label: 'Dashboard' },
          },
        ],
      })
    ).toThrow(/subgraph|group|replace/i);
  });

  it('classifies non-flowchart Mermaid as full-replace only', () => {
    const source = 'sequenceDiagram\n  Alice->>Bob: Hello';
    expect(getMermaidDiagramType(source)).toBe('sequenceDiagram');
    expect(isPatchableFlowchart(source)).toBe(false);
    expect(() =>
      parseFlowchartMermaid(source, { diagramId: 'sequence-1' })
    ).toThrow(/flowchart|graph/i);
  });

  it('routes unrecognized flowchart syntax to full replacement', () => {
    expect(isPatchableFlowchart('flowchart LR\n  A -- approved --> B')).toBe(
      false
    );
    expect(isPatchableFlowchart('flowchart LR\n  A@{ shape: rect }')).toBe(
      false
    );
    expect(isPatchableFlowchart('flowchart LR\n  class A warning')).toBe(false);
  });

  it('keeps supported styled shapes and hyphenated semantic ids patchable', () => {
    const source = `graph TD
      start-node[Start] --> middle-node([Waiting])
      middle-node --> end-node((Done))
      style start-node fill:#fddf9f,stroke:#d68f2f,stroke-width:2px
      style end-node fill:#9fdfbf,stroke:#2f7f3f,stroke-width:2px`;

    expect(isPatchableFlowchart(source)).toBe(true);
    expect(
      parseFlowchartMermaid(source, { diagramId: 'styled-shapes' }).nodes
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          semanticId: 'middle-node',
          shape: 'stadium',
        }),
        expect.objectContaining({ semanticId: 'end-node', shape: 'circle' }),
      ])
    );
  });

  it.each([
    'flowchart LR\n  A --- B',
    'flowchart LR\n  A ==> B',
    'flowchart LR\n  A[[Subroutine]] --> B',
    'flowchart LR\n  A[(Database)] --> B',
    'flowchart LR\n  A{{Hexagon}} --> B',
    'flowchart LR\n  A[Node]\n  style A color:red',
    'flowchart LR\n  A[Node]\n  style A stroke-dasharray: 5 5',
    'flowchart LR\n  A[Node] --> B[Done]\n  style A__B fill:red',
    'flowchart LR\n  A[Node] --> B[Done]\n  linkStyle 0 stroke:red',
    'flowchart LR\n  A[Node]\n  classDef warning fill:red',
    'flowchart LR\n  A[First<br/>Second] --> B[Done]',
    'flowchart LR\n  A[Node]\n  style A fill:#12345',
    'flowchart LR\n  A[Node]\n  style A stroke:#1234567',
  ])('falls back instead of patching non-faithful syntax: %s', (source) => {
    expect(isPatchableFlowchart(source)).toBe(false);
  });

  it('keeps the faithful V1 flowchart subset patchable', () => {
    expect(
      isPatchableFlowchart(
        'flowchart LR\n  A[Start] --> B{Ready}\n  B -.-> C(Done)'
      )
    ).toBe(true);
  });

  it('routes parallel edges to targeted replacement', () => {
    expect(
      isPatchableFlowchart(`flowchart LR
  A[Start] --> B[Done]
  A -->|again| B`)
    ).toBe(false);
  });
});
