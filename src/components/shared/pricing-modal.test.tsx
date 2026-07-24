// biome-ignore lint/style/useImportType: Vitest's JSX transform requires React at runtime.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(
  (): { currentPlanId: string | null; isLoading: boolean } => ({
    currentPlanId: 'free',
    isLoading: false,
  })
);

vi.mock('@/components/auth/login-wrapper', () => ({
  LoginWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/pricing/create-checkout-button', () => ({
  CheckoutButton: ({
    children,
    planId,
    priceId,
  }: {
    children: React.ReactNode;
    planId: string;
    priceId: string;
  }) => (
    <button
      type="button"
      data-checkout-plan={planId}
      data-checkout-price={priceId}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/config/price-config', () => ({
  getPricePlans: () => ({
    free: {
      id: 'free',
      name: 'Free',
      description: 'Free plan',
      features: ['One request'],
      prices: [],
      isFree: true,
      isLifetime: false,
    },
    hobby: {
      id: 'hobby',
      name: 'Hobby',
      description: 'For individuals',
      features: [
        '100 AI requests',
        'AI generation and editing',
        'Unlimited storage',
        'Text and image input',
        'Email support',
      ],
      prices: [
        {
          type: PaymentTypes.SUBSCRIPTION,
          priceId: 'hobby-month',
          amount: 800,
          currency: 'USD',
          interval: PlanIntervals.MONTH,
        },
        {
          type: PaymentTypes.SUBSCRIPTION,
          priceId: 'hobby-year',
          amount: 6000,
          currency: 'USD',
          interval: PlanIntervals.YEAR,
        },
      ],
      isFree: false,
      isLifetime: false,
    },
    professional: {
      id: 'professional',
      name: 'Professional',
      description: 'For professionals',
      features: [
        'Unlimited AI requests',
        'Priority AI processing',
        'Unlimited storage',
        'Real-time AI editing',
        'Technical support',
        'Text and image input',
        'Content ownership',
      ],
      prices: [
        {
          type: PaymentTypes.SUBSCRIPTION,
          priceId: 'professional-month',
          amount: 1200,
          currency: 'USD',
          interval: PlanIntervals.MONTH,
        },
        {
          type: PaymentTypes.SUBSCRIPTION,
          priceId: 'professional-year',
          amount: 9600,
          currency: 'USD',
          interval: PlanIntervals.YEAR,
        },
      ],
      isFree: false,
      isLifetime: false,
      recommended: true,
    },
  }),
}));

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'user-1' }),
}));

vi.mock('@/hooks/use-payment', () => ({
  usePayment: () => ({
    currentPlan: mocks.currentPlanId ? { id: mocks.currentPlanId } : null,
    isLoading: mocks.isLoading,
  }),
}));

vi.mock('@/i18n/navigation', () => ({
  useLocalePathname: () => '/flowchart',
}));

vi.mock('@/lib/formatter', () => ({
  formatPrice: (amount: number) => `$${Math.round(amount / 100)}`,
}));

vi.mock('@/payment/types', () => ({
  PaymentTypes: { SUBSCRIPTION: 'subscription' },
  PlanIntervals: { MONTH: 'month', YEAR: 'year' },
}));

import { PaymentTypes, PlanIntervals } from '@/payment/types';
import { PricingModal, getPlanPriceDisplay } from './pricing-modal';

describe('PricingModal', () => {
  beforeEach(() => {
    mocks.currentPlanId = 'free';
    mocks.isLoading = false;
  });

  it('shows both paid plans without a free plan or selector copy', () => {
    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).toContain('Hobby');
    expect(markup).toContain('Professional');
    expect(markup).not.toContain('>Free<');
    expect(markup).toContain('Recommended');
    expect(markup.match(/Recommended/g)).toHaveLength(1);
    expect(markup).toMatch(
      /data-plan-id="professional"[^>]*data-recommended="true"/
    );
    expect(markup).not.toMatch(
      /data-plan-id="hobby"[^>]*data-recommended="true"/
    );
    expect(markup).not.toContain('Best value');
    expect(markup).not.toContain('Most Popular');
  });

  it('defaults to yearly and uses the configured yearly equivalents', () => {
    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).toMatch(/aria-pressed="false"[^>]*>Monthly<\/button>/);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Yearly/);
    expect(markup).toContain('Save up to 40%');
    expect(markup).toContain('text-xs font-semibold text-primary');
    expect(markup).not.toContain('Save 20%');
    expect(markup).toContain('$60 billed yearly');
    expect(markup).toContain('$96 billed yearly');
    expect(markup).toContain('data-checkout-price="hobby-year"');
    expect(markup).toContain('data-checkout-price="professional-year"');
    expect(
      getPlanPriceDisplay(
        {
          id: 'hobby',
          prices: [
            {
              type: PaymentTypes.SUBSCRIPTION,
              priceId: 'hobby-year',
              amount: 6000,
              currency: 'USD',
              interval: PlanIntervals.YEAR,
            },
          ],
          isFree: false,
          isLifetime: false,
        },
        PlanIntervals.YEAR
      )
    ).toEqual({
      main: '$5',
      period: '/month',
      billingNote: '$60 billed yearly',
    });
  });

  it('disables the real current plan and never renders its checkout control', () => {
    mocks.currentPlanId = 'hobby';

    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).toContain('Current plan');
    expect(markup).not.toContain('data-checkout-plan="hobby"');
    expect(markup).toContain('data-checkout-plan="professional"');
  });

  it('allows checkout when the signed-in user has no active paid plan', () => {
    mocks.currentPlanId = null;

    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).not.toContain('Checking current plan…');
    expect(markup).toContain('data-checkout-plan="hobby"');
    expect(markup).toContain('data-checkout-plan="professional"');
  });

  it('keeps each decision card compact with three core benefits', () => {
    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).toContain('100 AI requests');
    expect(markup).toContain('AI generation and editing');
    expect(markup).toContain('Text and image input');
    expect(markup).toContain('Unlimited AI requests');
    expect(markup).toContain('Priority AI processing');
    expect(markup).toContain('Real-time AI editing');

    expect(markup).not.toContain('Unlimited storage');
    expect(markup).not.toContain('Email support');
    expect(markup).not.toContain('Technical support');
    expect(markup).not.toContain('Content ownership');
  });

  it('defaults the mobile plan selector to the recommended plan', () => {
    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).toMatch(
      /data-mobile-plan-selector[^>]*>[\s\S]*data-plan-select="professional"[^>]*aria-pressed="true"/
    );
    expect(markup).toMatch(/data-plan-select="hobby"[^>]*aria-pressed="false"/);
  });

  it('does not make the pricing dialog an inner scrolling region', () => {
    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).not.toContain('overflow-y-auto');
    expect(markup).not.toContain('max-h-[calc(100vh-2rem)]');
  });
});
