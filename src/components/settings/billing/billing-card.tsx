'use client';

import { CustomerPortalButton } from '@/components/pricing/customer-portal-button';
import { AIUsageIndicator } from '@/components/shared/ai-usage-indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPricePlans } from '@/config/price-config';
import { usePayment } from '@/hooks/use-payment';
import { LocaleLink } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { formatDate, formatPrice } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { PlanIntervals } from '@/payment/types';
import { Routes } from '@/routes';
import { RefreshCwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function BillingCard() {
  const t = useTranslations('Dashboard.settings.billing');

  const {
    isLoading: isLoadingPayment,
    error: loadPaymentError,
    subscription,
    currentPlan: currentPlanFromStore,
    refetch,
  } = usePayment();

  // Get user session for customer ID
  const { data: session, isPending: isLoadingSession } =
    authClient.useSession();
  const currentUser = session?.user;

  // Get price plans with translations - must be called here to maintain hook order
  const pricePlans = getPricePlans();
  const plans = Object.values(pricePlans);

  // Convert current plan from store to a plan with translations
  const currentPlan = currentPlanFromStore
    ? plans.find((plan) => plan.id === currentPlanFromStore?.id)
    : null;
  const isFreePlan = currentPlan?.isFree || false;
  const isLifetimeMember = currentPlan?.isLifetime || false;

  // Get subscription price details
  const currentPrice =
    subscription &&
    currentPlan?.prices.find(
      (price) => price.priceId === subscription?.priceId
    );

  // Format next billing date if subscription is active
  const nextBillingDate = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : null;

  // Determine if we are in a loading state
  const isPageLoading = isLoadingPayment || isLoadingSession;
  // console.log('billing card, isLoadingPayment', isLoadingPayment, 'isLoadingSession', isLoadingSession);

  // Render loading skeleton
  if (isPageLoading) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('currentPlan.title')}</CardTitle>
            <CardDescription>{t('currentPlan.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>

        {/* AI Usage Card Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>AI Usage</CardTitle>
            <CardDescription>Your AI feature usage statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render error state
  if (loadPaymentError) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('currentPlan.title')}</CardTitle>
            <CardDescription>{t('currentPlan.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-destructive text-sm">{loadPaymentError}</div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full cursor-pointer"
              onClick={() => refetch()}
            >
              <RefreshCwIcon className="size-4 mr-1" />
              {t('retry')}
            </Button>
          </CardFooter>
        </Card>

        {/* AI Usage Card still shows even when billing has error */}
        <AIUsageIndicator />
      </div>
    );
  }

  // currentPlanFromStore maybe null, so we need to check if it is null
  if (!currentPlanFromStore) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Card
          className={cn(
            'w-full max-w-lg md:max-w-xl overflow-hidden pt-6 pb-0 flex flex-col'
          )}
        >
          <CardHeader>
            <CardTitle>{t('currentPlan.title')}</CardTitle>
            <CardDescription>{t('currentPlan.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t('currentPlan.noPlan')}
            </div>
          </CardContent>
          <CardFooter className="mt-2 px-6 py-4 flex justify-end items-center bg-muted rounded-none">
            <Button variant="default" className="cursor-pointer" asChild>
              <LocaleLink href={Routes.Pricing}>{t('upgradePlan')}</LocaleLink>
            </Button>
          </CardFooter>
        </Card>

        {/* AI Usage Card */}
        <AIUsageIndicator />
      </div>
    );
  }

  // console.log('billing card, currentPlan', currentPlan);
  // console.log('billing card, subscription', subscription);
  // console.log('billing card, currentUser', currentUser);

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card
        className={cn(
          'w-full max-w-lg md:max-w-xl overflow-hidden pt-6 pb-0 flex flex-col'
        )}
      >
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {t('currentPlan.title')}
          </CardTitle>
          <CardDescription>{t('currentPlan.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          {/* Plan name and status */}
          <div className="flex items-center justify-between">
            <div className="text-3xl font-medium">{currentPlan?.name}</div>
            {subscription && (
              <Badge variant="outline">
                {subscription?.status === 'trialing'
                  ? t('status.trial')
                  : subscription?.status === 'active'
                    ? t('status.active')
                    : ''}
              </Badge>
            )}
          </div>

          {/* Free plan message */}
          {isFreePlan && (
            <div className="text-sm text-muted-foreground">
              {t('freePlanMessage')}
            </div>
          )}

          {/* Lifetime plan message */}
          {isLifetimeMember && (
            <div className="text-sm text-muted-foreground">
              {t('lifetimeMessage')}
            </div>
          )}

          {/* Subscription plan message */}
          {subscription && currentPrice && (
            <div className="text-sm text-muted-foreground space-y-2">
              <div>
                {t('price')}{' '}
                {formatPrice(currentPrice.amount, currentPrice.currency)} /{' '}
                {currentPrice.interval === PlanIntervals.MONTH
                  ? t('interval.month')
                  : currentPrice.interval === PlanIntervals.YEAR
                    ? t('interval.year')
                    : t('interval.oneTime')}
              </div>

              {nextBillingDate && (
                <div>
                  {t('nextBillingDate')} {nextBillingDate}
                </div>
              )}

              {subscription.status === 'trialing' &&
                subscription.currentPeriodEnd && (
                  <div className="text-amber-500">
                    {t('trialEnds')} {formatDate(subscription.currentPeriodEnd)}
                  </div>
                )}
            </div>
          )}
        </CardContent>
        <CardFooter className="mt-2 px-6 py-4 flex justify-end items-center bg-background rounded-none">
          {/* user is on free plan, show upgrade plan button */}
          {isFreePlan && (
            <Button variant="default" className="cursor-pointer" asChild>
              <LocaleLink href={Routes.Pricing}>{t('upgradePlan')}</LocaleLink>
            </Button>
          )}

          {/* user is lifetime member, show manage billing button */}
          {isLifetimeMember && currentUser && (
            <CustomerPortalButton userId={currentUser.id} className="">
              {t('manageBilling')}
            </CustomerPortalButton>
          )}

          {/* user has subscription, show manage subscription button */}
          {subscription && currentUser && (
            <CustomerPortalButton userId={currentUser.id} className="">
              {t('manageSubscription')}
            </CustomerPortalButton>
          )}
        </CardFooter>
      </Card>

      {/* AI Usage Card */}
      <AIUsageIndicator />
    </div>
  );
}
