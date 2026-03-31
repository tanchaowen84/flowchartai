import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'CanvasPage' });

  return constructMetadata({
    title: `${t('title')} - InfoGiph`,
    description: t('description'),
    canonicalUrl: getUrlWithLocale('/canvas', locale),
    noIndex: true,
  });
}

export default function CanvasLayout({ children }: { children: ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden">{children}</div>;
}
