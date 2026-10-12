import { expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import type { DrawioPatch } from './contracts';
import { fitDrawioPatchGroups } from './fit-patch-groups';
import { applyDrawioPatch, readNativeCells } from './native-document';
it('grows nested ancestors to fit added content without moving other vertices', () => {
  const current = complexRefundFixture();
  const patch: DrawioPatch = {
    baseRevision: 4,
    operations: [
      {
        type: 'addCell',
        xml: '<mxCell id="limit" parent="retry_group" vertex="1"><mxGeometry x="20" y="1500" width="180" height="80" as="geometry"/></mxCell>',
      },
    ],
  };
  const fitted = fitDrawioPatchGroups(current, patch);
  const after = readNativeCells(applyDrawioPatch(current, fitted));
  expect(
    +after.find((c) => c.id === 'retry_group')!.geometry.height
  ).toBeGreaterThanOrEqual(1604);
  expect(
    +after.find((c) => c.id === 'payment')!.geometry.height
  ).toBeGreaterThan(2300);
  expect(after.find((c) => c.id === 'supervisor')).toEqual(
    readNativeCells(current).find((c) => c.id === 'supervisor')
  );
});
