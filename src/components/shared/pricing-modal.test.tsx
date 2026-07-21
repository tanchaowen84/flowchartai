// biome-ignore lint/style/useImportType: Vitest's JSX transform requires React at runtime.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentPlanId: 'free',
  isLoading: false,
}));

vi.mock('@/components/auth/login-wrapper', () => ({
  LoginWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/pricing/create-checkout-button', () => ({
  CheckoutButton: ({
    children,
    planId,
  }: {
    children: React.ReactNode;
    planId: string;
  }) => (
    <button type="button" data-checkout-plan={planId}>
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
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
      features: ['100 AI requests'],
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
      recommended: true,
    },
    professional: {
      id: 'professional',
      name: 'Professional',
      description: 'For professionals',
      features: ['Unlimited AI requests'],
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
    expect(markup).toContain('Best value');
    expect(markup).not.toContain('Most Popular');
  });

  it('uses the exact annual saving label and configured yearly equivalents', () => {
    const markup = renderToStaticMarkup(
      <PricingModal isOpen onClose={() => undefined} />
    );

    expect(markup).toContain('Save up to 40%');
    expect(markup).not.toContain('Save 20%');
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
});
