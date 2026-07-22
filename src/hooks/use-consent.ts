'use client';

import {
  CONSENT_UPDATE_EVENT,
  type ConsentSnapshot,
  getConsentSnapshot,
} from '@/components/consent/consent-state';
import { useEffect, useState } from 'react';

type ConsentState = 'granted' | 'denied';

interface ConsentStatus {
  consentGranted: boolean;
  ready: boolean;
}

export function useConsent(): ConsentStatus {
  const [status, setStatus] = useState<ConsentStatus>({
    consentGranted: false,
    ready: false,
  });

  useEffect(() => {
    const update = (snapshot: ConsentSnapshot) => {
      updateGtagConsent(snapshot.analyticsGranted ? 'granted' : 'denied');
      setStatus({
        consentGranted: snapshot.analyticsGranted,
        ready: snapshot.ready,
      });
    };

    const handleUpdate = (event: Event) => {
      update((event as CustomEvent<ConsentSnapshot>).detail);
    };

    update(getConsentSnapshot());
    window.addEventListener(CONSENT_UPDATE_EVENT, handleUpdate);

    return () => {
      window.removeEventListener(CONSENT_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  return status;
}

function updateGtagConsent(state: ConsentState) {
  if (typeof window === 'undefined' || !('gtag' in window)) {
    return;
  }

  window.gtag('consent', 'update', {
    ad_storage: state,
    ad_personalization: state,
    ad_user_data: state,
    analytics_storage: state,
  });
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer?: any[];
  }
}
