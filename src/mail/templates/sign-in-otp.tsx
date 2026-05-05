import EmailLayout from '@/mail/components/email-layout';
import type { BaseEmailProps } from '@/mail/types';
import { Heading, Text } from '@react-email/components';
import { createTranslator } from 'use-intl/core';

interface SignInOtpProps extends BaseEmailProps {
  otp: string;
  expiresInMinutes: number;
}

export function SignInOtp({
  otp,
  expiresInMinutes,
  locale,
  messages,
}: SignInOtpProps) {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'Mail.signInOtp',
  });

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Heading className="text-xl">{t('title')}</Heading>
      <Text>{t('body')}</Text>
      <Text className="my-6 text-3xl font-bold tracking-widest">{otp}</Text>
      <Text>{t('expires', { minutes: expiresInMinutes })}</Text>
      <Text>{t('ignore')}</Text>
    </EmailLayout>
  );
}

export default SignInOtp;
