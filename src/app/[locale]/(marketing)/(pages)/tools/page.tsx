import Container from '@/components/layout/container';
import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { ArrowRight, Workflow } from 'lucide-react';
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
    noIndex: true,
  });
}

// Tools data
const tools = [
  {
    id: 'flowchart-maker-ai',
    title: 'AI Flowchart Maker',
    description:
      'Create professional flowcharts instantly with AI. Just describe your process and watch it come to life.',
    icon: Workflow,
    href: '/tools/flowchart-maker-ai',
    features: [
      'AI-powered generation',
      'Professional templates',
      'Export options',
    ],
    badge: 'Popular',
  },
];

export default async function ToolsPage() {
  const t = await getTranslations('ToolsPage');

  return (
    <Container className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <HeaderSection
          title={t('header.title')}
          subtitle={t('header.subtitle')}
          description={t('header.description')}
          titleAs="h1"
          subtitleAs="h2"
          className="mb-16"
        />

        {/* Tools Grid */}
        <div className="flex justify-center">
          <div className="max-w-md w-full">
            {tools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <Card
                  key={tool.id}
                  className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        {tool.badge && (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              tool.badge === 'Popular'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : tool.badge === 'New'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                            }`}
                          >
                            {tool.badge}
                          </span>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {tool.title}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Features */}
                      <div className="flex flex-wrap gap-2">
                        {tool.features.map((feature, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-muted rounded-md text-muted-foreground"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>

                      {/* Action Button */}
                      <LocaleLink href={tool.href} className="block">
                        <Button
                          className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                          variant={
                            tool.badge === 'Coming Soon'
                              ? 'secondary'
                              : 'outline'
                          }
                          disabled={tool.badge === 'Coming Soon'}
                        >
                          {tool.badge === 'Coming Soon'
                            ? 'Coming Soon'
                            : 'Try Tool'}
                          {tool.badge !== 'Coming Soon' && (
                            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          )}
                        </Button>
                      </LocaleLink>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-8 border">
            <h3 className="text-2xl font-semibold mb-4">{t('cta.title')}</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              {t('cta.description')}
            </p>
            <LocaleLink href="/canvas">
              <Button size="lg" className="gap-2">
                {t('cta.button')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </LocaleLink>
          </div>
        </div>
      </div>
    </Container>
  );
}
