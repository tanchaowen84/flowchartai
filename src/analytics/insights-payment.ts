/** Store only signed provider facts inside the existing billing transaction.
 * A missing amount/currency is unknown; never infer a paid price from a plan.
 */
export interface InsightsPaymentFact {
  name: 'payment_succeeded' | 'refund_succeeded';
  user_id?: string;
  provider: string;
  transaction_id: string;
  refund_id?: string;
  currency: string;
  amount_micros: number;
  tax_micros?: number;
  tax_complete?: boolean;
}
export function decimalMicros(value: unknown): number | null {
  const text = String(value ?? '');
  if (!/^\d+(\.\d{1,6})?$/.test(text)) return null;
  const [a, b = ''] = text.split('.');
  const result = Number(a) * 1e6 + Number(b.padEnd(6, '0'));
  return Number.isSafeInteger(result) && result >= 0 && result <= 1e12
    ? result
    : null;
}
export function waffoInsightsFact(event: {
  eventType: string;
  mode: string;
  id: string;
  data: any;
}): InsightsPaymentFact | null {
  const d = event.data;
  if (event.mode !== 'prod') return null;
  const refund = event.eventType === 'refund.succeeded';
  if (
    !refund &&
    !['order.completed', 'subscription.payment_succeeded'].includes(
      event.eventType
    )
  )
    return null;
  if (!refund && d.paymentStatus !== 'succeeded') return null;
  const amount = decimalMicros(refund ? d.refundedAmount : d.chargedAmount);
  const currency =
    typeof d.currency === 'string' ? d.currency.toUpperCase() : '';
  if (
    amount === null ||
    amount <= 0 ||
    !/^[A-Z]{3}$/.test(currency) ||
    typeof d.paymentId !== 'string' ||
    !d.paymentId
  )
    return null;
  const tax = decimalMicros(
    refund ? d.originalPayment?.taxAmount : d.listPrice?.taxAmount
  );
  const total = decimalMicros(
    refund ? d.originalPayment?.total : d.listPrice?.total
  );
  const taxKnown = tax !== null && total === amount && tax <= amount;
  return {
    name: refund ? 'refund_succeeded' : 'payment_succeeded',
    provider: 'waffo',
    transaction_id: d.paymentId,
    ...(refund
      ? { refund_id: typeof d.refundId === 'string' ? d.refundId : event.id }
      : {}),
    currency,
    amount_micros: refund && taxKnown ? amount - tax! : amount,
    ...(!refund && taxKnown ? { tax_micros: tax! } : {}),
    tax_complete: taxKnown,
  };
}
export function creemInsightsFact(event: {
  eventType: string;
  mode?: string;
  object: any;
}): InsightsPaymentFact | null {
  if (event.eventType !== 'checkout.completed') return null;
  const checkout = event.object;
  const order = checkout?.order;
  const modes = [event.mode, checkout?.mode, order?.mode].filter(Boolean);
  if (
    !modes.length ||
    modes.some((m) => !['prod', 'live'].includes(m)) ||
    checkout?.status !== 'completed' ||
    order?.status !== 'paid'
  )
    return null;
  const currency =
    typeof order.currency === 'string' ? order.currency.toUpperCase() : '';
  if (
    !/^[A-Z]{3}$/.test(currency) ||
    !Number.isSafeInteger(order.amount) ||
    order.amount <= 0 ||
    typeof order.id !== 'string' ||
    !checkout.metadata?.user_id
  )
    return null;
  const fraction =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const amount = order.amount * 10 ** (6 - fraction);
  if (!Number.isSafeInteger(amount) || amount > 1e12) return null;
  return {
    name: 'payment_succeeded',
    provider: 'creem',
    user_id: checkout.metadata.user_id,
    transaction_id: order.id,
    currency,
    amount_micros: amount,
    tax_complete: false,
  };
}
