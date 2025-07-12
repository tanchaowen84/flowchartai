import { HeaderSection } from '@/components/layout/header-section';
import { BrainIcon, LanguagesIcon, RefreshCwIcon, ZapIcon } from 'lucide-react';
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

        <div className="grid items-center gap-12 lg:grid-cols-5 lg:gap-24">
          <div className="lg:col-span-2">
            <div className="lg:pr-0">
              <h2 className="text-4xl font-semibold">{t('title')}</h2>
              <p className="mt-6">{t('description')}</p>
            </div>

            <ul className="mt-8 divide-y border-y *:flex *:items-center *:gap-3 *:py-3">
              <li>
                <BrainIcon className="size-5" />
                {t('capability-1')}
              </li>
              <li>
                <ZapIcon className="size-5" />
                {t('capability-2')}
              </li>
              <li>
                <RefreshCwIcon className="size-5" />
                {t('capability-3')}
              </li>
              <li>
                <LanguagesIcon className="size-5" />
                {t('capability-4')}
              </li>
            </ul>
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
