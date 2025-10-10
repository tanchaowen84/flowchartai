import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { Camera, FileCog, Replace } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export default function AiCapabilitiesSection() {
  const t = useTranslations('HomePage.aiCapabilities');
  const examples = (t.raw('examplesSection.items') as ExampleCard[]) ?? [];
  const examplesTitle = t('examplesSection.title');

  return (
    <section id="ai-capabilities" className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-8 lg:space-y-20">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          subtitleAs="p"
          description={t('description')}
          descriptionAs="p"
        />

        <div className="grid items-start gap-12 lg:grid-cols-5 lg:gap-24">
          <div className="lg:col-span-2 space-y-10">
            <div className="lg:pr-0">
              <h3 className="text-2xl font-semibold text-foreground">
                {t('sideTitle')}
              </h3>
              <p className="mt-4 text-muted-foreground">
                {t('sideDescription')}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t('workflowTitle')}
              </h4>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                {(['step-1', 'step-2', 'step-3'] as const).map(
                  (step, index) => (
                    <li
                      key={step}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="leading-relaxed text-foreground">
                        {t(`workflow.${step}`)}
                      </span>
                    </li>
                  )
                )}
              </ol>
            </div>
          </div>

          <div className="border-border/50 relative rounded-3xl border p-3 lg:col-span-3">
            <div className="bg-linear-to-b aspect-76/59 relative rounded-2xl from-zinc-300 to-transparent p-px dark:from-zinc-700">
              <div className="h-full w-full rounded-[15px] bg-gradient-to-br from-muted/50 to-background overflow-hidden flex items-center justify-center">
                <Image
                  src="https://cdn.flowchartai.org/static/blocks/ai_capabilities.png"
                  className="h-full w-full object-cover object-center"
                  alt="AI Capabilities - Intelligent Flowchart Generation"
                  width={800}
                  height={600}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {examples.length > 0 ? (
        <div className="mt-16 space-y-8">
          <h3 className="text-center text-2xl font-semibold text-foreground">
            {examplesTitle}
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {examples.map((example, index) => (
              <Card
                key={`image-flowchart-example-${example.title}`}
                className="flex h-full flex-col gap-4 rounded-2xl border bg-background p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <ExampleIcon index={index} />
                  <h4 className="text-lg font-semibold text-foreground">
                    {example.title}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {example.description}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-auto self-start"
                >
                  <LocaleLink href="/canvas">{example.ctaLabel}</LocaleLink>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type ExampleCard = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaPrompt: string;
};

function ExampleIcon({ index }: { index: number }) {
  const iconClassName = 'size-5 text-primary';
  switch (index) {
    case 1:
      return <Replace className={iconClassName} />;
    case 2:
      return <FileCog className={iconClassName} />;
    default:
      return <Camera className={iconClassName} />;
  }
}
