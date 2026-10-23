'use client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useEffect, useRef } from 'react';
/** Capture once before auth navigation; bind after the authenticated return. */
export function GrowthObserver(): null {
  const user = useCurrentUser();
  const capture = useRef<Promise<Response> | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GROWTH_MEASUREMENT !== 'true') return;
    capture.current ||= fetch('/api/measurement', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'capture',
        url: window.location.href,
        referrer: document.referrer,
      }),
    });
    if (user?.id)
      void capture.current
        .then(() =>
          fetch('/api/measurement', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: 'bind' }),
          })
        )
        .catch(() => {});
    else void capture.current.catch(() => {});
  }, [user?.id]);
  return null;
}
