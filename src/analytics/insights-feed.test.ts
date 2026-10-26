import { describe, expect, it } from 'vitest';
import { normalizeInsightsRecord } from './insights-feed';
import { waffoInsightsFact } from './insights-payment';
describe('server feed review regressions', () => {
  it('uses a stable refund fact across deliveries and distinguishes different refunds', () => {
    const base = {
      id: 'delivery1',
      eventId: 'business1',
      mode: 'prod',
      eventType: 'refund.succeeded',
      data: {
        paymentId: 'payment',
        refundedAmount: '20.00',
        currency: 'USD',
        refundTicketMerchantExternalId: 'ticket1',
      },
    };
    expect(waffoInsightsFact(base)?.refund_id).toBe(
      waffoInsightsFact({ ...base, id: 'delivery2' })?.refund_id
    );
    expect(
      waffoInsightsFact({
        ...base,
        data: { ...base.data, refundTicketMerchantExternalId: 'ticket2' },
      })?.refund_id
    ).not.toBe(waffoInsightsFact(base)?.refund_id);
    expect(
      waffoInsightsFact({
        ...base,
        eventId: undefined,
        data: { ...base.data, refundTicketMerchantExternalId: undefined },
      })
    ).toBeNull();
  });
  it('applies trusted QA classification to every business branch and does not trust browser qa', () => {
    for (const name of [
      'signup_completed',
      'identify',
      'task_started',
      'cost_recorded',
      'payment_succeeded',
      'refund_succeeded',
      'result_delivered',
    ]) {
      const record = {
        at: '2026-10-03T00:00:00Z',
        event: { name, user_id: 'qa-user', properties: {} },
      };
      expect(normalizeInsightsRecord(record, new Set(['qa-user'])).qa).toBe(
        true
      );
      expect(
        normalizeInsightsRecord(
          { ...record, event: { ...record.event, qa: true } },
          new Set()
        ).qa
      ).toBe(false);
    }
  });
  it('keeps signed business occurrence time separate from delayed ingestion cursor time', () => {
    const at = '2026-10-09T01:00:00Z';
    const occurred_at = '2026-10-01T23:59:00Z';
    const fact = waffoInsightsFact({
      id: 'delivery',
      eventId: 'business',
      timestamp: occurred_at,
      mode: 'prod',
      eventType: 'order.completed',
      data: {
        paymentId: 'p',
        paymentStatus: 'succeeded',
        chargedAmount: '1.00',
        currency: 'USD',
      },
    })!;
    const e = normalizeInsightsRecord({
      at,
      event: {
        event_id: 'e',
        name: fact.name,
        user_id: 'u',
        occurred_at: fact.occurred_at,
        properties: {},
      },
    });
    expect(e.occurred_at).toBe('2026-10-01T23:59:00.000Z');
    expect((e.properties as any).time_basis).toBe('provider');
    const legacy = normalizeInsightsRecord({
      at,
      event: { name: 'payment_succeeded', user_id: 'u', properties: {} },
    });
    expect((legacy.properties as any).time_basis).toBe('receipt');
  });
});
