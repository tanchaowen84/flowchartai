import { HeaderSection } from '@/components/layout/header-section';
import {
  BrainIcon,
  LanguagesIcon,
  RefreshCwIcon,
  ZapIcon,
} from 'lucide-react';
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
              <Image
                src="https://cdn.flowchartai.org/static/blocks/dark-card.webp"
                className="hidden rounded-[15px] dark:block"
                alt="AI capabilities illustration dark"
                width={1207}
                height={929}
              />
              <Image
                src="https://cdn.flowchartai.org/static/blocks/card.png"
                className="rounded-[15px] shadow dark:hidden"
                alt="AI capabilities illustration light"
                width={1207}
                height={929}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
