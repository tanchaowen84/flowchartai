import Script from 'next/script';

/**
 * Microsoft Clarity Analytics Component
 *
 * Clarity provides user session recordings and heatmaps to understand user behavior.
 *
 * Environment Variables:
 * - NEXT_PUBLIC_CLARITY_PROJECT_ID: Your Clarity project ID
 *
 * Setup:
 * 1. Create a Clarity account at https://clarity.microsoft.com/
 * 2. Create a new project and get your project ID
 * 3. Add NEXT_PUBLIC_CLARITY_PROJECT_ID to your environment variables
 *
 * Privacy:
 * - Clarity automatically respects user privacy settings
 * - No personal data is collected without consent
 * - GDPR and CCPA compliant
 *
 * Documentation: https://docs.microsoft.com/en-us/clarity/
 */
export function ClarityAnalytics() {
  const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

  // Only load in production and if project ID is configured
  if (process.env.NODE_ENV !== 'production' || !clarityProjectId) {
    return null;
  }

  return (
    <Script id="clarity-analytics" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${clarityProjectId}");
      `}
    </Script>
  );
}
