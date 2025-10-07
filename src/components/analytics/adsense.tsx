"use client";

import Script from 'next/script';
import { useDeferredThirdParty } from '@/hooks/use-deferred-third-party';

/**
 * Google AdSense component for FlowchartAI
 * Loads the AdSense script for ad serving and site verification
 */
export function AdSense() {
  const enabled = useDeferredThirdParty();

  if (!enabled) {
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
