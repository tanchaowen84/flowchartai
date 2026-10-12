import { expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import type { DrawioPatch } from './contracts';
import { applyDrawioPatch } from './native-document';
import { checkPatchPlacement } from './patch-placement';

it('rejects an expanded nested group overlapping an existing sibling', () => {
  const current = complexRefundFixture();
  const patch: DrawioPatch = {
    baseRevision: 4,
    operations: [
      {
        type: 'updateCell',
        id: 'retry_group',
        changes: { geometry: { y: 50 } },
      },
    ],
  };
  const candidate = applyDrawioPatch(current, patch);
  expect(() => checkPatchPlacement(current, candidate, patch)).toThrow(
    /overlap/
  );
});
it('allows unrelated style edits despite pre-existing manual overlaps', () => {
  const original = complexRefundFixture();
  const current = applyDrawioPatch(original, {
    baseRevision: 4,
    operations: [
      {
        type: 'updateCell',
        id: 'retry_group',
        changes: { geometry: { y: 50 } },
      },
    ],
  });
  const patch: DrawioPatch = {
    baseRevision: 5,
    operations: [
      {
        type: 'updateCell',
        id: 'supervisor',
        changes: { style: { fontSize: '18' } },
      },
    ],
  };
  expect(() =>
    checkPatchPlacement(current, applyDrawioPatch(current, patch), patch)
  ).not.toThrow();
});
