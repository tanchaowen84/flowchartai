import { type DrawioDocument, EMPTY_DRAWIO_XML } from '@/lib/drawio/contracts';
import { describe, expect, it } from 'vitest';
import {
  type PendingCreditRequest,
  canResumeCreditRequest,
} from './pending-credit-request';
import { OFFERS, isSellableOffer } from './policy';
import { creditPrice, offersForView } from './presentation';
describe('approved purchase presentation and continuation', () => {
  it('shows integer annual equivalents with the actual yearly bill and preserves sold prices', () => {
    expect(creditPrice('starter_year_202610')).toMatchObject({
      main: 7,
      billed: 'Billed $84 yearly',
      savings: 24,
      credits: 2000,
    });
    expect(creditPrice('pro_year_202610')).toMatchObject({
      main: 15,
      billed: 'Billed $180 yearly',
      savings: 48,
      credits: 6000,
    });
    expect(OFFERS.starter_year.amount).toBe(9000);
    expect(OFFERS.pro_year.amount).toBe(19000);
    expect(isSellableOffer('starter_year')).toBe(false);
    expect(isSellableOffer('pro_year_202610')).toBe(true);
    expect(offersForView('yearly')).toHaveLength(2);
    expect(offersForView('once')).toEqual(['pack_small', 'pack_large']);
  });
  const document: DrawioDocument = {
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'doc',
    revision: 1,
    diagramType: 'flowchart',
    xml: EMPTY_DRAWIO_XML,
  };
  const pending: PendingCreditRequest = {
    userId: 'owner',
    documentId: 'doc',
    fingerprint: EMPTY_DRAWIO_XML,
    requestBody: {
      billingTaskId: 'stable-id',
      messages: [{ role: 'user', content: 'existing request' }],
    },
    path: '/canvas/doc',
    createdAt: 100,
  };
  it('only resumes the same owner, unchanged diagram, fresh and unclaimed operation', () => {
    expect(canResumeCreditRequest(pending, 'owner', document, 200)).toBe(true);
    expect(canResumeCreditRequest(pending, 'other', document, 200)).toBe(false);
    expect(
      canResumeCreditRequest(
        pending,
        'owner',
        { ...document, documentId: 'new' },
        200
      )
    ).toBe(false);
    expect(
      canResumeCreditRequest(
        pending,
        'owner',
        {
          ...document,
          xml: EMPTY_DRAWIO_XML.replace(
            'parent="0"',
            'parent="0" value="edited"'
          ),
        },
        200
      )
    ).toBe(false);
    expect(
      canResumeCreditRequest(
        { ...pending, resumeStartedAt: 150 },
        'owner',
        document,
        200
      )
    ).toBe(false);
    expect(canResumeCreditRequest(pending, 'owner', document, 86400200)).toBe(
      false
    );
  });
});
