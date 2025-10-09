'use client';

import { useConsent } from '@/hooks/use-consent';
import Script from 'next/script';

/**
 * Google AdSense component for FlowchartAI
 * Loads the AdSense script for ad serving and site verification
 */
export function AdSense() {
  const { consentGranted, ready } = useConsent();

  if (!ready || !consentGranted) {
    return null;
  }

  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4499901488700637"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
