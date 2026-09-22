import { setTimeout } from 'node:timers/promises';

/** Retry only transient transport failures; callers must use idempotent R2 operations. */
export async function withR2Retry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const failure = error as {
        code?: string;
        name?: string;
        message?: string;
      };
      const transient =
        ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN'].includes(
          failure.code || ''
        ) ||
        ['TimeoutError', 'RequestTimeout'].includes(failure.name || '') ||
        failure.message?.includes(
          'before secure TLS connection was established'
        );
      if (!transient || attempt >= 3) throw error;
      await setTimeout(500 * 2 ** attempt);
    }
  }
}
