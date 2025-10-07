'use client';

import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { useEffect, useState } from 'react';

type ConsentState = 'granted' | 'denied';

interface ConsentStatus {
  consentGranted: boolean;
  ready: boolean;
}

let initialized = false;

function initConsentBanner(onUpdate: (granted: boolean) => void) {
  if (initialized) return;
  initialized = true;

  CookieConsent.run({
    disablePageInteraction: false,
    guiOptions: {
      consentModal: {
        layout: 'box inline',
        position: 'bottom right',
        equalWeightButtons: true,
      },
      preferencesModal: {
        layout: 'bar',
        position: 'right',
      },
    },
    categories: {
      analytics: {
        enabled: false,
      },
      ads: {
        enabled: false,
      },
    },
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'We respect your privacy',
            description:
              'We use cookies to personalize content and analyse our traffic. Choose what you want to share.',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            showPreferencesBtn: 'Customize',
          },
          preferencesModal: {
            title: 'Cookie preferences',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            savePreferencesBtn: 'Save preferences',
            closeIconLabel: 'Close modal',
            sections: [
              {
                title: 'About cookies',
                description:
                  'Cookies help us deliver better experiences. You decide whether analytics/ads cookies are allowed.',
              },
              {
                title: 'Analytics cookies',
                description:
                  'Enable anonymized analytics via Google Analytics to help us improve the product.',
                linkedCategory: 'analytics',
              },
              {
                title: 'Advertising cookies',
                description:
                  'Allow personalized ads through Google AdSense and related services.',
                linkedCategory: 'ads',
              },
            ],
          },
        },
      },
    },
    onConsent: ({ cookie }) => {
      const granted = cookie.categories?.includes('analytics') ?? false;
      onUpdate(granted);
    },
    onChange: ({ cookie }) => {
      const granted = cookie.categories?.includes('analytics') ?? false;
      onUpdate(granted);
    },
  });
}

export function useConsent(): ConsentStatus {
  const [status, setStatus] = useState<ConsentStatus>({
    consentGranted: false,
    ready: false,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      setStatus({ consentGranted: true, ready: true });
      return;
    }

    initConsentBanner((granted) => {
      updateGtagConsent(granted ? 'granted' : 'denied');
      setStatus({ consentGranted: granted, ready: true });
    });

    // 初始也同步一次默认值（denied）
    updateGtagConsent('denied');
    setStatus({ consentGranted: false, ready: true });
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
