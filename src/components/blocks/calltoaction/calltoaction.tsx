'use client';

import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { startFlowchartSession } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export default function CallToActionSection() {
  const t = useTranslations('HomePage.calltoaction');
  const router = useRouter();

  const handleStartFlowchart = useCallback(async () => {
    await startFlowchartSession({
      mode: 'text_to_flowchart',
      prompt: '', // 空提示，让用户在画布中输入
      router,
    });
  }, [router]);

  return (
    <section id="call-to-action" className="px-4 py-24 bg-background">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-balance text-4xl font-semibold lg:text-5xl">
            {t('title')}
          </p>
          <p className="mt-4 text-muted-foreground">{t('description')}</p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={handleStartFlowchart}>
              <span>{t('primaryButton')}</span>
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
