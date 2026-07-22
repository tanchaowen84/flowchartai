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
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto border p-0 sm:max-w-3xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const selectedButton =
            interval === PlanIntervals.YEAR
              ? yearlyButtonRef.current
              : monthlyButtonRef.current;
          selectedButton?.focus();
        }}
      >
        <div className="space-y-6 p-5 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle>Choose your plan</DialogTitle>
            <DialogDescription>
              {limitContext?.message ??
                'Upgrade for more AI requests and faster support.'}
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
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
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
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
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

          <div className="grid gap-4 md:grid-cols-2">
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

              return (
                <section
                  key={plan.id}
                  data-plan-id={plan.id}
                  data-current-plan={isCurrentPlan || undefined}
                  data-recommended={isRecommended || undefined}
                  className="flex flex-col rounded-xl border border-border p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    {isRecommended && (
                      <Badge className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold">
                        Recommended
                      </Badge>
                    )}
                  </div>

                  <div className="mt-5 min-h-16">
                    {priceDisplay ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-semibold">
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

                  <ul className="mt-4 flex-1 space-y-2.5">
                    {plan.features?.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
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
                          Choose {plan.name}
                        </CheckoutButton>
                      ) : (
                        <LoginWrapper
                          mode="modal"
                          asChild
                          callbackUrl={currentPath}
                        >
                          <Button className="w-full">Choose {plan.name}</Button>
                        </LoginWrapper>
                      )
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Not available
                      </Button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
