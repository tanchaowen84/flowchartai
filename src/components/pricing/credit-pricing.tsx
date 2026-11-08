'use client';
import { getInsightsClient } from '@/analytics/insights-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { withAuthCallbackUrl } from '@/lib/auth-callback-url';
import { authClient } from '@/lib/auth-client';
import { offerCallback, selectedAuthOffer } from '@/lib/auth-offer';
import {
  BILLING_OFFERS,
  type OfferKey,
  SIGNUP_TRIAL_CREDITS,
} from '@/lib/billing/policy';
import {
  CREDITS_PER_TYPICAL_DIAGRAM,
  approxDiagrams,
  creditPrice,
} from '@/lib/billing/presentation';
import { Routes } from '@/routes';
import { ExperimentExposure } from '@site-insights/sdk/react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCreditCheckout } from './use-credit-checkout';
import { useExperimentalPack } from './use-experimental-pack';
export function CreditPricing({
  compact = false,
  legacy = false,
}: { compact?: boolean; legacy?: boolean }): React.ReactElement {
  const query = useSearchParams();
  const path = useLocalePathname();
  const selectedOffer = selectedAuthOffer(query.get('offer'));
  const [annual, setAnnual] = useState(
    Boolean(selectedOffer?.includes('year'))
  );
  useEffect(() => {
    if (selectedOffer) setAnnual(selectedOffer.includes('year'));
  }, [selectedOffer]);
  const loginForOffer = (key: OfferKey): string =>
    withAuthCallbackUrl(
      Routes.Login,
      offerCallback(path, query.toString(), key)
    );
  const {
    pending,
    error,
    url: checkoutUrl,
    needsManualOpen,
    buy,
    trackHandoff,
  } = useCreditCheckout();
  const manualOpenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (needsManualOpen)
      manualOpenRef.current?.scrollIntoView({ block: 'center' });
  }, [needsManualOpen]);
  const { data: session } = authClient.useSession();
  const experiment = useExperimentalPack(session?.user.id);
  const cards: OfferKey[] = [
    annual ? 'starter_year_202610' : 'starter_month',
    annual ? 'pro_year_202610' : 'pro_month',
  ];
  return (
    <div className="space-y-5">
      {selectedOffer && (
        <output
          id="selected-plan"
          className="block scroll-mt-24 rounded-lg border border-primary p-3 text-sm"
        >
          Your selected plan: {creditPrice(selectedOffer).name} ·{' '}
          {creditPrice(selectedOffer).billed ||
            (selectedOffer.includes('month') ? 'Monthly' : 'One-time purchase')}
          . Review the plan below and continue to checkout when ready.
        </output>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Same AI quality and editing tools on every plan.
        </p>
        <div className="flex rounded-lg border p-1">
          <Button
            size="sm"
            variant={!annual ? 'secondary' : 'ghost'}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </Button>
          <Button
            size="sm"
            variant={annual ? 'secondary' : 'ghost'}
            onClick={() => setAnnual(true)}
          >
            Yearly · save up to 22%
          </Button>
        </div>
      </div>
      <div
        className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-3'}`}
      >
        {!compact && (
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-semibold">$0</p>
              <p className="font-medium">
                {SIGNUP_TRIAL_CREDITS} trial credits
              </p>
              {/* The first diagram's charge is capped at the trial amount
                  (first-diagram protection), so this is a policy, not an estimate. */}
              <p className="text-sm font-medium text-primary">
                Covers your first diagram
              </p>
              <p className="text-sm text-muted-foreground">
                Once at registration. Valid for 30 days.
              </p>
              <Button asChild variant="outline" className="w-full">
                <LocaleLink
                  href={
                    session
                      ? '/canvas'
                      : withAuthCallbackUrl(Routes.Register, '/canvas')
                  }
                >
                  {session ? 'Open editor' : 'Start free'}
                </LocaleLink>
              </Button>
            </CardContent>
          </Card>
        )}
        {cards.map((key) => {
          const offer = BILLING_OFFERS[key];
          return (
            <Card
              key={key}
              className={
                selectedOffer === key
                  ? 'border-primary ring-1 ring-primary'
                  : undefined
              }
            >
              <CardHeader>
                <CardTitle>
                  {offer.plan === 'pro' ? 'Pro' : 'Starter'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  <span className="text-3xl font-semibold">
                    ${creditPrice(key).main}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {' '}
                    / month
                  </span>
                </p>
                {annual && (
                  <p className="text-sm text-muted-foreground">
                    {creditPrice(key).billed}
                  </p>
                )}
                <p className="font-medium">
                  {offer.credits.toLocaleString('en-US')} credits each
                  subscription month
                </p>
                <p className="text-sm font-medium text-primary">
                  {approxDiagrams(offer.credits)} / month
                </p>
                <p className="text-sm text-muted-foreground">
                  {annual
                    ? 'Paid yearly. Credits arrive monthly.'
                    : 'Renews monthly.'}{' '}
                  Each monthly allowance expires at the end of that subscription
                  month.
                </p>
                {session ? (
                  <Button
                    className="w-full"
                    disabled={Boolean(pending) || legacy}
                    onClick={() => buy(key)}
                  >
                    {pending === key
                      ? 'Opening checkout…'
                      : legacy
                        ? 'Original plan retained'
                        : 'Continue to checkout'}
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <LocaleLink href={loginForOffer(key)}>
                      Sign in to subscribe
                    </LocaleLink>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="border-t pt-5">
        <p className="mb-3 font-medium">One-time packs · no subscription</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['pack_small', 'pack_large'] as const).map((key) => {
            const quote = key === 'pack_small' ? experiment.quote : null;
            const offer = quote
              ? {
                  amount: quote.assignment.value.amount_minor,
                  credits: quote.assignment.value.credits,
                }
              : BILLING_OFFERS[key];
            return (
              <ExperimentExposure
                key={key}
                assignment={quote?.assignment || null}
                anonymousId={quote?.anonymous_id || ''}
                getClient={getInsightsClient}
              >
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${selectedOffer === key ? 'border-primary ring-1 ring-primary' : ''}`}
                >
                  <div>
                    <p className="font-medium">
                      {offer.credits.toLocaleString('en-US')} credits · $
                      {offer.amount / 100}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-primary">
                        {approxDiagrams(offer.credits)}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · Never expire
                      </span>
                    </p>
                  </div>
                  {session ? (
                    <Button
                      disabled={
                        Boolean(pending) ||
                        (key === 'pack_small' &&
                          (experiment.loading || !!experiment.error))
                      }
                      onClick={() => buy(key, quote?.id)}
                    >
                      {pending === key ? 'Opening…' : 'Buy credits'}
                    </Button>
                  ) : (
                    <Button asChild>
                      <LocaleLink href={loginForOffer(key)}>
                        Sign in to buy
                      </LocaleLink>
                    </Button>
                  )}
                </div>
              </ExperimentExposure>
            );
          })}
        </div>
      </div>
      {experiment.error && (
        <div role="alert" className="text-sm text-destructive">
          {experiment.error}{' '}
          <button
            type="button"
            className="underline"
            onClick={experiment.refresh}
          >
            Refresh pricing
          </button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        AI requests use credits based on model usage and context length; a
        typical diagram uses ~{CREDITS_PER_TYPICAL_DIAGRAM} credits. Manual
        edits, save, undo and download are free. Cancel renewal anytime;
        paid-period benefits continue. Final tax and total appear at checkout.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {checkoutUrl &&
        (needsManualOpen ? (
          // Popup blocked (common in mobile in-app browsers): one clear tap.
          <div
            ref={manualOpenRef}
            className="space-y-2 rounded-xl border border-primary p-4 text-center"
          >
            <p className="text-sm">Checkout didn&apos;t open automatically.</p>
            <Button asChild className="min-h-12 w-full">
              <a
                onClick={trackHandoff}
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open secure checkout
              </a>
            </Button>
          </div>
        ) : (
          <a
            onClick={trackHandoff}
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-2 text-sm underline"
          >
            Open secure checkout
          </a>
        ))}
    </div>
  );
}
