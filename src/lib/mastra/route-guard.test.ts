import { describe, expect, it, vi } from 'vitest';
import { runGuardedFlowchartAgent } from './route-guard';

function makeDependencies(overrides: Record<string, unknown> = {}) {
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    checkUsage: vi.fn().mockResolvedValue({
      canUse: true,
      remainingUsage: 9,
      limit: 10,
    }),
    moderate: vi.fn().mockResolvedValue({ decision: 'allow' }),
    invokeAgent: vi.fn().mockResolvedValue('stream'),
    ...overrides,
  };
}

describe('runGuardedFlowchartAgent', () => {
  it('returns 401 before usage, moderation, or model invocation', async () => {
    const dependencies = makeDependencies({
      getSession: vi.fn().mockResolvedValue(null),
    });

    const result = await runGuardedFlowchartAgent(
      { latestUserPrompt: 'Create a flowchart' },
      dependencies
    );

    expect(result).toEqual(expect.objectContaining({ ok: false, status: 401 }));
    expect(dependencies.checkUsage).not.toHaveBeenCalled();
    expect(dependencies.moderate).not.toHaveBeenCalled();
    expect(dependencies.invokeAgent).not.toHaveBeenCalled();
  });

  it('returns 429 before moderation or model invocation', async () => {
    const dependencies = makeDependencies({
      checkUsage: vi.fn().mockResolvedValue({
        canUse: false,
        remainingUsage: 0,
        limit: 10,
        timeFrame: 'daily',
      }),
    });

    const result = await runGuardedFlowchartAgent(
      { latestUserPrompt: 'Create a flowchart' },
      dependencies
    );

    expect(result).toEqual(expect.objectContaining({ ok: false, status: 429 }));
    expect(dependencies.moderate).not.toHaveBeenCalled();
    expect(dependencies.invokeAgent).not.toHaveBeenCalled();
  });

  it.each(['deny', 'flag'] as const)(
    'returns a moderation rejection for %s with zero model calls',
    async (decision) => {
      const dependencies = makeDependencies({
        moderate: vi.fn().mockResolvedValue({ decision }),
      });

      const result = await runGuardedFlowchartAgent(
        { latestUserPrompt: 'Unsafe request' },
        dependencies
      );

      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400 })
      );
      expect(dependencies.invokeAgent).not.toHaveBeenCalled();
    }
  );

  it('invokes the agent once only after every guard passes', async () => {
    const dependencies = makeDependencies();

    const result = await runGuardedFlowchartAgent(
      { latestUserPrompt: 'Create a safe flowchart' },
      dependencies
    );

    expect(result).toEqual({ ok: true, userId: 'user-1', value: 'stream' });
    expect(dependencies.invokeAgent).toHaveBeenCalledTimes(1);
    expect(dependencies.invokeAgent).toHaveBeenCalledWith('user-1');
  });
});
