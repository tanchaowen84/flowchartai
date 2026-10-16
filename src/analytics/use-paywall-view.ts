'use client';

import { useEffect, useRef } from 'react';
import { EVENTS } from './core-goals';
import { trackFlowchartEvent } from './plausible-browser';

/** Count open transitions, including reopening, without counting rerenders. */
export function usePaywallView(isOpen: boolean): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current)
      trackFlowchartEvent(EVENTS.paywallViewed, { source: 'paywall' });
    wasOpen.current = isOpen;
  }, [isOpen]);
}
