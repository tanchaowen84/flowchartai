'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import { CheckoutButton } from '@/components/pricing/create-checkout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getPricePlans } from '@/config/price-config';
import { useCurrentUser } from '@/hooks/use-current-user';
import { usePayment } from '@/hooks/use-payment';
import { useLocalePathname } from '@/i18n/navigation';
import { formatPrice } from '@/lib/formatter';
import {
  PaymentTypes,
  type PlanInterval,
  PlanIntervals,
  type PricePlan,
} from '@/payment/types';
import { Check } from 'lucide-react';
import React, { useRef, useState } from 'react';

interface LimitContext {
  type: 'daily' | 'monthly';
  nextResetTime?: Date;
  message?: string;
}

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitContext?: LimitContext;
}

interface PlanPriceDisplay {
  main: string;
  period: string;
  billingNote?: string;
}

const COMPACT_FEATURE_INDEXES = [0, 1, 3] as const;

function getCompactPlanFeatures(plan: PricePlan): string[] {
  return COMPACT_FEATURE_INDEXES.flatMap((index) => {
    const feature = plan.features?.[index];
    return feature ? [feature] : [];
  });
}

export function getPlanPriceDisplay(
  plan: PricePlan,
  interval: PlanInterval
): PlanPriceDisplay | null {
  const price = plan.prices.find(
    (candidate) =>
      !candidate.disabled &&
      candidate.type === PaymentTypes.SUBSCRIPTION &&
      candidate.interval === interval
  );

  if (!price) return null;

  if (interval === PlanIntervals.YEAR) {
    return {
      main: formatPrice(Math.round(price.amount / 12), price.currency),
      period: '/month',
      billingNote: `${formatPrice(price.amount, price.currency)} billed yearly`,
    };
  }

  return {
    main: formatPrice(price.amount, price.currency),
    period: '/month',
  };
}

function formatResetTime(resetTime: Date): string {
  const diff = resetTime.getTime() - Date.now();

  if (diff <= 0) return 'soon';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function PricingModal({
  isOpen,
  onClose,
  limitContext,
}: PricingModalProps) {
  const [interval, setInterval] = useState<PlanInterval>(PlanIntervals.YEAR);
  const [selectedMobilePlanId, setSelectedMobilePlanId] =
    useState('professional');
  const monthlyButtonRef = useRef<HTMLButtonElement>(null);
  const yearlyButtonRef = useRef<HTMLButtonElement>(null);
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const { currentPlan, isLoading: isPaymentLoading } = usePayment();

  const plans = Object.values(getPricePlans()).filter(
    (plan) =>
      !plan.isFree &&
      !plan.isLifetime &&
      !plan.disabled &&
      (plan.id === 'hobby' || plan.id === 'professional')
  );
  const isCurrentPlanPending = Boolean(
    currentUser && (isPaymentLoading || !currentPlan)
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedMobilePlanId('professional');
          onClose();
        }
      }}
    >
      <DialogContent
        className="w-[calc(100%-1.5rem)] border p-0 sm:max-w-[700px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const selectedButton =
            interval === PlanIntervals.YEAR
              ? yearlyButtonRef.current
              : monthlyButtonRef.current;
          selectedButton?.focus();
        }}
      >
        <div className="space-y-4 p-4 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle>Keep creating without the wait</DialogTitle>
            <DialogDescription>
              {limitContext?.message ??
                'Upgrade now for more AI requests and uninterrupted diagram editing.'}
              {limitContext?.nextResetTime && (
                <span className="mt-1 block">
                  Your current limit resets in{' '}
                  {formatResetTime(limitContext.nextResetTime)}.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            <div className="inline-flex items-center rounded-lg bg-muted p-1">
              <button
                ref={monthlyButtonRef}
                type="button"
                aria-pressed={interval === PlanIntervals.MONTH}
                onClick={() => setInterval(PlanIntervals.MONTH)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                  interval === PlanIntervals.MONTH
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                ref={yearlyButtonRef}
                type="button"
                aria-pressed={interval === PlanIntervals.YEAR}
                onClick={() => setInterval(PlanIntervals.YEAR)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                  interval === PlanIntervals.YEAR
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Yearly
                <span className="text-xs font-semibold text-primary">
                  Save up to 40%
                </span>
              </button>
            </div>
          </div>

          <div
            data-mobile-plan-selector
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:hidden"
          >
            {[...plans]
              .sort(
                (left, right) =>
                  Number(Boolean(right.recommended)) -
                  Number(Boolean(left.recommended))
              )
              .map((plan) => {
                const isSelected = selectedMobilePlanId === plan.id;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    data-plan-select={plan.id}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedMobilePlanId(plan.id)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {plan.name}
                  </button>
                );
              })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const price = plan.prices.find(
                (candidate) =>
                  !candidate.disabled &&
                  candidate.type === PaymentTypes.SUBSCRIPTION &&
                  candidate.interval === interval
              );
              const priceDisplay = getPlanPriceDisplay(plan, interval);
              const isCurrentPlan = currentPlan?.id === plan.id;
              const isRecommended = Boolean(plan.recommended);
              const compactFeatures = getCompactPlanFeatures(plan);
              const isSelectedOnMobile = selectedMobilePlanId === plan.id;

              return (
                <section
                  key={plan.id}
                  data-plan-id={plan.id}
                  data-current-plan={isCurrentPlan || undefined}
                  data-recommended={isRecommended || undefined}
                  className={`${
                    isSelectedOnMobile ? 'flex' : 'hidden'
                  } flex-col rounded-xl border p-4 sm:flex sm:p-5 ${
                    isRecommended
                      ? 'border-primary/45 bg-primary/[0.035]'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {isRecommended && (
                      <Badge className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold">
                        Recommended
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 min-h-14">
                    {priceDisplay ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[2rem] font-semibold leading-none">
                            {priceDisplay.main}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {priceDisplay.period}
                          </span>
                        </div>
                        {priceDisplay.billingNote && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {priceDisplay.billingNote}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not available
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    {isCurrentPlan ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current plan
                      </Button>
                    ) : isCurrentPlanPending ? (
                      <Button variant="outline" className="w-full" disabled>
                        Checking current plan…
                      </Button>
                    ) : price ? (
                      currentUser ? (
                        <CheckoutButton
                          userId={currentUser.id}
                          planId={plan.id}
                          priceId={price.priceId}
                          className="w-full"
                        >
                          {isRecommended
                            ? 'Upgrade to Professional'
                            : `Choose ${plan.name}`}
                        </CheckoutButton>
                      ) : (
                        <LoginWrapper
                          mode="modal"
                          asChild
                          callbackUrl={currentPath}
                        >
                          <Button className="w-full">
                            {isRecommended
                              ? 'Upgrade to Professional'
                              : `Choose ${plan.name}`}
                          </Button>
                        </LoginWrapper>
                      )
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Not available
                      </Button>
                    )}
                  </div>

                  <ul className="mt-4 flex-1 space-y-2">
                    {compactFeatures.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
