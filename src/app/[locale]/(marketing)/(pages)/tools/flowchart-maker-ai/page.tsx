import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { FlowchartMakerHero } from './components/flowchart-maker-hero';

/**
 * Generate metadata for flowchart maker AI tool page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;

  return constructMetadata({
    title: 'AI Flowchart Maker - Create Professional Flowcharts Instantly',
    description:
      'Create professional flowcharts instantly with AI. Just describe your process and watch it come to life. No design skills required.',
    canonicalUrl: getUrlWithLocale('/tools/flowchart-maker-ai', locale),
    noIndex: true,
  });
}

export default async function FlowchartMakerAIPage() {
  return <FlowchartMakerHero />;
}
