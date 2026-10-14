'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { websiteConfig } from '@/config/website';
import { usePayment } from '@/hooks/use-payment';
import { LocaleLink } from '@/i18n/navigation';
import { Routes } from '@/routes';
import { SparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function UpgradeCard() {
  if (!websiteConfig.features.enableUpgradeCard) {
    return null;
  }

  const t = useTranslations('Dashboard.upgrade');
  const [mounted, setMounted] = useState(false);
  const { isLoading, currentPlan, subscription } = usePayment();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show the upgrade card if the user has a lifetime membership or a subscription
  const isMember = currentPlan?.isLifetime || !!subscription;

  if (!mounted || isLoading || isMember) {
    return null;
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4" />
          {process.env.NEXT_PUBLIC_BILLING_V1_ENABLED === 'true'
            ? 'More credits'
            : t('title')}
        </CardTitle>
        <CardDescription>
          {process.env.NEXT_PUBLIC_BILLING_V1_ENABLED === 'true'
            ? 'Add credits when you need them.'
            : t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="cursor-pointer w-full shadow-none" size="sm">
          <LocaleLink href={Routes.SettingsBilling}>
            {process.env.NEXT_PUBLIC_BILLING_V1_ENABLED === 'true'
              ? 'Buy credits'
              : t('button')}
          </LocaleLink>
        </Button>
      </CardContent>
    </Card>
  );
}
