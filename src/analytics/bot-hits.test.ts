import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportBotHit } from './bot-hits';

describe('reportBotHit', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SITE_INSIGHTS_WRITE_KEY', 'test-write-key');
    vi.stubEnv('SITE_INSIGHTS_ENDPOINT', 'http://127.0.0.1:3998/insights');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockClear();
  });

  const request = (ua: string) =>
    new Request('https://flowchartai.org/blog/post?x=1', {
      headers: {
        'user-agent': ua,
        'x-real-ip': '20.1.2.3',
        'x-forwarded-for': '6.6.6.6',
      },
    });

  it('forwards a bot hit with the Vercel IP and pathname', async () => {
    await reportBotHit(request('Mozilla/5.0; ChatGPT-User/1.0'));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://127.0.0.1:3998/insights/api/v1/bot-hits');
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer test-write-key'
    );
    expect(JSON.parse(init.body as string)).toEqual({
      site_id: 'flowchart',
      hits: [
        {
          ua: 'Mozilla/5.0; ChatGPT-User/1.0',
          ip: '20.1.2.3',
          path: '/blog/post',
        },
      ],
    });
  });

  it('ignores ordinary visitors and missing keys', () => {
    expect(reportBotHit(request('Mozilla/5.0 Safari/605.1'))).toBeNull();
    vi.stubEnv('SITE_INSIGHTS_WRITE_KEY', '');
    expect(reportBotHit(request('GPTBot/1.1'))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never rejects when Insights is down', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));
    await expect(reportBotHit(request('bingbot/2.0'))).resolves.toBeUndefined();
  });
});
