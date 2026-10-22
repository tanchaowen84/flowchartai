import { NextRequest } from 'next/server';
import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  record: vi.fn(),
  bind: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('@/analytics/growth-server', () => ({
  growthEnabled: () => true,
  recordGrowth: mocks.record,
  bindAcquisition: mocks.bind,
}));
import { POST } from './route';
beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'local-test-secret');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://flowchartai.org');
  mocks.session.mockResolvedValue({
    user: { id: 'owner', createdAt: new Date() },
  });
  mocks.record.mockResolvedValue(true);
  mocks.bind.mockResolvedValue(true);
});
function request(
  body: unknown,
  origin = 'https://flowchartai.org',
  cookie = ''
): NextRequest {
  return new NextRequest('https://flowchartai.org/api/measurement', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
}
test('rejects cross-origin, unauthorized and spoofed server success events', async () => {
  expect(
    (await POST(request({ operation: 'bind' }, 'https://attacker.invalid')))
      .status
  ).toBe(403);
  mocks.session.mockResolvedValueOnce(null);
  expect((await POST(request({ operation: 'bind' }))).status).toBe(401);
  expect(
    (
      await POST(
        request({
          operation: 'event',
          id: crypto.randomUUID(),
          name: 'result_delivered',
        })
      )
    ).status
  ).toBe(400);
});
test('capture returns HttpOnly cookie and bind consumes it; missing-key handoff remains separately observable', async () => {
  const captured = await POST(
    request({
      operation: 'capture',
      url: 'https://flowchartai.org/?utm_source=email',
      referrer: '',
    })
  );
  const cookie = captured.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=lax');
  const bound = await POST(
    request({ operation: 'bind' }, undefined, cookie.split(';')[0])
  );
  expect(bound.status).toBe(204);
  expect(bound.headers.get('set-cookie')).toContain(
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
  expect(
    (
      await POST(
        request({
          operation: 'event',
          id: crypto.randomUUID(),
          name: 'checkout_handoff',
          source: 'paywall',
          userId: 'victim',
          email: 'sensitive@example.invalid',
        })
      )
    ).status
  ).toBe(204);
  const call = mocks.record.mock.calls.at(-1)!;
  expect(call[0]).toBe('owner');
  expect(JSON.stringify(call[1])).not.toContain('victim');
  expect(JSON.stringify(call[1])).not.toContain('sensitive');
});
