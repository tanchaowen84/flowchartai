'use client';

import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { startFlowchartSession } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type * as React from 'react';

const USE_CASE_KEYS = [
  'item-1',
  'item-2',
  'item-3',
  'item-4',
  'item-5',
  'item-6',
] as const;

type UseCaseKey = (typeof USE_CASE_KEYS)[number];

export default function UseCasesSection() {
  const t = useTranslations('HomePage.useCases');
  const router = useRouter();

  const useCases = USE_CASE_KEYS.map((key) => {
    const baseKey = `items.${key}` as const;
    const promptKey = `${baseKey}.prompt` as const;

    let prompt: string | undefined;
    try {
      prompt = t(promptKey);
    } catch (error) {
      prompt = undefined;
    }

    return {
      key,
      title: t(`${baseKey}.title` as const),
      description: t(`${baseKey}.description` as const),
      ctaLabel: t(`${baseKey}.ctaLabel` as const),
      prompt,
    } satisfies {
      key: UseCaseKey;
      title: string;
      description: string;
      ctaLabel: string;
      prompt?: string;
    };
  });

  const getCtaHandler = (prompt?: string) => {
    if (!prompt) return undefined;
    return () =>
      startFlowchartSession({
        mode: 'text_to_flowchart',
        prompt,
        router,
      });
  };

  return (
    <section id="flowchart-templates" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="p"
          descriptionAs="p"
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map(({ key, title, description, ctaLabel, prompt }) => (
            <UseCaseCard
              key={key}
              title={title}
              description={description}
              ctaLabel={ctaLabel}
              onCtaClick={getCtaHandler(prompt)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const UseCaseCard = ({
  title,
  description,
  ctaLabel,
  onCtaClick,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void | Promise<void>;
}) => {
  return (
    <Card className="group flex h-full flex-col justify-between gap-6 p-8 transition-all duration-300 hover:scale-[1.02] hover:bg-accent/50 hover:shadow-lg dark:hover:bg-accent/50">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {ctaLabel && onCtaClick ? (
        <Button size="sm" className="self-start" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      ) : null}
    </Card>
  );
};
