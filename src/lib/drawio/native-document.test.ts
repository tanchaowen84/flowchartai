import { describe, expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import {
  applyDrawioPatch,
  chooseCanvasEditor,
  nativeContentFingerprint,
  readNativeCells,
  validateDrawioXml,
} from './native-document';

describe('complex native diagram editing', () => {
  it('reads role groups, nested groups, loops and parallel connections as editable objects', () => {
    const cells = readNativeCells(complexRefundFixture());
    expect(cells.find((c) => c.id === 'retry')?.parent).toBe('retry_group');
    expect(cells.find((c) => c.id === 'retry_group')?.parent).toBe('payment');
    expect(cells.filter((c) => c.source === 'fork')).toHaveLength(2);
    expect(cells.find((c) => c.source === 'retry')?.target).toBe('refund');
  });
  it('merges requested fields while preserving manual colors, size, grouping and unrelated objects', () => {
    const doc = complexRefundFixture();
    const before = readNativeCells(doc);
    const next = applyDrawioPatch(doc, {
      baseRevision: 4,
      operations: [
        {
          type: 'updateCell',
          id: 'supervisor',
          changes: { value: '经理审批', style: { fontSize: '18' } },
        },
      ],
    });
    const after = readNativeCells(next);
    expect(after.find((c) => c.id === 'supervisor')).toEqual({
      ...before.find((c) => c.id === 'supervisor'),
      value: '经理审批',
      style: expect.stringContaining('fillColor=#ffffff'),
    });
    expect(after.find((c) => c.id === 'supervisor')?.style).toContain(
      'fontSize=18'
    );
    expect(after.filter((c) => c.id !== 'supervisor')).toEqual(
      before.filter((c) => c.id !== 'supervisor')
    );
    expect(next.revision).toBe(5);
  });
  it('changes a nested retry loop atomically without moving any existing vertex', () => {
    const doc = complexRefundFixture();
    const before = readNativeCells(doc);
    const next = applyDrawioPatch(doc, {
      baseRevision: 4,
      operations: [
        { type: 'removeCell', id: 'edge_26' },
        {
          type: 'addCell',
          xml: '<mxCell id="retry_limit" value="已重试3次？" vertex="1" parent="retry_group"><mxGeometry x="20" y="120" width="180" height="50" as="geometry"/></mxCell>',
        },
        {
          type: 'addCell',
          xml: '<mxCell id="retry_check" edge="1" parent="1" source="retry" target="retry_limit"><mxGeometry relative="1" as="geometry"/></mxCell>',
        },
        {
          type: 'addCell',
          xml: '<mxCell id="retry_again" value="否" edge="1" parent="1" source="retry_limit" target="refund"><mxGeometry relative="1" as="geometry"/></mxCell>',
        },
        {
          type: 'addCell',
          xml: '<mxCell id="retry_manual" value="是" edge="1" parent="1" source="retry_limit" target="manual"><mxGeometry relative="1" as="geometry"/></mxCell>',
        },
      ],
    });
    const after = readNativeCells(next);
    for (const cell of before.filter((c) => !c.source && !c.target))
      expect(after.find((c) => c.id === cell.id)).toEqual(cell);
    expect(after.find((c) => c.id === 'retry_manual')?.target).toBe('manual');
  });
  it('rejects stale changes after a manual edit', () => {
    expect(() =>
      applyDrawioPatch(complexRefundFixture(), {
        baseRevision: 3,
        operations: [
          { type: 'updateCell', id: 'request', changes: { value: 'changed' } },
        ],
      })
    ).toThrow(/revision/i);
  });
  it('does not treat viewport panning or zoom measurements as a diagram revision', () => {
    const xml = complexRefundFixture().xml;
    expect(
      nativeContentFingerprint(
        xml.replace('<mxGraphModel>', '<mxGraphModel dx="900" dy="600">')
      )
    ).toBe(nativeContentFingerprint(xml));
  });
  it('rejects dangling references and parent cycles', () => {
    const doc = complexRefundFixture();
    expect(() =>
      applyDrawioPatch(doc, {
        baseRevision: 4,
        operations: [{ type: 'removeCell', id: 'supervisor' }],
      })
    ).toThrow(/reference/i);
    expect(() =>
      applyDrawioPatch(doc, {
        baseRevision: 4,
        operations: [
          {
            type: 'updateCell',
            id: 'payment',
            changes: { parent: 'retry_group' },
          },
        ],
      })
    ).toThrow(/cycle/i);
  });
  it('rejects duplicate IDs, malformed XML and entity declarations', () => {
    expect(() =>
      validateDrawioXml(
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="0"/></root></mxGraphModel>'
      )
    ).toThrow(/duplicate/i);
    expect(() =>
      validateDrawioXml('<mxGraphModel><root></mxGraphModel>')
    ).toThrow();
    expect(() =>
      validateDrawioXml(
        '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><mxGraphModel/>'
      )
    ).toThrow();
  });
});

describe('saved editor dispatch', () => {
  it('keeps existing legacy objects and defaults only empty/new canvases to native', () => {
    expect(chooseCanvasEditor()).toBe('drawio');
    expect(
      chooseCanvasEditor('{"type":"excalidraw","elements":[],"files":{}}')
    ).toBe('drawio');
    expect(
      chooseCanvasEditor(
        JSON.stringify({
          elements: [],
          flowchartAi: { diagrams: { saved: { source: 'flowchart' } } },
        })
      )
    ).toBe('excalidraw');
    expect(
      chooseCanvasEditor(
        '{"type":"excalidraw","elements":[{"id":"user-note"}]}'
      )
    ).toBe('excalidraw');
    expect(chooseCanvasEditor(JSON.stringify(complexRefundFixture()))).toBe(
      'drawio'
    );
    expect(chooseCanvasEditor('{"editorKind":"drawio","xml":"bad"}')).toBe(
      'invalid'
    );
    expect(chooseCanvasEditor('{broken')).toBe('invalid');
  });
});

it('rejects shorthand geometry that cannot render native editable cells', () => {
  expect(() =>
    validateDrawioXml(
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="x" vertex="1" parent="1" geometry="x=0,y=0,width=100,height=50"/></root></mxGraphModel>'
    )
  ).toThrow(/mxGeometry/);
});
