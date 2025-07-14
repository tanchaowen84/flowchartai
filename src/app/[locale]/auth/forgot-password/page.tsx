import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({
    locale,
    namespace: 'AuthPage.forgotPassword',
  });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: t('description'),
    canonicalUrl: getUrlWithLocale('/auth/forgot-password', locale),
    noIndex: true,
  });
}

export default async function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
