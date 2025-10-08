import { HeaderSection } from '@/components/layout/header-section';
import { Card } from '@/components/ui/card';
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
          />

          <UseCaseCard
            title={t('items.item-2.title')}
            description={t('items.item-2.description')}
          />

          <UseCaseCard
            title={t('items.item-3.title')}
            description={t('items.item-3.description')}
          />

          <UseCaseCard
            title={t('items.item-4.title')}
            description={t('items.item-4.description')}
          />

          <UseCaseCard
            title={t('items.item-5.title')}
            description={t('items.item-5.description')}
          />

          <UseCaseCard
            title={t('items.item-6.title')}
            description={t('items.item-6.description')}
          />
        </div>
      </div>
    </section>
  );
}

const UseCaseCard = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  return (
    <Card className="group p-8 hover:bg-accent/50 dark:hover:bg-accent/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
};
