import { expect, it } from 'vitest';
import { compileNativeGraph } from './graph-compiler';
import { readNativeCells } from './native-document';

it('compiles nested editable objects and escaped labels with canonical geometry', () => {
  const xml = compileNativeGraph({
    nodes: [
      { id: 'g', label: '部门', shape: 'group' },
      { id: 'a', label: 'A & <B>', parent: 'g', shape: 'process' },
      { id: 'b', label: '通过？', shape: 'decision' },
    ],
    edges: [{ id: 'e', source: 'a', target: 'b', label: '是' }],
  });
  const cells = readNativeCells({
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'test',
    revision: 0,
    diagramType: 'flowchart',
    xml,
  });
  expect(cells.find((c) => c.id === 'a')).toMatchObject({
    value: 'A & <B>',
    parent: 'g',
    geometry: { width: '180', height: '56' },
  });
  expect(cells.find((c) => c.id === 'e')).toMatchObject({
    source: 'a',
    target: 'b',
    value: '是',
  });
  expect(() =>
    compileNativeGraph({
      nodes: [{ id: '0', label: 'bad', shape: 'process' }],
      edges: [],
    })
  ).toThrow(/Duplicate/);
});

it('preserves native ER cardinalities and custom sequence connection points', () => {
  const xml = compileNativeGraph({
    nodes: [
      { id: 'a', label: '用户', shape: 'group' },
      { id: 'b', label: '订单', shape: 'group' },
    ],
    edges: [
      {
        id: 'rel',
        source: 'a',
        target: 'b',
        label: '拥有',
        style: { startArrow: 'ERone', endArrow: 'ERmany' },
        points: [{ x: 200, y: 40 }],
      },
    ],
  });
  expect(xml).toContain('startArrow=ERone;endArrow=ERmany;');
  expect(xml).toContain('<mxPoint x="200" y="40"');
});
