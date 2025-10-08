import { HeaderSection } from '@/components/layout/header-section';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export default function AiCapabilitiesSection() {
  const t = useTranslations('HomePage.aiCapabilities');

  return (
    <section id="ai-capabilities" className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-8 lg:space-y-20">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          subtitleAs="h2"
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
                {(['step-1', 'step-2', 'step-3'] as const).map((step, index) => (
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
                ))}
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
    </section>
  );
}
