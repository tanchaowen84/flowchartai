import { NotFoundContent } from '@/components/layout/not-found-content';
import { LocaleLink } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

/**
 * https://next-intl.dev/docs/environments/error-files#not-foundjs
 * https://next-intl.dev/docs/environments/error-files#catching-non-localized-requests
 */
export default function NotFound() {
  const t = useTranslations('NotFoundPage');

  return (
    <NotFoundContent
      title={t('title')}
      message={t('message')}
      homeLink={<LocaleLink href="/">{t('backToHome')}</LocaleLink>}
    />
  );
}
