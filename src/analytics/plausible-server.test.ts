import { afterEach, describe, expect, it, vi } from 'vitest';
import { openCheckoutContext, sealCheckoutContext } from './checkout-context';
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
      'X-Plausible-IP': '203.0.113.4',
    });
    expect(JSON.parse(options.body)).toEqual({
      name: EVENTS.processingStarted,
      domain: 'flowchartai.org',
      url: 'https://flowchartai.org/canvas',
      props: { mode: 'text_to_flowchart' },
    });
  });

  it('pins the visitor IP above the proxy address for chained and sealed checkout headers', async () => {
    production();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetcher);
    await sendServerEvent(
      EVENTS.registrationCompleted,
      {},
      new Headers({
        'user-agent': 'browser',
        'x-forwarded-for': 'unknown, 198.51.100.7, 10.0.0.1',
      })
    );
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({
      'X-Forwarded-For': '198.51.100.7',
      'X-Plausible-IP': '198.51.100.7',
    });
    // Checkout contexts sealed before this change hold only UA + XFF.
    const token = sealCheckoutContext(
      new Headers({ 'user-agent': 'browser', 'x-forwarded-for': '192.0.2.9' }),
      'secret'
    );
    const visitor = token && openCheckoutContext(token, 'secret');
    expect(visitor).toBeTruthy();
    await sendServerEvent(EVENTS.paymentConfirmed, {}, visitor as Headers);
    expect(fetcher.mock.calls[1][1].headers).toMatchObject({
      'X-Forwarded-For': '192.0.2.9',
      'X-Plausible-IP': '192.0.2.9',
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
