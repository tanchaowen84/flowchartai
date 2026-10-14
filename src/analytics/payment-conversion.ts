/**
 * [INPUT] Creem/Waffo payment payload after signature verification and DB commit.
 * [OUTPUT] Positive live initial-purchase evidence; trials/renewals rejected.
 * [POS] Pure payment goal gate; money/entitlement behavior is unchanged.
 * [UPDATE] Sync provider hook and payment-conversion tests after changes.
 */
export interface ConfirmedCheckout {
  orderId: string;
  userId: string;
  context: string;
}

export function getConfirmedCheckout(event: {
  eventType: string;
  mode?: string;
  object: any;
}): ConfirmedCheckout | null {
  const checkout = event.object;
  const order = checkout?.order;
  const metadata = checkout?.metadata;
  if (
    event.eventType !== 'checkout.completed' ||
    checkout?.status !== 'completed' ||
    order?.status !== 'paid' ||
    !Number.isInteger(order.amount) ||
    order.amount <= 0 ||
    !/^[A-Z]{3}$/i.test(order.currency ?? '') ||
    typeof order.id !== 'string' ||
    !order.id ||
    typeof metadata?.user_id !== 'string' ||
    !metadata.user_id ||
    typeof metadata?.plausible_context !== 'string' ||
    !metadata.plausible_context ||
    ![event.mode, checkout.mode, order.mode].some(
      (mode) => mode === 'prod' || mode === 'live'
    ) ||
    [event.mode, checkout.mode, order.mode].some(
      (mode) => mode && mode !== 'prod' && mode !== 'live'
    )
  )
    return null;
  return {
    orderId: order.id,
    userId: metadata.user_id,
    context: metadata.plausible_context,
  };
}

export function getWaffoConfirmedCheckout(event: {
  eventType: string;
  mode: string;
  data: any;
}): ConfirmedCheckout | null {
  const data = event.data;
  const metadata = data?.orderMetadata;
  const initialPayment =
    event.eventType === 'order.completed' ||
    (event.eventType === 'subscription.payment_succeeded' &&
      data?.periodNumber === 1);
  if (
    event.mode !== 'prod' ||
    !initialPayment ||
    data?.paymentStatus !== 'succeeded' ||
    !Number.isFinite(Number(data?.chargedAmount)) ||
    Number(data.chargedAmount) <= 0 ||
    typeof data.orderId !== 'string' ||
    !data.orderId ||
    typeof metadata?.userId !== 'string' ||
    !metadata.userId ||
    typeof metadata?.plausible_context !== 'string' ||
    !metadata.plausible_context ||
    metadata.originOrderId
  )
    return null;
  return {
    orderId: data.orderId,
    userId: metadata.userId,
    context: metadata.plausible_context,
  };
}
