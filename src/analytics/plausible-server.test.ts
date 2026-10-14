import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from './core-goals';
import { sendServerEvent } from './plausible-server';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function production(): void {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://flowchartai.org');
  vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'flowchartai.org');
  vi.stubEnv(
    'NEXT_PUBLIC_PLAUSIBLE_SCRIPT',
    'https://myplausible.app/js/script.js'
  );
}

describe('server delivery', () => {
  it('forwards actual visitor headers and sends only canonical URLs and safe properties', async () => {
    production();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetcher);
    const headers = new Headers({
      'user-agent': 'Browser QA',
      'x-vercel-forwarded-for': '203.0.113.4',
      cookie: 'private',
    });
    expect(
      await sendServerEvent(
        EVENTS.processingStarted,
        { mode: 'text_to_flowchart' },
        headers
      )
    ).toBe(true);
    const [url, options] = fetcher.mock.calls[0];
    expect(url.toString()).toBe('https://myplausible.app/api/event');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'User-Agent': 'Browser QA',
      'X-Forwarded-For': '203.0.113.4',
    });
    expect(JSON.parse(options.body)).toEqual({
      name: EVENTS.processingStarted,
      domain: 'flowchartai.org',
      url: 'https://flowchartai.org/canvas',
      props: { mode: 'text_to_flowchart' },
    });
  });

  it('skips absent visitor context and preview instead of inventing visitors', async () => {
    production();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      await sendServerEvent(EVENTS.registrationCompleted, {}, new Headers())
    ).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(
      await sendServerEvent(
        EVENTS.registrationCompleted,
        {},
        new Headers({
          'user-agent': 'browser',
          'x-forwarded-for': '203.0.113.4',
        })
      )
    ).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('detects dropped receipts and absorbs network failures', async () => {
    production();
    const fetcher = vi.fn().mockResolvedValue(
      new Response('{}', {
        status: 202,
        headers: { 'x-plausible-dropped': '1' },
      })
    );
    vi.stubGlobal('fetch', fetcher);
    const headers = new Headers({
      'user-agent': 'browser',
      'x-forwarded-for': '203.0.113.4',
    });
    expect(await sendServerEvent(EVENTS.paymentConfirmed, {}, headers)).toBe(
      false
    );
    fetcher.mockRejectedValue(new Error('offline'));
    expect(await sendServerEvent(EVENTS.paymentConfirmed, {}, headers)).toBe(
      false
    );
  });
});
