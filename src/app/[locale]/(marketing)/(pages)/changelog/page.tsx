import { ReleaseCard } from '@/components/release/release-card';
import { constructMetadata } from '@/lib/metadata';
import { getReleases } from '@/lib/release/get-releases';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { NextPageProps } from '@/types/next-page-props';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import '@/styles/mdx.css';
import Container from '@/components/layout/container';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'ChangelogPage' });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/changelog', locale),
    noIndex: true,
  });
}

export default async function ChangelogPage(props: NextPageProps) {
  const params = await props.params;
  if (!params) {
    notFound();
  }

  const locale = params.locale as Locale;
  const releases = await getReleases(locale);

  if (!releases || releases.length === 0) {
    notFound();
  }

  const t = await getTranslations('ChangelogPage');

  return (
    <Container className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-center text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-center text-lg text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* Releases */}
        <div className="mt-8">
          {releases.map((release) => (
            <ReleaseCard
              key={release.slug}
              title={release.title}
              description={release.description}
              date={release.date}
              version={release.version}
              content={release.body}
            />
          ))}
        </div>
      </div>
    </Container>
  );
}
