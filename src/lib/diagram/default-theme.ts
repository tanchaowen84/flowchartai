import type { DiagramDocument, DiagramNodeStyle } from './contracts';
import { serializeDiagramToMermaid } from './serializer';

export const CLEAN_PROFESSIONAL_NODE_STYLE: DiagramNodeStyle = {
  fill: '#f8fafc',
  stroke: '#334155',
  'stroke-width': '2px',
};

export function materializeDefaultCreateTheme(
  document: DiagramDocument
): DiagramDocument {
  const themedDocument: DiagramDocument = {
    ...document,
    nodes: document.nodes.map((node) =>
      node.style === undefined
        ? {
            ...node,
            style: { ...CLEAN_PROFESSIONAL_NODE_STYLE },
          }
        : node
    ),
  };

  return {
    ...themedDocument,
    sourceMermaid: serializeDiagramToMermaid(themedDocument),
  };
}
