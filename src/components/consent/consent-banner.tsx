'use client';

import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

const translations = {
  en: {
    consentModal: {
      title: 'We use cookies',
      description:
        'We use cookies to personalize content and analyse our traffic. Choose which categories to allow.',
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
            'Cookies help us deliver InfoGiph. You decide whether analytics and advertising cookies are allowed.',
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
};

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
        necessary: {
          enabled: true,
          readOnly: true,
          autoClear: {
            cookies: [],
          },
        },
        analytics: {
          enabled: false,
        },
        ads: {
          enabled: false,
        },
      },
      language: {
        default: 'en',
        translations,
      },
      onConsent: ({ cookie }) => updateConsent(cookie.categories),
      onChange: ({ cookie }) => updateConsent(cookie.categories),
    });
  }, []);

  return null;
}

function updateConsent(categories: string[] = []) {
  const analyticsGranted = categories.includes('analytics');
  const adsGranted = categories.includes('ads');

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
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}
