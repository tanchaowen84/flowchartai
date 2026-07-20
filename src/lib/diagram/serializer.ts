import type { DiagramDocument, DiagramEdge, DiagramNode } from './contracts';

function sanitizeLabel(label: string): string {
  return label
    .replace(/\r?\n/g, ' ')
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function serializeNode(node: DiagramNode): string {
  const label = sanitizeLabel(node.label) || node.semanticId;

  switch (node.shape) {
    case 'rounded':
      return `${node.semanticId}(${label})`;
    case 'diamond':
      return `${node.semanticId}{${label}}`;
    case 'ellipse':
    case 'stadium':
      return `${node.semanticId}([${label}])`;
    case 'circle':
      return `${node.semanticId}((${label}))`;
    case 'subroutine':
      return `${node.semanticId}[[${label}]]`;
    case 'cylinder':
      return `${node.semanticId}[(${label})]`;
    case 'hexagon':
      return `${node.semanticId}{{${label}}}`;
    default:
      return `${node.semanticId}[${label}]`;
  }
}

function serializeEdge(edge: DiagramEdge): string {
  const connector =
    edge.lineStyle === 'dashed'
      ? '-.->'
      : edge.lineStyle === 'dotted'
        ? '-.->'
        : '-->';
  const label = edge.label ? `|${sanitizeLabel(edge.label)}|` : '';
  return `${edge.sourceSemanticId} ${connector}${label} ${edge.targetSemanticId}`;
}

function serializeStyle(
  semanticId: string,
  style: Record<string, string> | undefined
): string | null {
  if (!style || Object.keys(style).length === 0) return null;
  return `style ${semanticId} ${Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(',')}`;
}

export function serializeDiagramToMermaid(document: DiagramDocument): string {
  const lines = [`${document.mermaidKeyword} ${document.direction}`];

  for (const node of document.nodes) {
    lines.push(`  ${serializeNode(node)}`);
  }
  for (const edge of document.edges) {
    lines.push(`  ${serializeEdge(edge)}`);
  }
  for (const node of document.nodes) {
    const style = serializeStyle(node.semanticId, node.style);
    if (style) lines.push(`  ${style}`);
  }
  for (const edge of document.edges) {
    const style = serializeStyle(edge.semanticId, edge.style);
    if (style) lines.push(`  ${style}`);
  }

  return lines.join('\n');
}
