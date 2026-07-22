import { Analytics } from '@/analytics/analytics';
import {
  fontBricolageGrotesque,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import AffonsoScript from '@/components/affiliate/affonso';
import PromotekitScript from '@/components/affiliate/promotekit';
import { AdSense } from '@/components/analytics/adsense';
import { TailwindIndicator } from '@/components/layout/tailwind-indicator';
import { LlmsDiscoveryLinks } from '@/components/seo/llms-discovery-links';
import { DeferredToaster } from '@/components/ui/deferred-toaster';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { type Locale, NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Providers } from './providers';

import '@/styles/globals.css';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}

/**
 * 1. Locale Layout
 * https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing#layout
 *
 * 2. NextIntlClientProvider
 * https://next-intl.dev/docs/usage/configuration#nextintlclientprovider
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <LlmsDiscoveryLinks />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          'size-full antialiased max-sm:!font-[Arial,sans-serif]',
          fontNotoSans.className,
          fontNotoSerif.variable,
          fontNotoSansMono.variable,
          fontBricolageGrotesque.variable
        )}
      >
        <NextIntlClientProvider>
          <Providers>
            {children}

            <DeferredToaster richColors position="top-right" offset={64} />
            <TailwindIndicator />
            <Analytics />
            <AdSense />
            <AffonsoScript />
            <PromotekitScript />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
