import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { FlowchartMakerHero } from '../flowchart-maker-ai/components/flowchart-maker-hero';
import { SEOContent } from './components/seo-content';

/**
 * Generate metadata for AI Flowchart Generator tool page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;

  return constructMetadata({
    title: 'AI Flowchart Generator – Create Flowcharts from Text Instantly',
    description:
      'Use our AI flowchart generator to turn text into professional diagrams instantly. Describe your process and get clear, editable flowcharts powered by AI.',
    canonicalUrl: getUrlWithLocale('/tools/ai-flowchart-generator', locale),
    noIndex: false,
  });
}

export default async function AIGeneratorPage() {
  return (
    <>
      <FlowchartMakerHero
        title="AI Flowchart Generator"
        description="Turn text into professional flowchart diagrams with our AI flowchart generator. Describe your process and get an instant, editable diagram."
        placeholder="Describe the process to generate a flowchart..."
      />
      <SEOContent />
    </>
  );
}
