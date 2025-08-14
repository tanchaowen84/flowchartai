import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { FlowchartMakerHero } from '../flowchart-maker-ai/components/flowchart-maker-hero';
import { SEOContent } from './components/seo-content';

/**
 * Generate metadata for AI Agent Flowchart tool page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;

  return constructMetadata({
    title: 'Flowchart AI Agent – Intelligent Diagram Assistant',
    description:
      'Meet your flowchart AI agent that understands context, learns from feedback, and creates adaptive diagrams. Interactive flowchart creation with intelligent assistance.',
    canonicalUrl: getUrlWithLocale('/tools/ai-agent-flowchart', locale),
    noIndex: false,
  });
}

export default async function AIAgentFlowchartPage() {
  return (
    <>
      <FlowchartMakerHero
        title="Flowchart AI Agent"
        description="Your intelligent diagram assistant that understands context, asks clarifying questions, and adapts to your workflow style. Experience interactive flowchart creation."
        placeholder="Tell me about the process you want to visualize..."
      />
      <SEOContent />
    </>
  );
}
