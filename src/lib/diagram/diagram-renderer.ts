import type { DiagramDocument, DiagramNode } from './contracts';

type EntityType = 'node' | 'edge';

export interface FlowchartSkeletonElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: { text: string };
  start?: { id: string };
  end?: { id: string };
  [key: string]: unknown;
}

export function elementIdForEntity(
  diagramId: string,
  entityType: EntityType,
  semanticId: string
): string {
  return `flowchartai:${diagramId}:${entityType}:${semanticId}`;
}

function nodeElementType(node: DiagramNode): string {
  if (node.shape === 'diamond' || node.shape === 'hexagon') return 'diamond';
  if (
    node.shape === 'ellipse' ||
    node.shape === 'stadium' ||
    node.shape === 'circle'
  ) {
    return 'ellipse';
  }
  return 'rectangle';
}

function layoutNodes(
  document: DiagramDocument
): Map<string, { x: number; y: number }> {
  const indegree = new Map(document.nodes.map((node) => [node.semanticId, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of document.edges) {
    indegree.set(
      edge.targetSemanticId,
      (indegree.get(edge.targetSemanticId) || 0) + 1
    );
    outgoing.set(edge.sourceSemanticId, [
      ...(outgoing.get(edge.sourceSemanticId) || []),
      edge.targetSemanticId,
    ]);
  }

  const ranks = new Map<string, number>();
  const queue = document.nodes
    .filter((node) => (indegree.get(node.semanticId) || 0) === 0)
    .map((node) => node.semanticId);
  for (const id of queue) ranks.set(id, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index];
    for (const target of outgoing.get(source) || []) {
      ranks.set(
        target,
        Math.max(ranks.get(target) || 0, (ranks.get(source) || 0) + 1)
      );
      indegree.set(target, (indegree.get(target) || 1) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }

  for (const node of document.nodes) {
    if (!ranks.has(node.semanticId)) ranks.set(node.semanticId, 0);
  }

  const rankRows = new Map<number, string[]>();
  for (const node of document.nodes) {
    const rank = ranks.get(node.semanticId) || 0;
    rankRows.set(rank, [...(rankRows.get(rank) || []), node.semanticId]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [rank, ids] of rankRows) {
    ids.forEach((id, row) => {
      const primary = rank * 280;
      const secondary = row * 160;
      const horizontal =
        document.direction === 'LR' || document.direction === 'RL';
      const reverse =
        document.direction === 'RL' || document.direction === 'BT';
      positions.set(
        id,
        horizontal
          ? { x: reverse ? -primary : primary, y: secondary }
          : { x: secondary, y: reverse ? -primary : primary }
      );
    });
  }

  return positions;
}

export function buildFlowchartSkeleton(
  document: DiagramDocument
): FlowchartSkeletonElement[] {
  const positions = layoutNodes(document);
  const nodes: FlowchartSkeletonElement[] = document.nodes.map((node) => {
    const position = positions.get(node.semanticId) || { x: 0, y: 0 };
    return {
      id: elementIdForEntity(document.diagramId, 'node', node.semanticId),
      type: nodeElementType(node),
      x: position.x,
      y: position.y,
      width: Math.max(160, node.label.length * 10 + 40),
      height: node.shape === 'circle' ? 120 : 80,
      label: { text: node.label },
      backgroundColor: node.style?.fill || '#fddf9f',
      strokeColor: node.style?.stroke || '#d68f2f',
      strokeWidth: Number.parseInt(node.style?.['stroke-width'] || '2', 10),
      roundness: node.shape === 'rounded' ? { type: 3 } : undefined,
    };
  });
  const edges: FlowchartSkeletonElement[] = document.edges.map((edge) => ({
    id: elementIdForEntity(document.diagramId, 'edge', edge.semanticId),
    type: 'arrow',
    x: 0,
    y: 0,
    start: {
      id: elementIdForEntity(document.diagramId, 'node', edge.sourceSemanticId),
    },
    end: {
      id: elementIdForEntity(document.diagramId, 'node', edge.targetSemanticId),
    },
    label: edge.label ? { text: edge.label } : undefined,
    strokeStyle: edge.lineStyle === 'solid' ? 'solid' : 'dashed',
  }));
  return [...nodes, ...edges];
}

export function annotateDiagramElements(
  elements: Array<Record<string, any>>,
  document: DiagramDocument
): Array<Record<string, any>> {
  const entityByContainerId = new Map<
    string,
    { semanticId: string; entityType: EntityType }
  >();
  for (const node of document.nodes) {
    entityByContainerId.set(
      elementIdForEntity(document.diagramId, 'node', node.semanticId),
      { semanticId: node.semanticId, entityType: 'node' }
    );
  }
  for (const edge of document.edges) {
    entityByContainerId.set(
      elementIdForEntity(document.diagramId, 'edge', edge.semanticId),
      { semanticId: edge.semanticId, entityType: 'edge' }
    );
  }

  return elements.map((element) => {
    const container = entityByContainerId.get(element.id);
    const boundContainer = element.containerId
      ? entityByContainerId.get(element.containerId)
      : undefined;
    const entity = container || boundContainer;
    if (!entity) return element;

    return {
      ...element,
      customData: {
        ...element.customData,
        aiGenerated: true,
        diagramId: document.diagramId,
        semanticId: entity.semanticId,
        entityType: boundContainer ? 'label' : entity.entityType,
        diagramType: document.diagramType,
        revision: document.revision,
      },
    };
  });
}

export async function renderDiagramDocument(
  document: DiagramDocument
): Promise<any[]> {
  const { convertToExcalidrawElements } = await import(
    '@excalidraw/excalidraw'
  );
  const converted = convertToExcalidrawElements(
    buildFlowchartSkeleton(document) as any,
    { regenerateIds: false }
  );
  return annotateDiagramElements([...converted], document);
}
