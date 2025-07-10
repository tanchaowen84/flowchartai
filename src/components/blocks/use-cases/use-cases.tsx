import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';

export default function UseCasesSection() {
  const t = useTranslations('HomePage.useCases');

  return (
    <section id="use-cases" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  link = '/canvas',
}: {
  title: string;
  description: string;
  link?: string;
}) => {
  const t = useTranslations('HomePage.useCases');

  return (
    <Card className="p-6 hover:bg-accent dark:hover:bg-accent">
      <div className="relative">
        <div className="space-y-2 py-6">
          <h3 className="text-base font-medium">{title}</h3>
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {description}
          </p>
        </div>

        <div className="flex gap-3 border-t border-dashed pt-6">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1 pr-2 shadow-none"
          >
            <LocaleLink href={link}>
              {t('tryNow')}
              <ChevronRight className="ml-0 !size-3.5 opacity-50" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </Card>
  );
};
