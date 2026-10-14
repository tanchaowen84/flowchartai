import { describe, expect, it } from 'vitest';
import { getWaffoConfirmedCheckout } from './payment-conversion';

describe('Waffo payment attribution', () => {
  const event = {
    eventType: 'order.completed',
    mode: 'prod',
    data: {
      orderId: 'ORD_paid',
      paymentStatus: 'succeeded',
      chargedAmount: '10.00',
      orderMetadata: {
        userId: 'internal-user',
        plausible_context: 'sealed',
      },
    },
  };

  it('recognizes a live paid pack and the first paid subscription period', () => {
    expect(getWaffoConfirmedCheckout(event)).toEqual({
      orderId: 'ORD_paid',
      userId: 'internal-user',
      context: 'sealed',
    });
    expect(
      getWaffoConfirmedCheckout({
        ...event,
        eventType: 'subscription.payment_succeeded',
        data: { ...event.data, periodNumber: 1 },
      })
    ).not.toBeNull();
  });

  it('excludes sandbox, renewals, activation, plan changes and unconfirmed charges', () => {
    for (const changed of [
      { mode: 'test' },
      { eventType: 'subscription.activated' },
      { eventType: 'subscription.renewed' },
      {
        eventType: 'subscription.payment_succeeded',
        data: { ...event.data, periodNumber: 2 },
      },
      { data: { ...event.data, paymentStatus: 'failed' } },
      { data: { ...event.data, chargedAmount: '0.00' } },
      { data: { ...event.data, chargedAmount: undefined } },
      { data: { ...event.data, orderMetadata: {} } },
      {
        data: {
          ...event.data,
          orderMetadata: { ...event.data.orderMetadata, originOrderId: 'old' },
        },
      },
    ]) {
      expect(getWaffoConfirmedCheckout({ ...event, ...changed })).toBeNull();
    }
  });
});
