/**
 * [INPUT] Validated new native graph and its diagram family.
 * [OUTPUT] Same IDs, groups and connections with computed geometry/routing.
 * [POS] Server-only creation layout; ordinary patches never enter this module.
 * [UPDATE] Check nested groups and loop routing when changing ELK versions.
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import ELK, {
  type ElkNode,
  type ElkExtendedEdge,
} from 'elkjs/lib/elk.bundled.js';
import { readNativeCells, validateDrawioXml } from './native-document';

export async function layoutNewDiagram(
  xml: string,
  diagramType: string
): Promise<string> {
  // Sequence, ER fields and timeline coordinates carry meaning. Keep those.
  if (
    !/^(flowchart|swimlane|architecture|network|mindmap|tree)$/i.test(
      diagramType
    )
  )
    return validateDrawioXml(xml);
  const document = new DOMParser().parseFromString(
    validateDrawioXml(xml),
    'text/xml'
  );
  if (document.getElementsByTagName('mxGraphModel').length !== 1) return xml;
  const summaries = readNativeCells({
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'layout',
    revision: 0,
    diagramType,
    xml,
  });
  type XmlElement = ReturnType<typeof document.createElement>;
  const records = new Map(
    Array.from(document.getElementsByTagName('mxCell')).map((cell) => [
      cell.parentNode?.nodeName === 'object' ||
      cell.parentNode?.nodeName === 'UserObject'
        ? (cell.parentNode as XmlElement).getAttribute('id')!
        : cell.getAttribute('id')!,
      cell,
    ])
  );
  const vertices = summaries.filter(
    (cell) =>
      cell.geometry.width &&
      !cell.source &&
      !cell.target &&
      cell.parent &&
      cell.parent !== '0'
  );
  if (!vertices.length) return xml;
  const ids = new Set(vertices.map((cell) => cell.id));
  const nodes = new Map<string, ElkNode>(
    vertices.map((cell) => [
      cell.id,
      {
        id: cell.id,
        width: Math.max(40, +cell.geometry.width),
        height: Math.max(30, +cell.geometry.height),
        layoutOptions: { 'elk.padding': '[top=44,left=24,bottom=24,right=24]' },
      },
    ])
  );
  const graph: ElkNode = {
    id: 'layout-root',
    children: [],
    edges: [],
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.spacing.edgeNode': '24',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
  };
  for (const cell of vertices) {
    const parent = nodes.get(cell.parent) || graph;
    parent.children ||= [];
    parent.children.push(nodes.get(cell.id)!);
  }
  for (const cell of summaries.filter(
    (cell) =>
      cell.source && cell.target && ids.has(cell.source) && ids.has(cell.target)
  )) {
    graph.edges!.push({
      id: cell.id,
      sources: [cell.source!],
      targets: [cell.target!],
      ...(cell.value
        ? {
            labels: [
              {
                text: cell.value,
                width: Math.min(160, Math.max(24, cell.value.length * 14)),
                height: 20,
              },
            ],
          }
        : {}),
    });
  }
  const result = await new ELK().layout(graph);
  const offsets = new Map<string, { x: number; y: number }>([
    ['layout-root', { x: 0, y: 0 }],
  ]);
  const geometryFor = (id: string): XmlElement => {
    const cell = records.get(id)!;
    let geometry = Array.from(cell.childNodes).find(
      (node) => node.nodeName === 'mxGeometry'
    ) as XmlElement | undefined;
    if (!geometry) {
      geometry = document.createElement('mxGeometry');
      geometry.setAttribute('as', 'geometry');
      cell.appendChild(geometry);
    }
    return geometry;
  };
  const edges: { edge: ElkExtendedEdge; container: string }[] = [];
  const walk = (node: ElkNode, parent = { x: 0, y: 0 }): void => {
    const offset = { x: parent.x + (node.x || 0), y: parent.y + (node.y || 0) };
    offsets.set(node.id, offset);
    if (records.has(node.id)) {
      const geometry = geometryFor(node.id);
      for (const key of ['x', 'y', 'width', 'height'] as const)
        geometry.setAttribute(key, String(Math.round(node[key] || 0)));
    }
    for (const edge of node.edges || [])
      edges.push({ edge, container: edge.container || node.id });
    for (const child of node.children || []) walk(child, offset);
  };
  walk(result);
  for (const { edge, container } of edges) {
    const cell = records.get(edge.id);
    if (!cell) continue;
    const section = edge.sections?.[0];
    if (!section) continue;
    // ELK route coordinates are relative to the containing graph. Native
    // root-layer edges use absolute canvas points, including nested routes.
    const offset = offsets.get(container) || { x: 0, y: 0 };
    cell.setAttribute('parent', '1');
    const geometry = geometryFor(edge.id);
    geometry.setAttribute('relative', '1');
    for (const child of Array.from(geometry.childNodes))
      if (
        child.nodeName === 'Array' &&
        (child as XmlElement).getAttribute('as') === 'points'
      )
        geometry.removeChild(child);
    const points = document.createElement('Array');
    points.setAttribute('as', 'points');
    for (const point of [
      section.startPoint,
      ...(section.bendPoints || []),
      section.endPoint,
    ]) {
      const p = document.createElement('mxPoint');
      p.setAttribute('x', String(Math.round(point.x + offset.x)));
      p.setAttribute('y', String(Math.round(point.y + offset.y)));
      points.appendChild(p);
    }
    geometry.appendChild(points);
    cell.setAttribute(
      'style',
      (cell.getAttribute('style') || '').replace(
        /(?:edgeStyle|entryX|entryY|exitX|exitY)=[^;]*;?/g,
        ''
      ) + ';edgeStyle=segmentEdgeStyle;'
    );
  }
  return validateDrawioXml(new XMLSerializer().serializeToString(document));
}
