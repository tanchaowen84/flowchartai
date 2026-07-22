'use client';

import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

interface ConsentCategories {
  analyticsGranted: boolean;
  adsGranted: boolean;
}

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
            'Cookies help us deliver FlowChart AI. You decide whether analytics and advertising cookies are allowed.',
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

export function runCookieConsent(
  onUpdate: (categories: ConsentCategories) => void
): void {
  const update = (categories: string[] = []) => {
    onUpdate({
      analyticsGranted: categories.includes('analytics'),
      adsGranted: categories.includes('ads'),
    });
  };

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
    onConsent: ({ cookie }) => update(cookie.categories),
    onChange: ({ cookie }) => update(cookie.categories),
  });
}
