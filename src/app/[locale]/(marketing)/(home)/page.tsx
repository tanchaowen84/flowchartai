import CallToActionSection from '@/components/blocks/calltoaction/calltoaction';
import FaqSection from '@/components/blocks/faqs/faqs';
import FeaturesSection from '@/components/blocks/features/features';
import HeroSection from '@/components/blocks/hero/hero';
import {
  LazyAiCapabilitiesSection,
  LazyComparisonSection,
  LazyDemoSection,
} from '@/components/blocks/home/lazy-sections';
import { HowItWorksSection } from '@/components/blocks/how-it-works';
import PricingSection from '@/components/blocks/pricing/pricing';
import { TutorialsSection } from '@/components/blocks/tutorials';
import { UseCasesSection } from '@/components/blocks/use-cases';
import { JsonLd } from '@/components/seo/json-ld';
import { websiteConfig } from '@/config/website';
import { defaultMessages } from '@/i18n/messages';
import { constructMetadata } from '@/lib/metadata';
import { getBaseUrl, getImageUrl, getUrlWithLocale } from '@/lib/urls/urls';
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
  const siteUrl = getBaseUrl();
  const homePageUrl = getUrlWithLocale('', locale);
  const organizationLogoUrl = getImageUrl(
    websiteConfig.metadata.images?.logoLight || '/logo.png'
  );
  const organizationId = `${siteUrl}#organization`;
  const websiteId = `${homePageUrl}#website`;
  const faqPageId = `${homePageUrl}#faq`;
  const socialProfiles = Object.values(
    websiteConfig.metadata.social ?? {}
  ).filter((profile): profile is string => Boolean(profile));

  // Keep the homepage schema in a single graph so validators can parse the
  // website, organization, and FAQ entities together instead of as fragments.
  const homePageSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: defaultMessages.Metadata.name,
        description: defaultMessages.Metadata.description,
        inLanguage: locale,
        publisher: {
          '@id': organizationId,
        },
        url: homePageUrl,
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: defaultMessages.Metadata.name,
        description: defaultMessages.Metadata.description,
        logo: {
          '@type': 'ImageObject',
          url: organizationLogoUrl,
        },
        sameAs: socialProfiles,
        url: siteUrl,
      },
      {
        '@type': 'FAQPage',
        '@id': faqPageId,
        isPartOf: {
          '@id': websiteId,
        },
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is there a free version of FlowChart AI?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. FlowChart AI is open-sourced under the MIT License and available on GitHub. You can self-host and modify it freely. We also offer a free tier so that every registered user can generate one AI flowchart per day for free.',
            },
          },
          {
            '@type': 'Question',
            name: 'What formats can I export my diagrams to?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'You can export your flowcharts in multiple formats: PNG (high-quality images), SVG (scalable vector graphics), and Excalidraw format (for re-editing). You can also copy diagrams directly to your clipboard. Access export options from the main menu (hamburger icon) in the top-left corner.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I manage my flowcharts and access them later?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. FlowChart AI provides a personal workspace where you can save, manage, and edit your flowcharts anytime, from anywhere.',
            },
          },
          {
            '@type': 'Question',
            name: 'What AI capabilities does FlowChart AI offer?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'FlowChart AI allows users to describe their processes or workflows in natural language. The AI interprets the input, handles intelligent layout and diagram structure, and generates editable flowcharts accordingly.',
            },
          },
          {
            '@type': 'Question',
            name: 'How can I upgrade or change my plan?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Yes. You can freely upgrade, downgrade, or cancel your plan through your account's billing settings.",
            },
          },
          {
            '@type': 'Question',
            name: 'How complex of a flowchart can FlowChart AI generate?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'There is no strict limit on the complexity of flowcharts. The actual capability depends on the content and structure of your input.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do I write effective prompts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Use clear natural language and structured steps. You may optionally upload reference images to aid AI understanding. FlowChart AI will then convert your input into a structured diagram.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can teams collaborate on flowcharts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Currently, FlowChart AI is built for individual use. Team collaboration and shared workspaces are part of our future roadmap.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I generate diagrams from uploaded documents?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'At the moment, FlowChart AI supports text and image inputs only. Support for document uploads including PDF, Markdown, and other formats is under active development.',
            },
          },
        ],
        publisher: {
          '@id': organizationId,
        },
        url: homePageUrl,
      },
    ],
  };

  return (
    <>
      <JsonLd data={homePageSchema} id="home-page-schema" />

      <div className="flex flex-col">
        <HeroSection />

        <LazyDemoSection />

        <FeaturesSection />

        <LazyAiCapabilitiesSection />

        <UseCasesSection />

        <TutorialsSection />

        {false && <HowItWorksSection />}

        {false && <LazyComparisonSection />}

        <PricingSection />

        <FaqSection />

        <CallToActionSection />
      </div>
    </>
  );
}
