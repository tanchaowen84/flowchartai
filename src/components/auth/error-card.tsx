import { AuthCard } from '@/components/auth/auth-card';
import { safeAuthCallback, withAuthCallbackUrl } from '@/lib/auth-callback-url';
import { Routes } from '@/routes';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const ErrorCard = ({ callbackUrl }: { callbackUrl?: string }) => {
  const t = useTranslations('AuthPage.error');

  return (
    <AuthCard
      headerLabel={t('title')}
      bottomButtonHref={withAuthCallbackUrl(
        Routes.Login,
        safeAuthCallback(callbackUrl)
      )}
      bottomButtonLabel={t('backToLogin')}
      className="border-none"
    >
      <div className="w-full flex justify-center items-center py-4 gap-2">
        <TriangleAlertIcon className="text-destructive size-4" />
        <p className="font-medium text-destructive">{t('tryAgain')}</p>
      </div>
    </AuthCard>
  );
};
