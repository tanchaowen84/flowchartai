import { expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import { applyDrawioPatch, readNativeCells } from './native-document';
import { compileRetryPolicy } from './retry-policy';
it('initializes once outside the failure loop, bounds retries and preserves existing branches', () => {
  const current = complexRefundFixture();
  // Fixture has a direct failure-to-retry edge; use its paid decision as eligibility.
  const patch = compileRetryPolicy(current, {
    actionId: 'refund',
    retryStepId: 'retry',
    eligibilityId: 'paid',
    manualHandlerId: 'manual',
    maxRetries: 3,
  });
  const after = readNativeCells(applyDrawioPatch(current, patch));
  expect(after.find((c) => c.id === 'edge_22')?.target).toBe(
    'bounded_refund_init'
  );
  expect(after.find((c) => c.id === 'edge_25')?.target).toBe(
    'bounded_refund_check'
  );
  expect(after.find((c) => c.id === 'edge_26')?.target).toBe(
    'bounded_refund_increment'
  );
  expect(after.find((c) => c.id === 'bounded_refund_back')?.target).toBe(
    'refund'
  );
  expect(after.filter((c) => c.target === 'bounded_refund_init')).toHaveLength(
    1
  );
  expect(after.find((c) => c.id === 'supervisor')).toEqual(
    readNativeCells(current).find((c) => c.id === 'supervisor')
  );
  expect(after.find((c) => c.id === 'edge_27')).toEqual(
    readNativeCells(current).find((c) => c.id === 'edge_27')
  );
});
