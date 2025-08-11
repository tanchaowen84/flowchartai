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

// Tools data (simple list)
const tools = [
  {
    id: 'flowchart-maker-ai',
    title: 'AI Flowchart Maker',
    href: '/tools/flowchart-maker-ai',
  },
  {
    id: 'ai-flowchart-generator',
    title: 'AI Flowchart Generator',
    href: '/tools/ai-flowchart-generator',
  },
];

export default async function ToolsPage() {
  const t = await getTranslations('ToolsPage');

  return (
    <Container className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">AI Tools</h1>
        <ul className="space-y-3 list-disc pl-6">
          {tools.map((tool) => (
            <li key={tool.id}>
              <LocaleLink href={tool.href} className="text-primary underline">
                {tool.title}
              </LocaleLink>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
