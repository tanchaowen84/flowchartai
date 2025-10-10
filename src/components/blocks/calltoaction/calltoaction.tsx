import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function CallToActionSection() {
  const t = useTranslations('HomePage.calltoaction');

  return (
    <section id="call-to-action" className="px-4 py-24 bg-background">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-balance text-4xl font-semibold lg:text-5xl">
            {t('title')}
          </p>
          <p className="mt-4 text-muted-foreground">{t('description')}</p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <LocaleLink href="/canvas">
                <span>{t('primaryButton')}</span>
              </LocaleLink>
            </Button>

            <Button asChild size="lg" variant="outline">
              <LocaleLink href="/">
                <span>{t('secondaryButton')}</span>
              </LocaleLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
