'use client';
import { Button } from '@/components/ui/button';
import type { OfferKey } from '@/lib/billing/policy';
import {
  CREDITS_PER_TYPICAL_DIAGRAM,
  CREDIT_VIEWS,
  type CreditView,
  DEFAULT_CREDIT_OFFER,
  DEFAULT_CREDIT_VIEW,
  approxDiagrams,
  checkoutCta,
  creditPrice,
  offersForView,
} from '@/lib/billing/presentation';
import { useEffect, useState } from 'react';
import { useCreditCheckout } from './use-credit-checkout';
export function CreditPlanSelector({
  packsOnly = false,
  onCheckoutCreated,
}: {
  packsOnly?: boolean;
  onCheckoutCreated?: (id: string) => Promise<void> | void;
}): React.ReactElement {
  // One-time leads for everyone; subscribers (packsOnly) can only buy packs anyway.
  const [view, setView] = useState<CreditView>(DEFAULT_CREDIT_VIEW);
  const [selected, setSelected] = useState<OfferKey>(DEFAULT_CREDIT_OFFER);
  const { pending, error, url, needsManualOpen, buy, trackHandoff, clear } =
    useCreditCheckout(onCheckoutCreated, 'paywall');
  useEffect(() => {
    if (packsOnly && view !== 'once') {
      setView('once');
      setSelected(DEFAULT_CREDIT_OFFER);
      clear();
    }
  }, [packsOnly, view, clear]);
  const choose = (key: OfferKey): void => {
    if (key !== selected) clear();
    setSelected(key);
  };
  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Payment type"
        className="grid grid-cols-3 rounded-xl border bg-muted/40 p-1"
      >
        {CREDIT_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            disabled={Boolean(pending) || (packsOnly && v !== 'once')}
            onClick={() => {
              setView(v);
              choose(offersForView(v)[0]);
            }}
            className={`rounded-lg px-1 py-2.5 text-sm font-medium sm:px-3 ${view === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {v === 'monthly' ? (
              'Monthly'
            ) : v === 'once' ? (
              'One-time'
            ) : (
              <>
                Yearly{' '}
                <span className="ml-1 whitespace-nowrap rounded bg-emerald-100 px-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  Save up to 22%
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <div
        role="radiogroup"
        aria-label="Credit plan"
        className="grid gap-3 sm:grid-cols-2"
      >
        {offersForView(view).map((key) => {
          const p = creditPrice(key);
          const chosen = selected === key;
          const pro = key.startsWith('pro');
          return (
            <label
              key={key}
              className={`relative cursor-pointer rounded-xl border p-4 text-left focus-within:ring-2 focus-within:ring-primary transition-colors sm:p-5 ${chosen ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}`}
            >
              {view === 'monthly' && pro && (
                <span className="absolute right-4 top-4 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  ~30% less per credit
                </span>
              )}
              <input
                type="radio"
                name="credit-plan"
                value={key}
                checked={chosen}
                disabled={Boolean(pending)}
                onChange={() => choose(key)}
                className="sr-only"
              />
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-4 w-4 rounded-full border ${chosen ? 'border-[5px] border-primary' : 'border-muted-foreground/50'}`}
                />
                <h3 className="font-semibold">{p.name}</h3>
              </div>
              {view === 'yearly' && (
                <p className="mt-3 text-sm text-muted-foreground">
                  <s>${pro ? 19 : 9} / month</s>
                </p>
              )}
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-semibold tracking-tight">
                  ${p.main}
                </span>
                <span className="text-sm text-muted-foreground">
                  {p.period}
                </span>
              </p>
              {p.billed && (
                <p className="mt-1 text-sm text-muted-foreground">{p.billed}</p>
              )}
              <p className="mt-4 text-lg">
                <strong>{p.credits.toLocaleString('en-US')}</strong> credits
                {view !== 'once' ? ' / month' : ''}
              </p>
              <p className="mt-1 text-sm font-medium text-primary">
                {approxDiagrams(p.credits)}
                {view !== 'once' ? ' / month' : ''}
              </p>
              <p className="mt-3 min-h-6 text-xs sm:text-sm">
                {view === 'yearly' ? (
                  <span className="rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    Save ${p.savings} / year
                  </span>
                ) : view === 'monthly' ? (
                  pro ? (
                    '3× credits · $10 more / month'
                  ) : (
                    'For occasional projects'
                  )
                ) : key === 'pack_large' ? (
                  '10% lower cost per credit vs Small pack'
                ) : (
                  'For your current project'
                )}
              </p>
            </label>
          );
        })}
      </div>
      <div className="sticky bottom-0 space-y-3 border-t bg-background pb-1 pt-4">
        {needsManualOpen && url ? (
          <>
            <p className="text-center text-sm">
              Checkout didn&apos;t open automatically.
            </p>
            <Button
              asChild
              className="h-auto min-h-12 w-full whitespace-normal py-3 text-base"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackHandoff}
              >
                Open secure checkout
              </a>
            </Button>
          </>
        ) : (
          <Button
            className="h-auto min-h-12 w-full whitespace-normal py-3 text-base"
            disabled={Boolean(pending)}
            onClick={() => buy(selected)}
          >
            {pending ? 'Opening checkout…' : checkoutCta(selected)}
          </Button>
        )}
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {view === 'once'
            ? 'No subscription · Credits never expire'
            : view === 'yearly'
              ? 'Billed yearly · Credits arrive and expire monthly · Auto-renews · Cancel renewal anytime'
              : 'Renews monthly · Monthly credits expire · Cancel renewal anytime'}
          {` · A typical diagram uses ~${CREDITS_PER_TYPICAL_DIAGRAM} credits`}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {url && !needsManualOpen && (
          <output className="block text-center text-sm text-muted-foreground">
            Waiting for payment confirmation.{' '}
            <a
              className="inline-block py-2 underline"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackHandoff}
            >
              Open secure checkout
            </a>
          </output>
        )}
      </div>
    </div>
  );
}
