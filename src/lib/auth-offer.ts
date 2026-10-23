/** [INPUT] Current page and finite offer key. [OUTPUT] Auth continuation to an explicit plan choice. [POS] Pricing/auth boundary. */
import { type OfferKey, isSellableOffer } from './billing/policy';
export function selectedAuthOffer(value: unknown): OfferKey | null {
  return isSellableOffer(value) ? value : null;
}
export function offerCallback(
  path: string,
  query: string,
  offer: OfferKey
): string {
  const params = new URLSearchParams(query);
  params.set('offer', offer);
  return `${path}?${params.toString()}#selected-plan`;
}
