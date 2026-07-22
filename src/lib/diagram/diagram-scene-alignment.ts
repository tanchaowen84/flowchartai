import type { DiagramDocument } from './contracts';

interface DiagramSceneElement {
  customData?: {
    diagramId?: string;
    semanticId?: string;
    entityType?: string;
    [key: string]: unknown;
  };
}

export function isDiagramSceneSemanticallyAligned(
  document: DiagramDocument,
  elements: readonly DiagramSceneElement[]
): boolean {
  const targetElements = elements.filter(
    (element) => element.customData?.diagramId === document.diagramId
  );
  if (targetElements.length === 0) return false;

  const expectedNodes = new Set(document.nodes.map((node) => node.semanticId));
  const expectedEdges = new Set(document.edges.map((edge) => edge.semanticId));
  const seenNodes = new Map<string, number>();
  const seenEdges = new Map<string, number>();

  for (const element of targetElements) {
    const semanticId = element.customData?.semanticId;
    const entityType = element.customData?.entityType;
    if (!semanticId || !entityType) return false;

    if (entityType === 'node') {
      if (!expectedNodes.has(semanticId)) return false;
      seenNodes.set(semanticId, (seenNodes.get(semanticId) || 0) + 1);
      continue;
    }
    if (entityType === 'edge') {
      if (!expectedEdges.has(semanticId)) return false;
      seenEdges.set(semanticId, (seenEdges.get(semanticId) || 0) + 1);
      continue;
    }
    if (entityType === 'label') {
      if (!expectedNodes.has(semanticId) && !expectedEdges.has(semanticId)) {
        return false;
      }
      continue;
    }
    return false;
  }

  return (
    document.nodes.every((node) => seenNodes.get(node.semanticId) === 1) &&
    document.edges.every((edge) => seenEdges.get(edge.semanticId) === 1)
  );
}
