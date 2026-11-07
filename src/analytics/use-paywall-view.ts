'use client';

import { useEffect, useRef } from 'react';
import { EVENTS } from './core-goals';
import { trackGrowth } from './growth-browser';
import { trackFlowchartEvent } from './plausible-browser';

export type PaywallTrigger = 'auto' | 'manual';

/**
 * Count open transitions, including reopening, without counting rerenders.
 * `trigger` says whether a blocked request opened it (auto) or the user did (manual).
 */
export function usePaywallView(
  isOpen: boolean,
  trigger: PaywallTrigger = 'manual'
): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      trackGrowth('paywall_viewed', {}, { source: 'paywall' });
      trackFlowchartEvent(EVENTS.paywallViewed, { source: 'paywall', trigger });
    }
    wasOpen.current = isOpen;
  }, [isOpen, trigger]);
}
