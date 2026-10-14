import { describe, expect, it } from 'vitest';
import { openCheckoutContext, sealCheckoutContext } from './checkout-context';
import { getConfirmedCheckout } from './payment-conversion';

describe('confirmed checkout payments', () => {
  const event = {
    eventType: 'checkout.completed',
    object: {
      status: 'completed',
      mode: 'prod',
      order: {
        id: 'ord_paid',
        status: 'paid',
        amount: 900,
        currency: 'USD',
        mode: 'prod',
      },
      metadata: { user_id: 'internal-user', plausible_context: 'sealed' },
    },
  };
  it('requires completed live checkout and positive paid order evidence', () => {
    expect(getConfirmedCheckout(event)?.orderId).toBe('ord_paid');
    for (const status of ['pending', 'failed']) {
      expect(
        getConfirmedCheckout({
          ...event,
          object: { ...event.object, order: { ...event.object.order, status } },
        })
      ).toBeNull();
    }
    expect(
      getConfirmedCheckout({
        ...event,
        object: {
          ...event.object,
          order: { ...event.object.order, amount: 0 },
        },
      })
    ).toBeNull();
    expect(
      getConfirmedCheckout({
        ...event,
        object: { ...event.object, mode: 'test' },
      })
    ).toBeNull();
    expect(
      getConfirmedCheckout({ ...event, eventType: 'subscription.active' })
    ).toBeNull();
    expect(
      getConfirmedCheckout({ ...event, eventType: 'subscription.trialing' })
    ).toBeNull();
    expect(
      getConfirmedCheckout({ ...event, eventType: 'subscription.paid' })
    ).toBeNull();
  });

  it('encrypts browser context so raw headers are not persisted in provider metadata', () => {
    const headers = new Headers({
      'user-agent': 'Private browser context',
      'x-forwarded-for': '203.0.113.4',
    });
    const token = sealCheckoutContext(headers, 'test-secret', 1000)!;
    expect(token).not.toContain('Private');
    expect(token).not.toContain('203.0.113.4');
    const context = openCheckoutContext(token, 'test-secret', 1100);
    expect(context?.get('user-agent')).toBe('Private browser context');
    expect(context?.get('x-forwarded-for')).toBe('203.0.113.4');
    expect(openCheckoutContext(token, 'wrong-secret', 1100)).toBeNull();
    expect(
      openCheckoutContext(token.slice(0, -6) + 'broken', 'test-secret', 1100)
    ).toBeNull();
    expect(
      openCheckoutContext(token, 'test-secret', 1000 + 8 * 86400000)
    ).toBeNull();
    expect(sealCheckoutContext(new Headers(), 'test-secret')).toBeNull();
  });
});
