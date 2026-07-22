export const CONSENT_UPDATE_EVENT = 'flowchartai:consent-update';

export interface ConsentSnapshot {
  analyticsGranted: boolean;
  adsGranted: boolean;
  ready: boolean;
}

const deniedSnapshot: ConsentSnapshot = {
  analyticsGranted: false,
  adsGranted: false,
  ready: false,
};

export function getConsentSnapshot(): ConsentSnapshot {
  if (typeof window === 'undefined') {
    return deniedSnapshot;
  }

  return window.__flowchartAiConsent ?? deniedSnapshot;
}

export function publishConsent(snapshot: ConsentSnapshot): void {
  window.__flowchartAiConsent = snapshot;
  window.dispatchEvent(
    new CustomEvent<ConsentSnapshot>(CONSENT_UPDATE_EVENT, {
      detail: snapshot,
    })
  );
}

declare global {
  interface Window {
    __flowchartAiConsent?: ConsentSnapshot;
  }
}
