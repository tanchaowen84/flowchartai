'use client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { getInsightsClient } from './insights-client';
import type { ExperimentAssignment } from './insights-sdk';
/** Plain text slot; original product renders unless an owner explicitly starts an experiment. */
export function InsightsExperiment({
  target,
  enabled,
  children,
}: { target: string; enabled: boolean; children: ReactNode }): ReactNode {
  const currentUser = useCurrentUser();
  const ref = useRef<HTMLSpanElement>(null);
  const [assignment, setAssignment] = useState<ExperimentAssignment | null>(
    null
  );
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    setAssignment(null);
    if (!enabled) return;
    const load = async () => {
      const version = ++generation;
      const value = await getInsightsClient()?.experiment(target);
      if (!disposed && version === generation) setAssignment(value || null);
    };
    void load();
    addEventListener('insights:ready', load);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    return () => {
      disposed = true;
      clearInterval(timer);
      removeEventListener('insights:ready', load);
    };
  }, [target, enabled, currentUser?.id]);
  useEffect(() => {
    if (!assignment || !ref.current) return;
    let sent = false;
    let intersecting = false;
    const send = () => {
      if (!sent && intersecting && document.visibilityState === 'visible') {
        sent = true;
        void getInsightsClient()?.expose(assignment);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some(
          (e) => e.isIntersecting && e.intersectionRatio >= 0.5
        );
        send();
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    document.addEventListener('visibilitychange', send);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', send);
    };
  }, [assignment]);
  return (
    <span ref={ref} data-insights-slot={target}>
      {assignment?.value || children}
    </span>
  );
}
