import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';

export default function HowItWorksSection() {
  const t = useTranslations('HomePage.howItWorks');

  return (
    <section id="how-it-works" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
          <StepCard
            stepNumber="1"
            title={t('steps.step-1.title')}
            description={t('steps.step-1.description')}
          />

          <StepCard
            stepNumber="2"
            title={t('steps.step-2.title')}
            description={t('steps.step-2.description')}
          />

          <StepCard
            stepNumber="3"
            title={t('steps.step-3.title')}
            description={t('steps.step-3.description')}
          />
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg" className="gap-2">
            <LocaleLink href="/canvas">
              {t('getStarted')}
              <ChevronRight className="!size-4" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </section>
  );
}

const StepCard = ({
  stepNumber,
  title,
  description,
}: {
  stepNumber: string;
  title: string;
  description: string;
}) => {
  return (
    <Card className="p-6 text-center hover:bg-accent dark:hover:bg-accent">
      <div className="relative">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
          {stepNumber}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
};
