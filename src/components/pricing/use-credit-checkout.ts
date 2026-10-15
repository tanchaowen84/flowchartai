'use client';
import { EVENTS } from '@/analytics/core-goals';
import { trackFlowchartEvent } from '@/analytics/plausible-browser';
import type { OfferKey } from '@/lib/billing/policy';
import { useState } from 'react';
export function useCreditCheckout(
  onCreated?: (id: string) => Promise<void> | void
) {
  const [pending, setPending] = useState<OfferKey | null>(null);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  async function buy(key: OfferKey): Promise<void> {
    if (pending) return;
    setPending(key);
    setError('');
    setUrl('');
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerKey: key }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.resumeUrl) setUrl(result.resumeUrl);
        throw new Error(result.message || 'Checkout is unavailable');
      }
      await onCreated?.(result.id);
      setUrl(result.url);
      if (popup) {
        trackFlowchartEvent(EVENTS.checkoutHandoff);
        popup.location.replace(result.url);
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : 'Checkout is unavailable');
    } finally {
      setPending(null);
    }
  }
  return { pending, error, url, buy };
}
