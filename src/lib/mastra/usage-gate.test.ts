import { describe, expect, it, vi } from 'vitest';
import { createCanvasUsageGate } from './usage-gate';

describe('canvas usage gate', () => {
  it('records successful canvas commit exactly once', async () => {
    const recordUsage = vi.fn().mockResolvedValue(undefined);
    const gate = createCanvasUsageGate(recordUsage);

    await gate.commit({ mode: 'patch', elementCount: 4 });
    await gate.commit({ mode: 'patch', elementCount: 4 });

    expect(recordUsage).toHaveBeenCalledTimes(1);
  });

  it('records zero usage after render failure', async () => {
    const recordUsage = vi.fn().mockResolvedValue(undefined);
    const gate = createCanvasUsageGate(recordUsage);

    gate.fail();
    await gate.commit({ mode: 'replace' });

    expect(recordUsage).not.toHaveBeenCalled();
  });

  it('records zero usage after abort', async () => {
    const recordUsage = vi.fn().mockResolvedValue(undefined);
    const gate = createCanvasUsageGate(recordUsage);

    gate.abort();
    await gate.commit({ mode: 'patch' });

    expect(recordUsage).not.toHaveBeenCalled();
  });
});
