import { NextRequest } from 'next/server';
import { expect, it } from 'vitest';
import { originalRequestUrl } from './request-url';
it('preserves a loopback callback and opaque state in a public NextRequest', () => {
  const url = new URL('https://flowchartai.org/api/oauth/authorize');
  url.searchParams.set('redirect_uri', 'http://127.0.0.1:3051/callback');
  url.searchParams.set('state', 'opaque-127.0.0.1-state');
  expect(originalRequestUrl(new NextRequest(url)).href).toBe(url.href);
});
it('does not consume or clone a request body while reading its original URL', async () => {
  const request = new NextRequest(
    'https://flowchartai.org/api/v1/generations?value=127.0.0.1',
    { method: 'POST', body: 'original-body' }
  );
  originalRequestUrl(request);
  expect(request.bodyUsed).toBe(false);
  expect(await request.text()).toBe('original-body');
});
