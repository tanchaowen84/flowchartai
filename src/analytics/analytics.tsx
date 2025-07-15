import { websiteConfig } from '@/config/website';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AhrefsAnalytics } from './ahrefs-analytics';
import { ClarityAnalytics } from './clarity-analytics';
import DataFastAnalytics from './data-fast-analytics';
import GoogleAnalytics from './google-analytics';
import OpenPanelAnalytics from './open-panel-analytics';
import { PlausibleAnalytics } from './plausible-analytics';
import { SelineAnalytics } from './seline-analytics';
import { UmamiAnalytics } from './umami-analytics';

/**
 * Analytics Components all in one
 *
 * 1. all the analytics components only work in production
 * 2. only work if the environment variable for the analytics is set
 *
 * docs:
 * https://mksaas.com/docs/analytics
 */
export function Analytics() {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      {/* google analytics */}
      <GoogleAnalytics />

      {/* umami analytics */}
      <UmamiAnalytics />

      {/* plausible analytics */}
      <PlausibleAnalytics />

      {/* microsoft clarity analytics */}
      <ClarityAnalytics />

      {/* ahrefs analytics */}
      <AhrefsAnalytics />

      {/* datafast analytics */}
      <DataFastAnalytics />

      {/* openpanel analytics */}
      <OpenPanelAnalytics />

      {/* seline analytics */}
      <SelineAnalytics />

      {/* vercel analytics */}
      {/* https://vercel.com/docs/analytics/quickstart */}
      {websiteConfig.analytics.enableVercelAnalytics && <VercelAnalytics />}

      {/* speed insights */}
      {/* https://vercel.com/docs/speed-insights/quickstart */}
      {websiteConfig.analytics.enableSpeedInsights && <SpeedInsights />}
    </>
  );
}
