'use client';
import { EVENTS } from '@/analytics/core-goals';
import { trackGrowth } from '@/analytics/growth-browser';
import { trackFlowchartEvent } from '@/analytics/plausible-browser';
import { type OfferKey, isSellableOffer } from '@/lib/billing/policy';
import { useCallback, useRef, useState } from 'react';

interface CreditCheckout {
  pending: OfferKey | null;
  error: string;
  url: string;
  /** Checkout exists but no tab reached it (popup blocked or closed): needs a tap. */
  needsManualOpen: boolean;
  buy: (key: OfferKey, quoteId?: string) => Promise<void>;
  trackHandoff: () => void;
  /** Drop a checkout link that no longer matches the selected offer. */
  clear: () => void;
}

export function useCreditCheckout(
  onCreated?: (id: string) => Promise<void> | void,
  source: 'paywall' | 'pricing' = 'pricing'
): CreditCheckout {
  const [pending, setPending] = useState<OfferKey | null>(null);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [needsManualOpen, setNeedsManualOpen] = useState(false);
  const currentUrl = useRef('');
  const currentOffer = useRef<OfferKey | null>(null);
  const checkoutId = useRef<string | undefined>(undefined);
  // URLs stay in component memory; they are never analytics properties.
  const handedOff = useRef(new Set<string>());
  function trackHandoff(): void {
    const destination = currentUrl.current;
    if (!destination || handedOff.current.has(destination)) return;
    handedOff.current.add(destination);
    setNeedsManualOpen(false);
    trackGrowth(
      'checkout_handoff',
      { checkoutId: checkoutId.current },
      { source }
    );
    const offer = currentOffer.current;
    trackFlowchartEvent(EVENTS.checkoutHandoff, {
      source,
      ...(isSellableOffer(offer) ? { offer } : {}),
    });
  }
  const clear = useCallback((): void => {
    currentUrl.current = '';
    setUrl('');
    setNeedsManualOpen(false);
  }, []);
  function saveUrl(destination: string): void {
    currentUrl.current = destination;
    setUrl(destination);
  }
  async function buy(key: OfferKey, quoteId?: string): Promise<void> {
    if (pending) return;
    setPending(key);
    setError('');
    saveUrl('');
    setNeedsManualOpen(false);
    currentOffer.current = key;
    checkoutId.current = undefined;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          quoteId ? { quote_id: quoteId } : { offerKey: key }
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        if (
          result.resumeUrl &&
          new URL(result.resumeUrl).protocol === 'https:'
        ) {
          checkoutId.current = result.checkoutId;
          saveUrl(result.resumeUrl);
          setNeedsManualOpen(true);
        }
        throw new Error(result.message || 'Checkout is unavailable');
      }
      if (!result.url || new URL(result.url).protocol !== 'https:')
        throw new Error('Checkout is unavailable');
      checkoutId.current = result.id;
      await onCreated?.(result.id);
      saveUrl(result.url);
      let navigated = false;
      if (popup && !popup.closed) {
        try {
          popup.location.replace(result.url);
          navigated = true;
        } catch {
          // The tab went away mid-request; the manual link below recovers.
        }
      }
      if (navigated) trackHandoff();
      else {
        // Mobile in-app browsers and popup blockers return no tab. Ask for one
        // tap: a direct link click is a user gesture, so it does open.
        popup?.close();
        setNeedsManualOpen(true);
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : 'Checkout is unavailable');
    } finally {
      setPending(null);
    }
  }
  return { pending, error, url, needsManualOpen, buy, trackHandoff, clear };
}
