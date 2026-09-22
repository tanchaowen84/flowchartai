import { afterEach, expect, it, vi } from 'vitest';
import { withR2Retry } from './flowchart-r2-retry';

afterEach(() => vi.useRealTimers());

it('recovers a transient connection failure without changing the result', async () => {
  vi.useFakeTimers();
  const operation = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('reset'), { code: 'ECONNRESET' })
    )
    .mockResolvedValue('verified');
  const result = withR2Retry(operation);
  await vi.runAllTimersAsync();
  expect(await result).toBe('verified');
  expect(operation).toHaveBeenCalledTimes(2);
});

it('never retries an authorization or integrity failure', async () => {
  const error = new Error('Asset integrity check failed');
  const operation = vi.fn().mockRejectedValue(error);
  await expect(withR2Retry(operation)).rejects.toBe(error);
  expect(operation).toHaveBeenCalledTimes(1);
});

it('stops after four failed transport attempts', async () => {
  vi.useFakeTimers();
  const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
  const operation = vi.fn().mockRejectedValue(error);
  const result = expect(withR2Retry(operation)).rejects.toBe(error);
  await vi.runAllTimersAsync();
  await result;
  expect(operation).toHaveBeenCalledTimes(4);
});
