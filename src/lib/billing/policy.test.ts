import { describe, expect, it } from 'vitest';
import {
  OFFERS,
  creditsForCalls,
  currentCreditMonth,
  legacyPlanForPayment,
  subscriptionCreditWindow,
} from './policy';
describe('billing policy', () => {
  it('sums all model steps, separates cache, rounds only once', () => {
    expect(
      creditsForCalls([
        {
          model: 'deepseek/deepseek-v4-pro',
          input: 14035,
          cached: 8192,
          output: 2413,
        },
      ])
    ).toBe(23);
    expect(
      creditsForCalls([
        { model: 'deepseek/deepseek-v4-pro', input: 1, cached: 0, output: 0 },
        { model: 'deepseek/deepseek-v4-pro', input: 1, cached: 0, output: 0 },
      ])
    ).toBe(1);
    expect(creditsForCalls([])).toBe(0);
  });
  it('does not charge server-marked platform repairs', () => {
    expect(
      creditsForCalls([
        {
          model: 'deepseek/deepseek-v4-pro',
          input: 2000,
          cached: 0,
          output: 500,
          platformFunded: true,
        },
      ])
    ).toBe(0);
  });
  it('rejects unknown models and invalid usage instead of silently billing', () => {
    expect(() =>
      creditsForCalls([{ model: 'unknown', input: 1, cached: 0, output: 1 }])
    ).toThrow();
    expect(() =>
      creditsForCalls([
        { model: 'deepseek/deepseek-v4-pro', input: 2, cached: 3, output: 1 },
      ])
    ).toThrow();
  });
  it('uses original anniversary and clamps month end without drift', () => {
    const a = new Date('2024-01-31T12:00:00Z');
    const e = new Date('2025-01-31T12:00:00Z');
    expect(
      currentCreditMonth(
        a,
        e,
        new Date('2024-02-29T12:00:00Z')
      )?.start.toISOString()
    ).toBe('2024-02-29T12:00:00.000Z');
    expect(
      currentCreditMonth(
        a,
        e,
        new Date('2024-03-30T12:00:00Z')
      )?.end.toISOString()
    ).toBe('2024-03-31T12:00:00.000Z');
    expect(currentCreditMonth(a, e, e)).toBeNull();
  });
  it('keeps frozen legacy benefits regardless of new provider/offer configuration', () => {
    expect(
      legacyPlanForPayment({
        provider: 'creem',
        legacyPlan: 'professional',
        priceId: 'retired_product',
      })
    ).toBe('professional');
    expect(
      legacyPlanForPayment({
        provider: 'waffo',
        legacyPlan: null,
        priceId: 'pro_month',
      })
    ).toBeNull();
  });
  it('keeps approved package value and annual monthly allowance', () => {
    expect(OFFERS.pro_year).toMatchObject({
      amount: 19000,
      credits: 6000,
      interval: 'year',
    });
    expect(OFFERS.pack_large).toMatchObject({
      amount: 3000,
      credits: 5000,
      kind: 'pack',
    });
  });
  it('does not subdivide a paid monthly cycle at a short-month anniversary', () => {
    expect(
      subscriptionCreditWindow(
        'pro_month',
        new Date('2025-02-28T00:00:00Z'),
        new Date('2025-03-31T00:00:00Z'),
        new Date('2025-03-30T00:00:00Z')
      )?.start.toISOString()
    ).toBe('2025-02-28T00:00:00.000Z');
  });
});
