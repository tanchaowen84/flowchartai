import { NextRequest, NextResponse } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  userId: undefined as string | undefined,
  request: undefined as NextRequest | undefined,
}));
vi.mock('@better-fetch/fetch', () => ({
  betterFetch: async () => ({
    data: state.userId ? { user: { id: state.userId } } : null,
  }),
}));
vi.mock('next-intl/middleware', () => ({
  default: () => (req: NextRequest) => {
    state.request = req;
    return NextResponse.next({ request: { headers: req.headers } });
  },
}));
vi.mock('@/lib/routing/known-unlocalized-paths', () => ({
  isKnownUnlocalizedPath: () => true,
}));
import middleware from '@/middleware';
import { experimentQa } from './experiment-qa';
afterEach(() => {
  vi.unstubAllEnvs();
  state.userId = undefined;
});
it('forwards anonymous QA from the URL into SSR request headers and the next pricing request', async () => {
  vi.stubEnv('SITE_INSIGHTS_EXPERIMENTS_ENABLED', 'true');
  const response = await middleware(
    new NextRequest('http://localhost/?insights_qa=1')
  );
  expect(state.request?.headers.get('x-insights-qa')).toBe('1');
  expect(response.cookies.get('insights_qa_flowchart')?.value).toBe('1');
  expect(experimentQa('insights_qa_flowchart=1')).toBe(true);
  const next = await middleware(
    new NextRequest('http://localhost/', {
      headers: { cookie: 'insights_qa_flowchart=1' },
    })
  );
  expect(next.cookies.get('insights_qa_flowchart')?.value).toBe('1');
  expect(state.request?.headers.get('x-insights-qa')).toBe('1');
});
it('marks trusted QA accounts even when a browser attempts to clear QA', async () => {
  vi.stubEnv('SITE_INSIGHTS_EXPERIMENTS_ENABLED', 'true');
  vi.stubEnv('SITE_INSIGHTS_QA_USER_IDS', 'qa-account');
  state.userId = 'qa-account';
  await middleware(new NextRequest('http://localhost/?insights_qa=0'));
  expect(state.request?.headers.get('x-insights-qa')).toBe('1');
  expect(experimentQa('', 'qa-account')).toBe(true);
  expect(experimentQa('', 'ordinary-account')).toBe(false);
});
