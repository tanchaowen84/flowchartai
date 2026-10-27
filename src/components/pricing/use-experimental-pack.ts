'use client';
import type { Quote } from '@site-insights/sdk/contracts';
import { useEffect, useState } from 'react';
/** Only the authenticated quote endpoint supplies money. No client-side variant selection. */
export function useExperimentalPack(userId: string | undefined) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const ready = () => setRevision((v) => v + 1);
    addEventListener('insights:ready', ready);
    return () => removeEventListener('insights:ready', ready);
  }, []);
  useEffect(() => {
    setQuote(null);
    setError('');
    if (!userId) {
      setLoading(false);
      return;
    }
    let alive = true;
    const abort = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    void (async () => {
      try {
        const r = await fetch('/api/billing/experiment-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: crypto.randomUUID() }),
          signal: abort.signal,
          cache: 'no-store',
        });
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.message || 'Pricing is unavailable. Try again.');
        if (!alive) return;
        if (
          d.quote &&
          (d.quote.user_id !== userId ||
            d.quote.assignment?.value?.kind !== 'pricing')
        )
          throw new Error('Pricing is unavailable. Try again.');
        setQuote(d.quote);
        if (d.quote)
          expiry = setTimeout(
            () => {
              if (alive)
                setError(
                  'This price has expired. Refresh pricing before checkout.'
                );
            },
            Math.max(0, Date.parse(d.quote.expires_at) - Date.now())
          );
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : 'Pricing is unavailable.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      abort.abort();
      if (expiry) clearTimeout(expiry);
    };
  }, [userId, revision]);
  return {
    quote: quote?.user_id === userId ? quote : null,
    error,
    loading,
    refresh: () => setRevision((v) => v + 1),
  };
}
