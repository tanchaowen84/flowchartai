import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function DemoSection() {
  const t = useTranslations('HomePage.demo');

  return (
    <section id="demo" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="p"
          descriptionAs="p"
        />

        <div className="mt-12 space-y-8">
          {/* Demo Features */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <DemoFeature
              title={t('features.feature-1.title')}
              description={t('features.feature-1.description')}
              ctaLabel={t('features.feature-1.ctaLabel')}
              ctaHref={t('features.feature-1.ctaHref')}
            />
            <DemoFeature
              title={t('features.feature-2.title')}
              description={t('features.feature-2.description')}
              ctaLabel={t('features.feature-2.ctaLabel')}
              ctaHref={t('features.feature-2.ctaHref')}
            />
            <DemoFeature
              title={t('features.feature-3.title')}
              description={t('features.feature-3.description')}
              ctaLabel={t('features.feature-3.ctaLabel')}
              ctaHref={t('features.feature-3.ctaHref')}
            />
          </div>

          {/* Removed main CTA button as mini CTAs cover the flow */}
        </div>
      </div>
    </section>
  );
}

const DemoFeature = ({
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
    <div className="flex h-full flex-col items-center gap-4">
      <Card className="group h-full w-full space-y-4 p-8 text-center transition-all duration-300 hover:scale-[1.02] hover:bg-accent/50 hover:shadow-lg dark:hover:bg-accent/50">
        <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </Card>
      {ctaLabel && ctaHref ? (
        <Button asChild size="lg" className="w-full max-w-xs">
          <LocaleLink href={ctaHref}>{ctaLabel}</LocaleLink>
        </Button>
      ) : null}
    </div>
  );
};
