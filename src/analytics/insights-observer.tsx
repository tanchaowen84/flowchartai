'use client';
import { authClient } from '@/lib/auth-client';
import { useEffect, useRef } from 'react';
import { setInsightsClient } from './insights-client';
import { start } from './insights-sdk';

/** Optional first-party module. Existing analytics and business flows stay independent. */
export function InsightsObserver(): null {
  const session = authClient.useSession();
  const tracker = useRef<ReturnType<typeof start> | null>(null);
  const owner = useRef<string | null>(null);
  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_SITE_INSIGHTS_ENABLED !== 'true' ||
      location.hostname !== 'flowchartai.org'
    )
      return;
    const qa = new URL(location.href).searchParams.get('insights_qa') === '1';
    tracker.current = start({
      siteId: 'flowchart',
      endpoint: 'https://myplausible.app/insights',
      identityEndpoint: '/api/insights/identify',
      qa,
      normalizePath: (path) =>
        path
          .replace(/^\/(en|zh|ja|es|fr|de)(?=\/|$)/, '')
          .replace(/^\/canvas\/[^/]+.*$/, '/canvas/:id')
          .replace(/^\/(auth|settings)\/.*$/, '/$1/:page') || '/',
    });
    setInsightsClient(tracker.current);
    return () => {
      setInsightsClient(null);
      tracker.current?.stop();
      tracker.current = null;
    };
  }, []);
  useEffect(() => {
    if (session.isPending || !tracker.current) return;
    const id = session.data?.user?.id || null;
    if (!id) {
      tracker.current.clearIdentity();
      owner.current = null;
      setInsightsClient(tracker.current);
      return;
    }
    let cancelled = false;
    const identify = async () => {
      if (await tracker.current?.identify(id)) {
        if (!cancelled) {
          owner.current = id;
          setInsightsClient(tracker.current);
        }
      }
    };
    void identify();
    const retry = setInterval(() => {
      if (owner.current !== id) void identify();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(retry);
    };
  }, [session.isPending, session.data?.user?.id]);
  return null;
}
