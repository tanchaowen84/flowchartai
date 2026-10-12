import { expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import type { DrawioPatch } from './contracts';
import { applyDrawioPatch, readNativeCells } from './native-document';
import { checkPatchPlacement } from './patch-placement';
import { placeDrawioPatch } from './place-patch';
it('places an expanded subprocess in free space while keeping sibling positions', () => {
  const current = complexRefundFixture();
  const patch: DrawioPatch = {
    baseRevision: 4,
    operations: [
      {
        type: 'updateCell',
        id: 'retry_group',
        changes: { geometry: { y: 50, height: 350 } },
      },
    ],
  };
  const placed = placeDrawioPatch(current, patch);
  const after = applyDrawioPatch(current, placed);
  expect(() => checkPatchPlacement(current, after, placed)).not.toThrow();
  expect(readNativeCells(after).find((c) => c.id === 'refund')).toEqual(
    readNativeCells(current).find((c) => c.id === 'refund')
  );
  expect(readNativeCells(after).find((c) => c.id === 'supervisor')).toEqual(
    readNativeCells(current).find((c) => c.id === 'supervisor')
  );
});
