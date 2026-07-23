import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from './contracts';
import { materializeDefaultCreateTheme } from './default-theme';

function makeDocument(): DiagramDocument {
  return {
    schemaVersion: 1,
    diagramId: 'theme-test',
    diagramType: 'flowchart',
    mermaidKeyword: 'flowchart',
    direction: 'LR',
    revision: 0,
    sourceMermaid: 'flowchart LR',
    nodes: [
      { semanticId: 'process', label: 'Process', shape: 'rectangle' },
      { semanticId: 'rounded', label: 'Rounded', shape: 'rounded' },
      { semanticId: 'decision', label: 'Decision', shape: 'diamond' },
      { semanticId: 'ellipse', label: 'Ellipse', shape: 'ellipse' },
      { semanticId: 'stadium', label: 'Stadium', shape: 'stadium' },
      { semanticId: 'circle', label: 'Circle', shape: 'circle' },
      {
        semanticId: 'explicit',
        label: 'Explicit',
        shape: 'diamond',
        style: { fill: '#abcdef' },
      },
    ],
    edges: [],
    groups: [],
  };
}

describe('default create theme', () => {
  it('uses restrained shape-based colors for otherwise unstyled nodes', () => {
    const themed = materializeDefaultCreateTheme(makeDocument());
    const styleById = new Map(
      themed.nodes.map((node) => [node.semanticId, node.style])
    );

    expect(styleById.get('process')).toEqual({
      fill: '#e8eef8',
      stroke: '#334155',
      'stroke-width': '2px',
    });
    expect(styleById.get('rounded')).toEqual(styleById.get('process'));
    expect(styleById.get('decision')).toEqual({
      fill: '#fff3d6',
      stroke: '#8a5a12',
      'stroke-width': '2px',
    });
    expect(styleById.get('ellipse')).toEqual({
      fill: '#e7f5ee',
      stroke: '#28735a',
      'stroke-width': '2px',
    });
    expect(styleById.get('stadium')).toEqual(styleById.get('ellipse'));
    expect(styleById.get('circle')).toEqual(styleById.get('ellipse'));
  });

  it('preserves explicit partial styles exactly and serializes only defaults around them', () => {
    const themed = materializeDefaultCreateTheme(makeDocument());
    const explicit = themed.nodes.find(
      (node) => node.semanticId === 'explicit'
    );

    expect(explicit?.style).toEqual({ fill: '#abcdef' });
    expect(themed.sourceMermaid).toContain(
      'style process fill:#e8eef8,stroke:#334155,stroke-width:2px'
    );
    expect(themed.sourceMermaid).toContain('style explicit fill:#abcdef');
  });
});
