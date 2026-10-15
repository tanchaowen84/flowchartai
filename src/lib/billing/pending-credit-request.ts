/** [INPUT] One paused authenticated request. [OUTPUT] Private durable purchase continuation; never analytics. */
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
