import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@better-fetch/fetch', () => ({
  betterFetch: vi.fn(async () => ({ data: null })),
}));
vi.mock('content-collections', () => ({ allPosts: [], allCategories: [] }));
import middleware from './middleware';

describe('OAuth query integrity through locale routing', () => {
  beforeEach(() => {
    // Next's build maps skipMiddlewareUrlNormalize to this framework runtime flag.
    vi.stubEnv('__NEXT_NO_MIDDLEWARE_URL_NORMALIZE', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    'http://127.0.0.1:3051/callback',
    'http://[::1]:3051/callback',
    'https://client.example/callback',
  ])(
    'preserves the exact callback and state on a public origin: %s',
    async (callback) => {
      const url = new URL('https://flowchartai.org/developers/consent');
      url.searchParams.set('client_id', 'registered-client');
      url.searchParams.set('redirect_uri', callback);
      url.searchParams.set('state', 'opaque-127.0.0.1-state');
      const response = await middleware(new NextRequest(url));
      const rewrite = response.headers.get('x-middleware-rewrite');
      expect(rewrite).toBeTruthy();
      expect(new URL(rewrite!).searchParams.toString()).toBe(
        url.searchParams.toString()
      );
    }
  );
  it('preserves nested OAuth return parameters during login routing', async () => {
    const callback =
      '/developers/consent?redirect_uri=http%3A%2F%2F127.0.0.1%3A3051%2Fcallback&state=127.0.0.1-state';
    const url = new URL('https://flowchartai.org/auth/login');
    url.searchParams.set('callbackUrl', callback);
    const response = await middleware(new NextRequest(url));
    expect(
      new URL(response.headers.get('x-middleware-rewrite')!).searchParams.get(
        'callbackUrl'
      )
    ).toBe(callback);
  });
});
