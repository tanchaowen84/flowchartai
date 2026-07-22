import type { DiagramDocument, DiagramNode } from './contracts';
import { isPatchableFlowchartNodeShape } from './flowchart-capabilities';

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
  points?: Array<[number, number]>;
  [key: string]: unknown;
}

interface Point {
  x: number;
  y: number;
}

function elementCenter(element: FlowchartSkeletonElement): Point {
  return {
    x: element.x + (element.width || 0) / 2,
    y: element.y + (element.height || 0) / 2,
  };
}

function boundaryPoint(
  element: FlowchartSkeletonElement,
  toward: Point
): Point {
  const center = elementCenter(element);
  const deltaX = toward.x - center.x;
  const deltaY = toward.y - center.y;
  if (deltaX === 0 && deltaY === 0) return center;

  const halfWidth = Math.max((element.width || 0) / 2, 1);
  const halfHeight = Math.max((element.height || 0) / 2, 1);
  const scale =
    1 / Math.max(Math.abs(deltaX) / halfWidth, Math.abs(deltaY) / halfHeight);
  return {
    x: center.x + deltaX * scale,
    y: center.y + deltaY * scale,
  };
}

export function elementIdForEntity(
  diagramId: string,
  entityType: EntityType,
  semanticId: string
): string {
  return `flowchartai:${diagramId}:${entityType}:${semanticId}`;
}

function nodeElementType(node: DiagramNode): string {
  if (!isPatchableFlowchartNodeShape(node.shape)) {
    throw new Error(`Unsupported patchable flowchart shape: ${node.shape}`);
  }
  if (node.shape === 'diamond') return 'diamond';
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
  if (queue.length === 0 && document.nodes[0]) {
    queue.push(document.nodes[0].semanticId);
  }
  for (const id of queue) ranks.set(id, 0);

  let index = 0;
  while (index < queue.length || ranks.size < document.nodes.length) {
    if (index >= queue.length) {
      const nextComponent = document.nodes.find(
        (node) => !ranks.has(node.semanticId)
      );
      if (!nextComponent) break;
      ranks.set(nextComponent.semanticId, 0);
      queue.push(nextComponent.semanticId);
    }

    const source = queue[index];
    index += 1;
    for (const target of outgoing.get(source) || []) {
      if (ranks.has(target)) continue;
      ranks.set(target, (ranks.get(source) || 0) + 1);
      queue.push(target);
    }
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
    const contentWidth = Math.max(160, node.label.length * 10 + 40);
    const circleSize = Math.max(120, node.label.length * 10 + 40);
    return {
      id: elementIdForEntity(document.diagramId, 'node', node.semanticId),
      type: nodeElementType(node),
      x: position.x,
      y: position.y,
      width: node.shape === 'circle' ? circleSize : contentWidth,
      height: node.shape === 'circle' ? circleSize : 80,
      label: { text: node.label },
      backgroundColor: node.style?.fill || '#fddf9f',
      strokeColor: node.style?.stroke || '#d68f2f',
      strokeWidth: Number.parseFloat(node.style?.['stroke-width'] || '2'),
      roundness: node.shape === 'rounded' ? { type: 3 } : undefined,
    };
  });
  const nodeBySemanticId = new Map(
    document.nodes.map((node, index) => [node.semanticId, nodes[index]])
  );
  const endpointPairs = new Set(
    document.edges.map(
      (edge) => `${edge.sourceSemanticId}\u0000${edge.targetSemanticId}`
    )
  );
  const edges: FlowchartSkeletonElement[] = document.edges.map((edge) => {
    const source = nodeBySemanticId.get(edge.sourceSemanticId);
    const target = nodeBySemanticId.get(edge.targetSemanticId);
    if (!source || !target) {
      throw new Error(`Missing endpoint for edge ${edge.semanticId}`);
    }

    const sourceCenter = elementCenter(source);
    const targetCenter = elementCenter(target);
    const start = boundaryPoint(source, targetCenter);
    const end = boundaryPoint(target, sourceCenter);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const points: Array<[number, number]> = [
      [0, 0],
      [deltaX, deltaY],
    ];
    const hasReverseEdge = endpointPairs.has(
      `${edge.targetSemanticId}\u0000${edge.sourceSemanticId}`
    );
    const length = Math.hypot(deltaX, deltaY);
    if (hasReverseEdge && length > 0) {
      const routeOffset = 48;
      points.splice(1, 0, [
        deltaX / 2 + (-deltaY / length) * routeOffset,
        deltaY / 2 + (deltaX / length) * routeOffset,
      ]);
    }

    return {
      id: elementIdForEntity(document.diagramId, 'edge', edge.semanticId),
      type: 'arrow',
      x: start.x,
      y: start.y,
      width: deltaX,
      height: deltaY,
      points,
      start: {
        id: elementIdForEntity(
          document.diagramId,
          'node',
          edge.sourceSemanticId
        ),
      },
      end: {
        id: elementIdForEntity(
          document.diagramId,
          'node',
          edge.targetSemanticId
        ),
      },
      label: edge.label ? { text: edge.label } : undefined,
      strokeStyle: edge.lineStyle === 'solid' ? 'solid' : 'dashed',
    };
  });
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
