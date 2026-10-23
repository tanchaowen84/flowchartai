'use client';
import { EVENTS } from '@/analytics/core-goals';
import { trackGrowth } from '@/analytics/growth-browser';
import { trackFlowchartEvent } from '@/analytics/plausible-browser';
import type { OfferKey } from '@/lib/billing/policy';
import { useRef, useState } from 'react';

interface CreditCheckout {
  pending: OfferKey | null;
  error: string;
  url: string;
  buy: (key: OfferKey) => Promise<void>;
  trackHandoff: () => void;
}

export function useCreditCheckout(
  onCreated?: (id: string) => Promise<void> | void,
  source: 'paywall' | 'pricing' = 'pricing'
): CreditCheckout {
  const [pending, setPending] = useState<OfferKey | null>(null);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const currentUrl = useRef('');
  const checkoutId = useRef<string | undefined>(undefined);
  // URLs stay in component memory; they are never analytics properties.
  const handedOff = useRef(new Set<string>());
  function trackHandoff(): void {
    const destination = currentUrl.current;
    if (!destination || handedOff.current.has(destination)) return;
    handedOff.current.add(destination);
    trackGrowth(
      'checkout_handoff',
      { checkoutId: checkoutId.current },
      { source }
    );
    trackFlowchartEvent(EVENTS.checkoutHandoff, { source });
  }
  function saveUrl(destination: string): void {
    currentUrl.current = destination;
    setUrl(destination);
  }
  async function buy(key: OfferKey): Promise<void> {
    if (pending) return;
    setPending(key);
    setError('');
    saveUrl('');
    checkoutId.current = undefined;
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
        if (
          result.resumeUrl &&
          new URL(result.resumeUrl).protocol === 'https:'
        ) {
          checkoutId.current = result.checkoutId;
          saveUrl(result.resumeUrl);
        }
        throw new Error(result.message || 'Checkout is unavailable');
      }
      if (!result.url || new URL(result.url).protocol !== 'https:')
        throw new Error('Checkout is unavailable');
      checkoutId.current = result.id;
      await onCreated?.(result.id);
      saveUrl(result.url);
      if (popup && !popup.closed) {
        popup.location.replace(result.url);
        trackHandoff();
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : 'Checkout is unavailable');
    } finally {
      setPending(null);
    }
  }
  return { pending, error, url, buy, trackHandoff };
}
