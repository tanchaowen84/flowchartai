import { defaultMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';
import EmailButton from '@/mail/components/email-button';
import EmailLayout from '@/mail/components/email-layout';
import type { BaseEmailProps } from '@/mail/types';
import { Text } from '@react-email/components';
import { createTranslator } from 'use-intl/core';

interface ForgotPasswordProps extends BaseEmailProps {
  url: string;
  name: string;
}

export function ForgotPassword({
  url,
  name,
  locale,
  messages,
}: ForgotPasswordProps) {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'Mail.forgotPassword',
  });

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Text>{t('title', { name })}</Text>
      <Text>{t('body')}</Text>
      <EmailButton href={url}>{t('resetPassword')}</EmailButton>
    </EmailLayout>
  );
}

ForgotPassword.PreviewProps = {
  locale: routing.defaultLocale,
  messages: defaultMessages,
  url: 'https://mksaas.com',
  name: 'username',
};

export default ForgotPassword;
