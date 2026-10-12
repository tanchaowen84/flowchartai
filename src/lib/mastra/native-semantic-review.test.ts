import { expect, it } from 'vitest';
import { assertNativeReview } from './native-semantic-review';

it('rejects lost branches with correction feedback and fails closed on malformed review', () => {
  expect(() =>
    assertNativeReview({
      valid: false,
      issues: [
        'd5 was deleted; non-retryable failures must still go directly to manual handling',
      ],
    })
  ).toThrow(/d5/);
  expect(() => assertNativeReview({ valid: true, issues: [] })).not.toThrow();
  expect(() =>
    assertNativeReview({ valid: 'yes', issues: [] } as never)
  ).toThrow();
});
