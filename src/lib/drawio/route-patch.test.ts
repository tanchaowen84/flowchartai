import { expect, it } from 'vitest';
import type { DrawioDocument, DrawioPatch } from './contracts';
import { compileNativeGraph } from './graph-compiler';
import { routeDrawioPatch } from './route-patch';

it('routes a bypass around intervening nodes without moving them', () => {
  const xml = compileNativeGraph({
    nodes: [
      { id: 'a', label: '风险', shape: 'decision', x: 100, y: 0 },
      { id: 'obstacle', label: '人工', shape: 'process', x: 100, y: 160 },
      { id: 'b', label: '审批', shape: 'process', x: 100, y: 320 },
    ],
    edges: [],
  });
  const current: DrawioDocument = {
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'test',
    revision: 0,
    diagramType: 'flowchart',
    xml,
  };
  const patch: DrawioPatch = {
    baseRevision: 0,
    operations: [
      {
        type: 'addCell',
        xml: '<mxCell id="bypass" source="a" target="b" edge="1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>',
      },
    ],
  };
  const routed = routeDrawioPatch(current, patch);
  const route = routed.operations.find(
    (op) => op.type === 'updateCell' && op.id === 'bypass'
  );
  expect(
    route?.type === 'updateCell' &&
      route.changes.points?.some((point) => point.x < 100 || point.x > 280)
  ).toBe(true);
  expect(
    routed.operations.filter(
      (op) => op.type === 'updateCell' && op.id !== 'bypass'
    )
  ).toEqual([]);
});
it('leaves unrelated/manual connection paths untouched during color changes', () => {
  const xml = compileNativeGraph({
    nodes: [
      { id: 'a', label: 'A', shape: 'process' },
      { id: 'b', label: 'B', shape: 'process', y: 300 },
    ],
    edges: [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        label: '',
        points: [{ x: 400, y: 100 }],
      },
    ],
  });
  const current: DrawioDocument = {
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'test',
    revision: 0,
    diagramType: 'flowchart',
    xml,
  };
  const patch: DrawioPatch = {
    baseRevision: 0,
    operations: [
      {
        type: 'updateCell',
        id: 'a',
        changes: { style: { fillColor: '#ff0000' } },
      },
    ],
  };
  expect(routeDrawioPatch(current, patch)).toEqual(patch);
});
