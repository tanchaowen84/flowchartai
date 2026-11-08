import { describe, expect, it } from 'vitest';
import { OFFERS, SELLABLE_OFFERS } from './policy';
import {
  CREDITS_PER_TYPICAL_DIAGRAM,
  CREDIT_VIEWS,
  DEFAULT_CREDIT_OFFER,
  DEFAULT_CREDIT_VIEW,
  approxDiagrams,
  checkoutCta,
  estimateDiagrams,
  offersForView,
  paywallHeader,
} from './presentation';

describe('paywall default selection', () => {
  it('opens on One-time with the $10 pack, One-time tab first', () => {
    expect(CREDIT_VIEWS).toEqual(['once', 'monthly', 'yearly']);
    expect(DEFAULT_CREDIT_VIEW).toBe('once');
    expect(DEFAULT_CREDIT_OFFER).toBe('pack_small');
    expect(offersForView(DEFAULT_CREDIT_VIEW)[0]).toBe(DEFAULT_CREDIT_OFFER);
    expect(OFFERS[DEFAULT_CREDIT_OFFER]).toMatchObject({
      kind: 'pack',
      amount: 1000,
      credits: 1500,
    });
  });

  it('only shows sellable offers in each tab', () => {
    for (const view of CREDIT_VIEWS)
      for (const key of offersForView(view))
        expect(SELLABLE_OFFERS).toContain(key);
  });
});

describe('diagram estimate', () => {
  it('uses one conservative constant and rounds down', () => {
    expect(CREDITS_PER_TYPICAL_DIAGRAM).toBe(25);
    expect(estimateDiagrams(1500)).toBe(60);
    expect(estimateDiagrams(2000)).toBe(80);
    expect(estimateDiagrams(5000)).toBe(200);
    expect(estimateDiagrams(6000)).toBe(240);
    expect(estimateDiagrams(2690)).toBe(100); // 107 → 100
    expect(estimateDiagrams(49)).toBe(1);
    expect(estimateDiagrams(24)).toBe(0);
    expect(estimateDiagrams(-5)).toBe(0);
  });

  it('never promises more diagrams than credits / constant', () => {
    for (const key of SELLABLE_OFFERS)
      expect(estimateDiagrams(OFFERS[key].credits)).toBeLessThanOrEqual(
        OFFERS[key].credits / CREDITS_PER_TYPICAL_DIAGRAM
      );
  });

  it('labels card estimates, singular for one', () => {
    expect(approxDiagrams(25)).toBe('≈ 1 diagram');
    expect(approxDiagrams(1500)).toBe('≈ 60 diagrams');
    expect(approxDiagrams(6000)).toBe('≈ 240 diagrams');
  });

  it('puts diagrams first and the exact charge in the CTA', () => {
    expect(checkoutCta('pack_small')).toBe(
      'Get ~60 diagrams & continue — $10 once'
    );
    expect(checkoutCta('pack_large')).toBe(
      'Get ~200 diagrams & continue — $30 once'
    );
    expect(checkoutCta('starter_month')).toBe(
      'Get ~80 diagrams/month & continue — $9/month'
    );
    expect(checkoutCta('pro_year_202610')).toBe(
      'Get ~240 diagrams/month & continue — $180/year'
    );
  });
});

describe('paywall header', () => {
  it('keeps the manual-open header generic', () => {
    expect(paywallHeader({ balance: 0 })).toEqual({
      title: 'Keep creating with AI',
      reason: 'Choose credits for your next flowchart.',
    });
  });

  it('explains a blocked request and what is kept', () => {
    const header = paywallHeader({ hasPendingRequest: true, balance: 0 });
    expect(header.reason).toBe("You've used all your credits.");
    expect(header.reassurance).toContain('prompt and diagram are kept');
    expect(header.reassurance).toContain(
      'Manual editing and downloads stay free'
    );
  });

  it('never says the credits are used when some remain', () => {
    for (const balance of [1, 12, 1500, undefined, Number.NaN]) {
      const header = paywallHeader({ hasPendingRequest: true, balance });
      expect(`${header.title} ${header.reason}`).not.toMatch(/used/i);
      expect(header.reassurance).toBeDefined();
    }
    expect(paywallHeader({ hasPendingRequest: true, balance: 12 }).reason).toBe(
      'This request needs more than your 12 remaining credits.'
    );
  });
});
