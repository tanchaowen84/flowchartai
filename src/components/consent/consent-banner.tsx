'use client';

import { publishConsent } from '@/components/consent/consent-state';
import { useEffect } from 'react';

export function ConsentBanner() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // development 下不弹窗，直接告知 consent
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: any[]) {
        window.dataLayer?.push(args);
      }
      gtag('consent', 'default', {
        ad_storage: 'granted',
        ad_personalization: 'granted',
        ad_user_data: 'granted',
        analytics_storage: 'granted',
      });
      publishConsent({
        analyticsGranted: true,
        adsGranted: true,
        ready: true,
      });
      return;
    }

    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    }

    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_personalization: 'denied',
      ad_user_data: 'denied',
      analytics_storage: 'denied',
    });

    let cancelled = false;
    let started = false;

    const loadConsentManager = () => {
      if (started || cancelled) return;
      started = true;

      void import('./cookie-consent-manager').then(({ runCookieConsent }) => {
        if (cancelled) return;

        runCookieConsent(({ analyticsGranted, adsGranted }) => {
          updateConsent(analyticsGranted, adsGranted);
        });
      });
    };

    const loadTimer = window.setTimeout(loadConsentManager, 4000);
    window.addEventListener('pointerdown', loadConsentManager, { once: true });
    window.addEventListener('keydown', loadConsentManager, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      window.removeEventListener('pointerdown', loadConsentManager);
      window.removeEventListener('keydown', loadConsentManager);
    };
  }, []);

  return null;
}

function updateConsent(analyticsGranted: boolean, adsGranted: boolean) {
  const state = (granted: boolean): 'granted' | 'denied' =>
    granted ? 'granted' : 'denied';

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: state(analyticsGranted),
      ad_storage: state(adsGranted),
      ad_user_data: state(adsGranted),
      ad_personalization: state(adsGranted),
    });
  }

  publishConsent({
    analyticsGranted,
    adsGranted,
    ready: true,
  });
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}
