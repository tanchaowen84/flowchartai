'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { withAuthCallbackUrl } from '@/lib/auth-callback-url';
import { authClient } from '@/lib/auth-client';
import { offerCallback, selectedAuthOffer } from '@/lib/auth-offer';
import { BILLING_OFFERS, type OfferKey } from '@/lib/billing/policy';
import { creditPrice } from '@/lib/billing/presentation';
import { Routes } from '@/routes';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCreditCheckout } from './use-credit-checkout';
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
    buy,
    trackHandoff,
  } = useCreditCheckout();
  const { data: session } = authClient.useSession();
  const cards: OfferKey[] = [
    annual ? 'starter_year_202610' : 'starter_month',
    annual ? 'pro_year_202610' : 'pro_month',
  ];
  return (
    <div className="space-y-5">
      {selectedOffer && (
        <output
          id="selected-plan"
          className="rounded-lg border border-primary p-3 text-sm"
        >
          Your selected plan: {creditPrice(selectedOffer).name} ·{' '}
          {creditPrice(selectedOffer).period}. Review the plan below and
          continue to checkout when ready.
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
              <p className="font-medium">20 trial credits</p>
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
                  {offer.credits.toLocaleString()} credits each subscription
                  month
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
        <p className="mb-3 font-medium">Extra credits · one-time purchase</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['pack_small', 'pack_large'] as const).map((key) => {
            const offer = BILLING_OFFERS[key];
            return (
              <div
                key={key}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${selectedOffer === key ? 'border-primary ring-1 ring-primary' : ''}`}
              >
                <div>
                  <p className="font-medium">
                    {offer.credits.toLocaleString()} credits · $
                    {offer.amount / 100}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Never expire. No subscription required.
                  </p>
                </div>
                {session ? (
                  <Button
                    variant="outline"
                    disabled={Boolean(pending)}
                    onClick={() => buy(key)}
                  >
                    {pending === key ? 'Opening…' : 'Buy credits'}
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <LocaleLink href={loginForOffer(key)}>Sign in</LocaleLink>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        AI requests use credits based on model usage and context length. Manual
        edits, save, undo and download are free. Cancel renewal anytime;
        paid-period benefits continue. Final tax and total appear at checkout.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {checkoutUrl && (
        <a
          onClick={trackHandoff}
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Open secure checkout
        </a>
      )}
    </div>
  );
}
