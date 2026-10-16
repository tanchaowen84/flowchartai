/**
 * [INPUT] A retained request and the owned server task status.
 * [OUTPUT] Durable continuation or safe explicit retry; never analytics.
 * [POS] Shared recovery policy for continuation errors and reloads.
 * [UPDATE] Keep the chat recovery UI and billing documentation in sync.
 */
import type { DrawioDocument } from '@/lib/drawio/contracts';
import { nativeContentFingerprint } from '@/lib/drawio/native-document';
export interface PendingCreditRequest {
  userId: string;
  requestBody: any;
  documentId: string;
  fingerprint: string;
  path: string;
  createdAt: number;
  checkoutId?: string;
  resumeStartedAt?: number;
  retryReady?: boolean;
}
export interface CreditTaskLookup {
  status: number;
  task?: { id: string; state: string };
}
export interface PendingCreditRecovery {
  kind: 'retry' | 'restore';
  pending: PendingCreditRequest;
}
export async function reconcilePendingCreditRequest(
  pending: PendingCreditRequest,
  lookupTask: (id: string) => Promise<CreditTaskLookup> = async (id) => {
    const response = await fetch(
      `/api/billing/task?id=${encodeURIComponent(id)}`,
      { cache: 'no-store' }
    );
    return {
      status: response.status,
      task: response.ok ? await response.json() : undefined,
    };
  },
  newTaskId: () => string = () => crypto.randomUUID()
): Promise<PendingCreditRecovery> {
  let lookup: CreditTaskLookup;
  try {
    lookup = await lookupTask(pending.requestBody.billingTaskId);
  } catch {
    // An unavailable lookup cannot prove the original request did not run.
    return { kind: 'restore', pending };
  }
  const released =
    lookup.status === 200 &&
    lookup.task?.id === pending.requestBody.billingTaskId &&
    lookup.task?.state === 'released';
  if (lookup.status === 404 || released) {
    return {
      kind: 'retry',
      pending: {
        ...pending,
        requestBody: released
          ? { ...pending.requestBody, billingTaskId: newTaskId() }
          : pending.requestBody,
        resumeStartedAt: undefined,
        checkoutId: undefined,
        retryReady: true,
      },
    };
  }
  return { kind: 'restore', pending };
}
export function canResumeCreditRequest(
  pending: PendingCreditRequest,
  userId: string,
  document: DrawioDocument | undefined,
  now = Date.now()
): boolean {
  return (
    pending.userId === userId &&
    !pending.resumeStartedAt &&
    now - pending.createdAt < 24 * 3600000 &&
    Boolean(
      document &&
        document.documentId === pending.documentId &&
        nativeContentFingerprint(document.xml) === pending.fingerprint
    )
  );
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('flowchartai-credit-resume', 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore('pending', { keyPath: 'userId' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readPendingCreditRequest(
  userId: string
): Promise<PendingCreditRequest | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction('pending').objectStore('pending').get(userId);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function writePendingCreditRequest(
  pending: PendingCreditRequest
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').put(pending);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearPendingCreditRequest(
  userId: string,
  taskId: string
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      const r = store.get(userId);
      r.onsuccess = () => {
        if (r.result?.requestBody.billingTaskId === taskId)
          store.delete(userId);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
