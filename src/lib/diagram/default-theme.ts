import type {
  DiagramDocument,
  DiagramNode,
  DiagramNodeStyle,
} from './contracts';
import { serializeDiagramToMermaid } from './serializer';

export const CLEAN_PROFESSIONAL_PROCESS_STYLE: DiagramNodeStyle = {
  fill: '#e8eef8',
  stroke: '#334155',
  'stroke-width': '2px',
};

export const CLEAN_PROFESSIONAL_DECISION_STYLE: DiagramNodeStyle = {
  fill: '#fff3d6',
  stroke: '#8a5a12',
  'stroke-width': '2px',
};

export const CLEAN_PROFESSIONAL_TERMINAL_STYLE: DiagramNodeStyle = {
  fill: '#e7f5ee',
  stroke: '#28735a',
  'stroke-width': '2px',
};

export const CLEAN_PROFESSIONAL_NODE_STYLE = CLEAN_PROFESSIONAL_PROCESS_STYLE;

function defaultStyleForShape(shape: DiagramNode['shape']): DiagramNodeStyle {
  if (shape === 'diamond') {
    return CLEAN_PROFESSIONAL_DECISION_STYLE;
  }
  if (shape === 'ellipse' || shape === 'stadium' || shape === 'circle') {
    return CLEAN_PROFESSIONAL_TERMINAL_STYLE;
  }
  return CLEAN_PROFESSIONAL_PROCESS_STYLE;
}

export function materializeDefaultCreateTheme(
  document: DiagramDocument
): DiagramDocument {
  const themedDocument: DiagramDocument = {
    ...document,
    nodes: document.nodes.map((node) =>
      node.style === undefined
        ? {
            ...node,
            style: { ...defaultStyleForShape(node.shape) },
          }
        : node
    ),
  };

  return {
    ...themedDocument,
    sourceMermaid: serializeDiagramToMermaid(themedDocument),
  };
}
