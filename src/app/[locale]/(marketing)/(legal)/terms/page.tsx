import { CustomPage } from '@/components/page/custom-page';
import { constructMetadata } from '@/lib/metadata';
import { getPage } from '@/lib/page/get-page';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { NextPageProps } from '@/types/next-page-props';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const page = await getPage('terms-of-service', locale);

  if (!page) {
    console.warn(
      `generateMetadata, page not found for terms-of-service, locale: ${locale}`
    );
    return {};
  }

  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: page.title + ' | ' + t('title'),
    description: page.description,
    canonicalUrl: getUrlWithLocale('/terms', locale),
  });
}

export default async function TermsOfServicePage(props: NextPageProps) {
  const params = await props.params;
  if (!params) {
    notFound();
  }

  const locale = params.locale as string;
  const page = await getPage('terms-of-service', locale);

  if (!page) {
    notFound();
  }

  return (
    <CustomPage
      title={page.title}
      description={page.description}
      date={page.date}
      content={page.body}
    />
  );
}
