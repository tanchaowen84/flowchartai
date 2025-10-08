import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type * as React from 'react';

export default function UseCasesSection() {
  const t = useTranslations('HomePage.useCases');

  return (
    <section id="flowchart-templates" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <UseCaseCard
            title={t('items.item-1.title')}
            description={t('items.item-1.description')}
            ctaLabel={t('items.item-1.ctaLabel')}
            ctaHref={t('items.item-1.ctaHref')}
          />

          <UseCaseCard
            title={t('items.item-2.title')}
            description={t('items.item-2.description')}
            ctaLabel={t('items.item-2.ctaLabel')}
            ctaHref={t('items.item-2.ctaHref')}
          />

          <UseCaseCard
            title={t('items.item-3.title')}
            description={t('items.item-3.description')}
            ctaLabel={t('items.item-3.ctaLabel')}
            ctaHref={t('items.item-3.ctaHref')}
          />

          <UseCaseCard
            title={t('items.item-4.title')}
            description={t('items.item-4.description')}
            ctaLabel={t('items.item-4.ctaLabel')}
            ctaHref={t('items.item-4.ctaHref')}
          />

          <UseCaseCard
            title={t('items.item-5.title')}
            description={t('items.item-5.description')}
            ctaLabel={t('items.item-5.ctaLabel')}
            ctaHref={t('items.item-5.ctaHref')}
          />

          <UseCaseCard
            title={t('items.item-6.title')}
            description={t('items.item-6.description')}
            ctaLabel={t('items.item-6.ctaLabel')}
            ctaHref={t('items.item-6.ctaHref')}
          />
        </div>
      </div>
    </section>
  );
}

const UseCaseCard = ({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
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
      {ctaLabel && ctaHref ? (
        <Button asChild size="sm" className="self-start">
          <LocaleLink href={ctaHref}>{ctaLabel}</LocaleLink>
        </Button>
      ) : null}
    </Card>
  );
};
