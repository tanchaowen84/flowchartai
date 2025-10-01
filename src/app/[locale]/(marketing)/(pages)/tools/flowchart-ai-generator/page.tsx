import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { FlowchartMakerHero } from '../flowchart-maker-ai/components/flowchart-maker-hero';
import { SEOContent } from './components/seo-content';

/**
 * Generate metadata for Flowchart AI Generator tool page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;

  return constructMetadata({
    title: 'Flowchart AI Generator – Create Flowcharts from Text Instantly',
    description:
      'Generate flowcharts from plain text with AI. Describe your process and get clean, editable diagrams in seconds with our flowchart AI generator.',
    canonicalUrl: getUrlWithLocale('/tools/flowchart-ai-generator', locale),
    noIndex: false,
  });
}

export default async function FlowchartAIGeneratorPage() {
  return (
    <>
      <FlowchartMakerHero
        title="Flowchart AI Generator"
        description="Turn text into professional flowchart diagrams. Describe your process and get an instant, editable diagram."
        placeholder="Describe the process to generate a flowchart..."
      />
      <SEOContent />
    </>
  );
}
