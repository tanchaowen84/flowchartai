import { describe, expect, it } from 'vitest';
import { offerCallback, selectedAuthOffer } from './auth-offer';
describe('authenticated offer continuation', () => {
  it('retains source query and exact selected interval/offer', () => {
    expect(
      offerCallback('/pricing', 'utm_source=docs', 'pro_year_202610')
    ).toBe('/pricing?utm_source=docs&offer=pro_year_202610#selected-plan');
  });
  it('accepts only currently sellable offers', () => {
    expect(selectedAuthOffer('pro_year_202610')).toBe('pro_year_202610');
    expect(selectedAuthOffer('starter_year')).toBeNull();
    expect(selectedAuthOffer('javascript:alert(1)')).toBeNull();
  });
});
