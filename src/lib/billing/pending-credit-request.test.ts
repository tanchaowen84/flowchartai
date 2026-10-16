import { EMPTY_DRAWIO_XML } from '@/lib/drawio/contracts';
import { nativeContentFingerprint } from '@/lib/drawio/native-document';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type PendingCreditRequest,
  canResumeCreditRequest,
  reconcilePendingCreditRequest,
} from './pending-credit-request';

const document = {
  editorKind: 'drawio' as const,
  formatVersion: 1 as const,
  documentId: 'retained-diagram',
  revision: 1,
  diagramType: 'flowchart',
  xml: EMPTY_DRAWIO_XML,
};
function interruptedRequest(): PendingCreditRequest {
  return {
    userId: 'owner',
    documentId: document.documentId,
    fingerprint: nativeContentFingerprint(document.xml),
    path: '/canvas/retained-diagram',
    createdAt: Date.now(),
    checkoutId: 'fulfilled-checkout',
    resumeStartedAt: Date.now(),
    requestBody: {
      billingTaskId: 'original-request-id',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Preserve this exact request' },
            { type: 'image', image: 'data:image/png;base64,retained' },
          ],
        },
      ],
      aiContext: { nativeDocument: document },
    },
  };
}
describe('paid continuation interruption and reload recovery', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('queries the owned task without cache before unlocking a missing request', async () => {
    const stored = interruptedRequest();
    const fetchTask = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchTask);
    expect((await reconcilePendingCreditRequest(stored)).kind).toBe('retry');
    expect(fetchTask).toHaveBeenCalledWith(
      '/api/billing/task?id=original-request-id',
      { cache: 'no-store' }
    );
  });
  it('keeps the claim when a successful HTTP response has an unreadable task', async () => {
    const stored = interruptedRequest();
    vi.stubGlobal('fetch', async () => new Response('invalid json'));
    expect(await reconcilePendingCreditRequest(stored)).toEqual({
      kind: 'restore',
      pending: stored,
    });
  });
  it('releases a missing task claim while preserving the exact request and ID', async () => {
    const stored = interruptedRequest();
    const lookup = vi.fn(async () => ({ status: 404 }));
    const newId = vi.fn(() => 'unused-new-id');
    const result = await reconcilePendingCreditRequest(stored, lookup, newId);
    expect(lookup).toHaveBeenCalledWith(stored.requestBody.billingTaskId);
    expect(result.kind).toBe('retry');
    expect(result.pending.requestBody).toEqual(stored.requestBody);
    expect(result.pending).toMatchObject({
      userId: stored.userId,
      documentId: stored.documentId,
      fingerprint: stored.fingerprint,
      createdAt: stored.createdAt,
      path: stored.path,
      retryReady: true,
    });
    expect(result.pending.resumeStartedAt).toBeUndefined();
    expect(result.pending.checkoutId).toBeUndefined();
    expect(canResumeCreditRequest(result.pending, 'owner', document)).toBe(
      true
    );
    expect(newId).not.toHaveBeenCalled();
    expect(stored.resumeStartedAt).toBeDefined();
  });
  it('rotates only the task ID after a released server task', async () => {
    const stored = interruptedRequest();
    const result = await reconcilePendingCreditRequest(
      stored,
      async () => ({
        status: 200,
        task: { id: stored.requestBody.billingTaskId, state: 'released' },
      }),
      () => 'fresh-retry-task-id'
    );
    expect(result.kind).toBe('retry');
    expect(result.pending.requestBody).toEqual({
      ...stored.requestBody,
      billingTaskId: 'fresh-retry-task-id',
    });
    expect(result.pending.resumeStartedAt).toBeUndefined();
    expect(stored.requestBody.billingTaskId).toBe('original-request-id');
  });
  it.each(['running', 'ready', 'committed'])(
    'retains the claim for a %s task instead of starting another request',
    async (state) => {
      const stored = interruptedRequest();
      const result = await reconcilePendingCreditRequest(stored, async () => ({
        status: 200,
        task: { id: stored.requestBody.billingTaskId, state },
      }));
      expect(result).toEqual({ kind: 'restore', pending: stored });
      expect(canResumeCreditRequest(result.pending, 'owner', document)).toBe(
        false
      );
    }
  );
  it.each([401, 403, 500, 503])(
    'keeps the claim after HTTP %s',
    async (status) => {
      const stored = interruptedRequest();
      expect(
        await reconcilePendingCreditRequest(stored, async () => ({ status }))
      ).toEqual({ kind: 'restore', pending: stored });
    }
  );
  it('keeps the claim when the status lookup also loses the network', async () => {
    const stored = interruptedRequest();
    expect(
      await reconcilePendingCreditRequest(stored, async () => {
        throw new TypeError('Failed to fetch');
      })
    ).toEqual({ kind: 'restore', pending: stored });
  });
  it.each([
    undefined,
    { id: 'wrong-task', state: 'released' },
    { id: 'original-request-id', state: 'unknown' },
  ])('does not unlock on an unrecognized task response', async (task) => {
    const stored = interruptedRequest();
    expect(
      await reconcilePendingCreditRequest(stored, async () => ({
        status: 200,
        task,
      }))
    ).toEqual({ kind: 'restore', pending: stored });
  });
  it('preserves owner, canvas and expiry safeguards after releasing a claim', async () => {
    const { pending } = await reconcilePendingCreditRequest(
      interruptedRequest(),
      async () => ({ status: 404 })
    );
    expect(canResumeCreditRequest(pending, 'other', document)).toBe(false);
    expect(
      canResumeCreditRequest(pending, 'owner', {
        ...document,
        documentId: 'other',
      })
    ).toBe(false);
    expect(
      canResumeCreditRequest(
        pending,
        'owner',
        document,
        pending.createdAt + 86400000
      )
    ).toBe(false);
  });
});
