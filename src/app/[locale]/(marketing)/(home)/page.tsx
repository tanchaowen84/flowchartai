import HeroSection from '@/components/blocks/hero/hero';
import { UseCasesSection } from '@/components/blocks/use-cases';
import FeaturesSection from '@/components/blocks/features/features';
import { HowItWorksSection } from '@/components/blocks/how-it-works';
import PricingSection from '@/components/blocks/pricing/pricing';
import FaqSection from '@/components/blocks/faqs/faqs';
import CallToActionSection from '@/components/blocks/calltoaction/calltoaction';
import { TutorialsSection } from '@/components/blocks/tutorials';
import {
  LazyAiCapabilitiesSection,
  LazyComparisonSection,
  LazyDemoSection,
} from '@/components/blocks/home/lazy-sections';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#metadata-api
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: t('title'),
    description: t('description'),
    canonicalUrl: getUrlWithLocale('', locale),
  });
}

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage(props: HomePageProps) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations('HomePage');

  return (
    <>
      <div className="flex flex-col">
        <HeroSection />

        <LazyDemoSection />

        <FeaturesSection />

        <LazyAiCapabilitiesSection />

        <UseCasesSection />

        <TutorialsSection />

        <HowItWorksSection />

        <LazyComparisonSection />

        <PricingSection />

        <FaqSection />

        <CallToActionSection />
      </div>
    </>
  );
}
