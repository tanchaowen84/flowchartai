import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'PricingPage' });
  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/pricing', locale),
  });
}

export default async function PricingPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('PricingPage');
  return (
    <div className="mb-16">
      <div className="mt-8 w-full flex flex-col items-center justify-center gap-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-center text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <h2 className="text-center text-lg text-muted-foreground">
            {t('subtitle')}
          </h2>
        </div>
      </div>

      {children}
    </div>
  );
}
