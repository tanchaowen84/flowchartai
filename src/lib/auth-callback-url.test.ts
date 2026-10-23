import { describe, expect, it } from 'vitest';
import { safeAuthCallback, withAuthCallbackUrl } from './auth-callback-url';

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

  it('keeps internal query/hash and accepts same-origin absolute callbacks', () => {
    expect(
      safeAuthCallback(
        '/canvas/f?panel=ai#assistant',
        'https://flowchartai.org'
      )
    ).toBe('/canvas/f?panel=ai#assistant');
    expect(
      safeAuthCallback(
        'https://flowchartai.org/canvas/f?x=1#draft',
        'https://flowchartai.org'
      )
    ).toBe('/canvas/f?x=1#draft');
  });

  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    'javascript:alert(1)',
    '/auth/login?callbackUrl=/auth/login',
    '/%2f%2fevil.test',
  ])('rejects unsafe or looping callback %s', (value) => {
    expect(safeAuthCallback(value, 'https://flowchartai.org')).toBe(
      '/dashboard'
    );
  });
});
