import { InfogiphFooter } from '@/components/blocks/infogiph-footer/infogiph-footer';
import { InfogiphHero } from '@/components/blocks/infogiph-hero/infogiph-hero';
import { InfogiphHowItWorks } from '@/components/blocks/infogiph-how-it-works/infogiph-how-it-works';
import { InfogiphTestimonials } from '@/components/blocks/infogiph-testimonials/infogiph-testimonials';
import { InfogiphUseCases } from '@/components/blocks/infogiph-use-cases/infogiph-use-cases';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const t = await getTranslations('HomePage');

  return (
    <>
      <div className="flex flex-col w-full min-h-screen bg-white font-sans selection:bg-[#1AC6FF] selection:text-white">
        <InfogiphHero />
        <InfogiphHowItWorks />
        <InfogiphUseCases />
        <InfogiphTestimonials />
        <InfogiphFooter />
      </div>
    </>
  );
}
