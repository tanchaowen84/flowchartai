import { describe, expect, it } from 'vitest';
import {
  creemInsightsFact,
  decimalMicros,
  waffoInsightsFact,
} from './insights-payment';
describe('verified payment receipt normalization', () => {
  const e = {
    id: 'receipt',
    eventId: 'refund-business',
    timestamp: '2026-10-01T23:59:00Z',
    mode: 'prod',
    eventType: 'order.completed',
    data: {
      paymentId: 'p1',
      paymentStatus: 'succeeded',
      currency: 'USD',
      chargedAmount: '19.99',
      listPrice: { total: '19.99', taxAmount: '1.99' },
    },
  };
  it('keeps decimal money exact and rejects malformed values', () => {
    expect(decimalMicros('19.99')).toBe(19990000);
    expect(decimalMicros('0.000001')).toBe(1);
    expect(decimalMicros('0')).toBe(0);
    for (const v of ['-1', '1e3', '2.1234567', 'NaN'])
      expect(decimalMicros(v)).toBeNull();
  });
  it('records verified amount, currency and matching tax snapshot', () => {
    expect(waffoInsightsFact(e)).toMatchObject({
      amount_micros: 19990000,
      tax_micros: 1990000,
      tax_complete: true,
      transaction_id: 'p1',
    });
    expect(
      waffoInsightsFact({ ...e, eventType: 'subscription.payment_succeeded' })
    ).not.toBeNull();
  });
  it('never substitutes catalogue price for an absent actual charge', () => {
    expect(
      waffoInsightsFact({ ...e, data: { ...e.data, chargedAmount: undefined } })
    ).toBeNull();
    expect(waffoInsightsFact({ ...e, mode: 'test' })).toBeNull();
    expect(
      waffoInsightsFact({ ...e, data: { ...e.data, paymentStatus: 'failed' } })
    ).toBeNull();
  });
  it('marks tax unknown for prorated charges and subtracts original tax only on matching full refunds', () => {
    expect(
      waffoInsightsFact({ ...e, data: { ...e.data, chargedAmount: '10.00' } })
    ).toMatchObject({ tax_complete: false });
    expect(
      waffoInsightsFact({
        ...e,
        eventType: 'refund.succeeded',
        data: {
          ...e.data,
          refundedAmount: '19.99',
          originalPayment: { total: '19.99', taxAmount: '1.99' },
        },
      })
    ).toMatchObject({
      name: 'refund_succeeded',
      amount_micros: 18000000,
      refund_id: 'refund-business',
      tax_complete: true,
    });
  });
  it('uses a paid Creem order, never a subscription activation or test checkout', () => {
    const c = {
      eventType: 'checkout.completed',
      mode: 'prod',
      object: {
        status: 'completed',
        metadata: { user_id: 'user1' },
        order: {
          id: 'order1',
          status: 'paid',
          currency: 'USD',
          amount: 999,
          mode: 'prod',
        },
      },
    };
    expect(creemInsightsFact(c)).toMatchObject({
      amount_micros: 9990000,
      user_id: 'user1',
    });
    expect(
      creemInsightsFact({ ...c, eventType: 'subscription.active' })
    ).toBeNull();
    expect(creemInsightsFact({ ...c, mode: 'test' })).toBeNull();
  });
});
