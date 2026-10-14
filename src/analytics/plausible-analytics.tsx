'use client';

import Script from 'next/script';

/**
 * Plausible Analytics
 *
 * NOTICE:
 * If you do not check `404 error pages` when you set up Plausible Analytics,
 * you do not need to add new script to this component.
 *
 * https://plausible.io
 * https://mksaas.com/docs/analytics#plausible
 */
export function PlausibleAnalytics({ enabled = true }: { enabled?: boolean }) {
  if (process.env.NODE_ENV !== 'production' || !enabled) {
    return null;
  }

  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN as string;
  if (!domain) {
    return null;
  }

  const script = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT as string;
  if (!script) {
    return null;
  }

  return (
    <>
      <Script id="plausible-event-queue" strategy="afterInteractive">
        {
          'window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(Array.from(arguments))}'
        }
      </Script>
      <Script
        id="plausible-analytics"
        defer
        type="text/javascript"
        data-domain={domain}
        src={script}
      />
    </>
  );
}
