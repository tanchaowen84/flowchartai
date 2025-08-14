import Container from '@/components/layout/container';
import { LocaleLink } from '@/i18n/navigation';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

/**
 * Generate metadata for tools page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ToolsPage' });

  return constructMetadata({
    title: t('meta.title'),
    description: t('meta.description'),
    canonicalUrl: getUrlWithLocale('/tools', locale),
    noIndex: false,
  });
}

// Tools data (with one-line descriptions)
const tools = [
  {
    id: 'flowchart-maker-ai',
    title: 'AI Flowchart Maker',
    href: '/tools/flowchart-maker-ai',
    description:
      'Create professional flowcharts instantly — describe your process and get clean diagrams. No design skills required.',
  },
  {
    id: 'ai-flowchart-generator',
    title: 'AI Flowchart Generator',
    href: '/tools/ai-flowchart-generator',
    description:
      'Turn plain text into clear, editable flowcharts in seconds with smart auto‑layout and standard symbols.',
  },
  {
    id: 'flowchart-ai-generator',
    title: 'Flowchart AI Generator',
    href: '/tools/flowchart-ai-generator',
    description:
      'Generate flowcharts from plain text with AI — clear, editable, and fast.',
  },
  {
    id: 'ai-agent-flowchart',
    title: 'Flowchart AI Agent',
    href: '/tools/ai-agent-flowchart',
    description:
      'Intelligent process collaboration through conversational AI — your autonomous assistant for enterprise workflow modeling.',
  },
];

export default async function ToolsPage() {
  const t = await getTranslations('ToolsPage');

  return (
    <Container className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">AI Tools</h1>
          <p className="mt-2 text-muted-foreground">
            Share your ideas and let our AI tools generate helpful outputs with
            one click.
          </p>
        </div>

        <div className="divide-y border-y">
          {tools.map((tool) => (
            <div key={tool.id} className="py-5">
              <h2 className="text-xl font-medium">
                <LocaleLink href={tool.href} className="text-primary underline">
                  {tool.title}
                </LocaleLink>
              </h2>
              {tool.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {tool.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
