import { describe, expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import { layoutNewDiagram } from './layout-new-diagram';
import { readNativeCells } from './native-document';

describe('new diagram layout', () => {
  it('keeps nested groups, labels and business connections while placing every child inside its group', async () => {
    const fixture = complexRefundFixture();
    const document = {
      ...fixture,
      xml: fixture.xml.replace(/x="[^"]*" y="[^"]*"/g, 'x="0" y="0"'),
    };
    const before = readNativeCells(document);
    const xml = await layoutNewDiagram(document.xml, 'flowchart');
    const after = readNativeCells({ ...document, xml });
    expect(after.map(({ geometry, style, ...semantic }) => semantic)).toEqual(
      before.map(({ geometry, style, ...semantic }) => semantic)
    );
    for (const cell of after.filter(
      (c) => c.geometry.width && c.parent !== '1'
    )) {
      const parent = after.find((p) => p.id === cell.parent)!;
      expect(+cell.geometry.x).toBeGreaterThanOrEqual(0);
      expect(+cell.geometry.y).toBeGreaterThanOrEqual(0);
      expect(+cell.geometry.x + +cell.geometry.width).toBeLessThanOrEqual(
        +parent.geometry.width + 1
      );
      expect(+cell.geometry.y + +cell.geometry.height).toBeLessThanOrEqual(
        +parent.geometry.height + 1
      );
    }
    expect(
      after.filter((c) => c.source && c.geometry.relative === '1')
    ).toHaveLength(before.filter((c) => c.source).length);
    for (const a of after.filter((c) => c.geometry.width && !c.source)) {
      for (const b of after.filter(
        (c) =>
          c.id !== a.id &&
          c.parent === a.parent &&
          c.geometry.width &&
          !c.source
      )) {
        const overlap =
          +a.geometry.x < +b.geometry.x + +b.geometry.width &&
          +b.geometry.x < +a.geometry.x + +a.geometry.width &&
          +a.geometry.y < +b.geometry.y + +b.geometry.height &&
          +b.geometry.y < +a.geometry.y + +a.geometry.height;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });
  it('leaves coordinate-dependent sequence diagrams untouched', async () => {
    const xml = complexRefundFixture().xml;
    expect(await layoutNewDiagram(xml, 'sequence')).toBe(xml);
  });
});
