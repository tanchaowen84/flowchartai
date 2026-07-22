import { describe, expect, it } from 'vitest';
import { withAuthCallbackUrl } from './auth-callback-url';

describe('withAuthCallbackUrl', () => {
  it('preserves the complete canvas URL through auth route switches', () => {
    expect(
      withAuthCallbackUrl('/auth/register', '/canvas/flow-1?panel=ai#assistant')
    ).toBe(
      '/auth/register?callbackUrl=%2Fcanvas%2Fflow-1%3Fpanel%3Dai%23assistant'
    );
  });

  it('does not add an empty callback parameter', () => {
    expect(withAuthCallbackUrl('/auth/login')).toBe('/auth/login');
  });
});
