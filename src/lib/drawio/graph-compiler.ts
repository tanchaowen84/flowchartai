/**
 * [INPUT] Structured nodes, groups and labelled connections from the Agent.
 * [OUTPUT] Canonical editable mxGraphModel XML without model-written syntax.
 * [POS] New diagram compiler; preserves native IDs for subsequent patches.
 * [UPDATE] Sync Agent tool schema, XML validation and layout tests.
 */
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { z } from 'zod';
import { validateDrawioXml } from './native-document';

export const nativeGraphSchema = z
  .object({
    nodes: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string(),
            parent: z.string().optional(),
            shape: z
              .enum([
                'process',
                'decision',
                'terminator',
                'group',
                'parallel',
                'ellipse',
                'text',
                'database',
                'actor',
              ])
              .default('process'),
            x: z.number().finite().optional(),
            y: z.number().finite().optional(),
            width: z.number().positive().optional(),
            height: z.number().positive().optional(),
            style: z.record(z.string()).optional(),
          })
          .strict()
      )
      .min(1),
    edges: z.array(
      z
        .object({
          id: z.string().min(1),
          source: z.string().min(1),
          target: z.string().min(1),
          label: z.string().default(''),
          style: z.record(z.string()).optional(),
          points: z
            .array(
              z
                .object({ x: z.number().finite(), y: z.number().finite() })
                .strict()
            )
            .optional(),
        })
        .strict()
    ),
  })
  .strict();
export type NativeGraph = z.infer<typeof nativeGraphSchema>;

const shapes: Record<string, string> = {
  process: 'rounded=1;',
  decision: 'rhombus;',
  terminator: 'ellipse;',
  group: 'swimlane;horizontal=1;startSize=36;collapsible=1;',
  parallel: 'rounded=0;fillColor=#334155;',
  ellipse: 'ellipse;',
  text: 'text;',
  database: 'shape=cylinder3;',
  actor: 'shape=umlActor;',
};

export function compileNativeGraph(
  input: NativeGraph,
  options?: { fragment?: boolean }
): string {
  const graph = nativeGraphSchema.parse(input);
  const document = new DOMImplementation().createDocument(
    null,
    'mxGraphModel',
    null
  );
  const root = document.createElement('root');
  document.documentElement!.appendChild(root);
  const add = (attributes: Record<string, string>) => {
    const cell = document.createElement('mxCell');
    for (const [key, value] of Object.entries(attributes))
      cell.setAttribute(key, value);
    root.appendChild(cell);
    return cell;
  };
  add({ id: '0' });
  add({ id: '1', parent: '0' });
  for (const node of graph.nodes) {
    let style =
      shapes[node.shape] +
      'whiteSpace=wrap;html=0;fontSize=14;fontFamily=Arial;strokeColor=#64748b;';
    for (const [key, value] of Object.entries(node.style || {})) {
      if (/[;=]/.test(key) || value.includes(';'))
        throw new Error('Use individual style keys and values');
      style += `${key}=${value};`;
    }
    const cell = add({
      id: node.id,
      value: node.label,
      parent: node.parent || '1',
      vertex: '1',
      style,
    });
    const geometry = document.createElement('mxGeometry');
    const size =
      node.shape === 'parallel'
        ? { width: 180, height: 8 }
        : node.shape === 'group'
          ? { width: 300, height: 200 }
          : { width: 180, height: node.shape === 'decision' ? 80 : 56 };
    for (const [key, value] of Object.entries({
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || size.width,
      height: node.height || size.height,
      as: 'geometry',
    }))
      geometry.setAttribute(key, String(value));
    cell.appendChild(geometry);
  }
  for (const edge of graph.edges) {
    let edgeStyle =
      'edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=0;fontSize=13;labelBackgroundColor=#ffffff;strokeColor=#64748b;';
    for (const [key, value] of Object.entries(edge.style || {})) {
      if (/[;=]/.test(key) || value.includes(';'))
        throw new Error('Use individual style keys and values');
      edgeStyle += `${key}=${value};`;
    }
    const cell = add({
      id: edge.id,
      value: edge.label,
      parent: '1',
      edge: '1',
      source: edge.source,
      target: edge.target,
      style: edgeStyle,
    });
    const geometry = document.createElement('mxGeometry');
    geometry.setAttribute('relative', '1');
    geometry.setAttribute('as', 'geometry');
    if (edge.points) {
      const array = document.createElement('Array');
      array.setAttribute('as', 'points');
      for (const point of edge.points) {
        const p = document.createElement('mxPoint');
        p.setAttribute('x', String(point.x));
        p.setAttribute('y', String(point.y));
        array.appendChild(p);
      }
      geometry.appendChild(array);
    }
    cell.appendChild(geometry);
  }
  const xml = new XMLSerializer().serializeToString(document);
  return options?.fragment ? xml : validateDrawioXml(xml);
}
