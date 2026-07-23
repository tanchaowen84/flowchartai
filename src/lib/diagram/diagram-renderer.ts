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
  label?: { text: string; fontFamily?: number };
  start?: { id: string };
  end?: { id: string };
  points?: Array<[number, number]>;
  [key: string]: unknown;
}

interface Point {
  x: number;
  y: number;
}

interface MeasuredNode {
  width: number;
  height: number;
  label: string;
}

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  ranks: Map<string, number>;
}

const FONT_SIZE = 20;
const LINE_HEIGHT = 26;
const MAX_TEXT_WIDTH = 220;
const PRIMARY_GAP = 120;
const SECONDARY_GAP = 80;
const FEEDBACK_LANE_OFFSET = 80;
const FEEDBACK_LANE_GAP = 48;
const HELVETICA_FONT_FAMILY = 2;

function elementCenter(element: FlowchartSkeletonElement): Point {
  return {
    x: element.x + (element.width || 0) / 2,
    y: element.y + (element.height || 0) / 2,
  };
}

function boundaryPoint(
  element: FlowchartSkeletonElement,
  toward: Point,
  shape: DiagramNode['shape']
): Point {
  const center = elementCenter(element);
  const deltaX = toward.x - center.x;
  const deltaY = toward.y - center.y;
  if (deltaX === 0 && deltaY === 0) return center;

  const halfWidth = Math.max((element.width || 0) / 2, 1);
  const halfHeight = Math.max((element.height || 0) / 2, 1);
  let scale: number;
  if (shape === 'diamond') {
    scale = 1 / (Math.abs(deltaX) / halfWidth + Math.abs(deltaY) / halfHeight);
  } else if (shape === 'ellipse' || shape === 'stadium' || shape === 'circle') {
    scale =
      1 /
      Math.sqrt(
        (deltaX * deltaX) / (halfWidth * halfWidth) +
          (deltaY * deltaY) / (halfHeight * halfHeight)
      );
  } else {
    scale =
      1 / Math.max(Math.abs(deltaX) / halfWidth, Math.abs(deltaY) / halfHeight);
  }
  return {
    x: center.x + deltaX * scale,
    y: center.y + deltaY * scale,
  };
}

function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  );
}

function characterWidth(character: string): number {
  const codePoint = character.codePointAt(0) || 0;
  if (/\s/u.test(character)) return FONT_SIZE * 0.35;
  if (isWideCodePoint(codePoint)) return FONT_SIZE;
  if (/[.,:;!?'"()[\]{}|/\\_-]/u.test(character)) {
    return FONT_SIZE * 0.5;
  }
  return FONT_SIZE * 0.62;
}

function textWidth(text: string): number {
  return Array.from(text).reduce(
    (width, character) => width + characterWidth(character),
    0
  );
}

function splitOversizedToken(token: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (const character of Array.from(token)) {
    const candidate = `${current}${character}`;
    if (current && textWidth(candidate) > MAX_TEXT_WIDTH) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapLabel(label: string): string[] {
  const lines: string[] = [];
  for (const paragraph of label.split(/\r?\n/u)) {
    const tokens = paragraph.trim().match(/\S+/gu) || [''];
    let current = '';
    for (const token of tokens) {
      const tokenParts =
        textWidth(token) > MAX_TEXT_WIDTH
          ? splitOversizedToken(token)
          : [token];
      for (const part of tokenParts) {
        const candidate = current ? `${current} ${part}` : part;
        if (current && textWidth(candidate) > MAX_TEXT_WIDTH) {
          lines.push(current);
          current = part;
        } else {
          current = candidate;
        }
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function measureNode(node: DiagramNode): MeasuredNode {
  const lines = wrapLabel(node.label);
  const measuredTextWidth = Math.max(...lines.map(textWidth), 0);
  const measuredTextHeight = Math.max(lines.length, 1) * LINE_HEIGHT;
  const label = lines.join('\n');

  if (node.shape === 'circle') {
    const diameter = Math.max(
      120,
      Math.ceil(
        Math.max(measuredTextWidth, measuredTextHeight) * Math.SQRT2 + 40
      )
    );
    return { width: diameter, height: diameter, label };
  }

  if (node.shape === 'diamond') {
    let width = Math.max(180, Math.ceil(measuredTextWidth + 80));
    let height = Math.max(120, Math.ceil(measuredTextHeight + 72));
    const safeAreaRatio =
      (measuredTextWidth + 16) / width + (measuredTextHeight + 12) / height;
    if (safeAreaRatio > 0.82) {
      const scale = safeAreaRatio / 0.82;
      width = Math.ceil(width * scale);
      height = Math.ceil(height * scale);
    }
    return { width, height, label };
  }

  if (node.shape === 'ellipse' || node.shape === 'stadium') {
    return {
      width: Math.max(180, Math.ceil(measuredTextWidth + 64)),
      height: Math.max(90, Math.ceil(measuredTextHeight + 44)),
      label,
    };
  }

  return {
    width: Math.max(160, Math.ceil(measuredTextWidth + 48)),
    height: Math.max(80, Math.ceil(measuredTextHeight + 36)),
    label,
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
  document: DiagramDocument,
  measuredNodes: Map<string, MeasuredNode>
): LayoutResult {
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

  const horizontal = document.direction === 'LR' || document.direction === 'RL';
  const reverse = document.direction === 'RL' || document.direction === 'BT';
  const rankDimensions = new Map<number, number>();
  for (const [rank, ids] of rankRows) {
    rankDimensions.set(
      rank,
      Math.max(
        ...ids.map((id) => {
          const measured = measuredNodes.get(id);
          return horizontal ? measured?.width || 0 : measured?.height || 0;
        }),
        0
      )
    );
  }
  const rankCenters = new Map<number, number>();
  let primaryCursor = 0;
  for (const rank of [...rankRows.keys()].sort((left, right) => left - right)) {
    const dimension = rankDimensions.get(rank) || 0;
    rankCenters.set(rank, primaryCursor + dimension / 2);
    primaryCursor += dimension + PRIMARY_GAP;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [rank, ids] of rankRows) {
    let secondaryCursor = 0;
    for (const id of ids) {
      const measured = measuredNodes.get(id) || {
        width: 160,
        height: 80,
        label: id,
      };
      const primaryDimension = horizontal ? measured.width : measured.height;
      const primaryCenter = rankCenters.get(rank) || 0;
      const primary = reverse
        ? -primaryCenter - primaryDimension / 2
        : primaryCenter - primaryDimension / 2;
      const secondary = secondaryCursor;
      positions.set(
        id,
        horizontal ? { x: primary, y: secondary } : { x: secondary, y: primary }
      );
      secondaryCursor +=
        (horizontal ? measured.height : measured.width) + SECONDARY_GAP;
    }
  }

  return { positions, ranks };
}

export function buildFlowchartSkeleton(
  document: DiagramDocument
): FlowchartSkeletonElement[] {
  const measuredNodes = new Map(
    document.nodes.map((node) => [node.semanticId, measureNode(node)])
  );
  const { positions, ranks } = layoutNodes(document, measuredNodes);
  const nodes: FlowchartSkeletonElement[] = document.nodes.map((node) => {
    const position = positions.get(node.semanticId) || { x: 0, y: 0 };
    const measured = measuredNodes.get(node.semanticId) || measureNode(node);
    return {
      id: elementIdForEntity(document.diagramId, 'node', node.semanticId),
      type: nodeElementType(node),
      x: position.x,
      y: position.y,
      width: measured.width,
      height: measured.height,
      label: { text: measured.label, fontFamily: HELVETICA_FONT_FAMILY },
      backgroundColor: node.style?.fill || '#fddf9f',
      strokeColor: node.style?.stroke || '#d68f2f',
      strokeWidth: Number.parseFloat(node.style?.['stroke-width'] || '2'),
      fillStyle: 'solid',
      roughness: 0,
      roundness: node.shape === 'rounded' ? { type: 3 } : undefined,
    };
  });
  const nodeBySemanticId = new Map(
    document.nodes.map((node, index) => [node.semanticId, nodes[index]])
  );
  const nodeShapeBySemanticId = new Map(
    document.nodes.map((node) => [node.semanticId, node.shape])
  );
  const minimumNodeX =
    nodes.length > 0 ? Math.min(...nodes.map((node) => node.x)) : 0;
  const minimumNodeY =
    nodes.length > 0 ? Math.min(...nodes.map((node) => node.y)) : 0;
  const horizontal = document.direction === 'LR' || document.direction === 'RL';
  let feedbackEdgeIndex = 0;
  const edges: FlowchartSkeletonElement[] = document.edges.map((edge) => {
    const source = nodeBySemanticId.get(edge.sourceSemanticId);
    const target = nodeBySemanticId.get(edge.targetSemanticId);
    if (!source || !target) {
      throw new Error(`Missing endpoint for edge ${edge.semanticId}`);
    }

    const sourceCenter = elementCenter(source);
    const targetCenter = elementCenter(target);
    const sourceShape =
      nodeShapeBySemanticId.get(edge.sourceSemanticId) || 'rectangle';
    const targetShape =
      nodeShapeBySemanticId.get(edge.targetSemanticId) || 'rectangle';
    const sourceRank = ranks.get(edge.sourceSemanticId) || 0;
    const targetRank = ranks.get(edge.targetSemanticId) || 0;
    const isFeedbackEdge = targetRank < sourceRank;
    const laneIndex = isFeedbackEdge ? feedbackEdgeIndex++ : -1;

    let start: Point;
    let end: Point;
    let points: Array<[number, number]>;
    if (isFeedbackEdge && horizontal) {
      const laneY =
        minimumNodeY - FEEDBACK_LANE_OFFSET - laneIndex * FEEDBACK_LANE_GAP;
      start = boundaryPoint(
        source,
        { x: sourceCenter.x, y: laneY },
        sourceShape
      );
      end = boundaryPoint(target, { x: targetCenter.x, y: laneY }, targetShape);
      points = [
        [0, 0],
        [0, laneY - start.y],
        [end.x - start.x, laneY - start.y],
        [end.x - start.x, end.y - start.y],
      ];
    } else if (isFeedbackEdge) {
      const laneX =
        minimumNodeX - FEEDBACK_LANE_OFFSET - laneIndex * FEEDBACK_LANE_GAP;
      start = boundaryPoint(
        source,
        { x: laneX, y: sourceCenter.y },
        sourceShape
      );
      end = boundaryPoint(target, { x: laneX, y: targetCenter.y }, targetShape);
      points = [
        [0, 0],
        [laneX - start.x, 0],
        [laneX - start.x, end.y - start.y],
        [end.x - start.x, end.y - start.y],
      ];
    } else {
      start = boundaryPoint(source, targetCenter, sourceShape);
      end = boundaryPoint(target, sourceCenter, targetShape);
      points = [
        [0, 0],
        [end.x - start.x, end.y - start.y],
      ];
    }
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;

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
      label: edge.label
        ? { text: edge.label, fontFamily: HELVETICA_FONT_FAMILY }
        : undefined,
      roughness: 0,
      strokeStyle: edge.lineStyle === 'dashed' ? 'dashed' : 'solid',
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
