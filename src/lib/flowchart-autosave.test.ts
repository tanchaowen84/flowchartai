import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFlowchartAutosaveCoordinator,
  getFlowchartContentFingerprint,
} from './flowchart-autosave';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createFlowchartAutosaveCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces repeated changes and saves the latest revision once after 3 seconds', async () => {
    let revision = 0;
    const savedRevisions: number[] = [];
    const save = vi.fn(async () => {
      savedRevisions.push(revision);
    });
    const coordinator = createFlowchartAutosaveCoordinator({
      delayMs: 3000,
      save,
      onStateChange: vi.fn(),
    });
    const change = () => {
      revision += 1;
      coordinator.markChanged();
    };

    change();
    expect(coordinator.getState().status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1000);
    change();
    await vi.advanceTimersByTimeAsync(2999);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(savedRevisions).toEqual([2]);
    expect(coordinator.getState().status).toBe('saved');
  });

  it('runs one immediate follow-up save when changes arrive during an in-flight save', async () => {
    let revision = 0;
    const savedRevisions: number[] = [];
    const first = deferred<void>();
    const second = deferred<void>();
    const save = vi.fn(() => {
      savedRevisions.push(revision);
      return save.mock.calls.length === 1 ? first.promise : second.promise;
    });
    const coordinator = createFlowchartAutosaveCoordinator({
      delayMs: 3000,
      save,
      onStateChange: vi.fn(),
    });
    const change = () => {
      revision += 1;
      coordinator.markChanged();
    };

    change();
    vi.advanceTimersByTime(3000);
    await flushMicrotasks();
    expect(save).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe('saving');

    change();
    change();
    vi.advanceTimersByTime(10_000);
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve();
    await flushMicrotasks();

    expect(save).toHaveBeenCalledTimes(2);
    expect(savedRevisions).toEqual([1, 3]);
    expect(coordinator.getState().status).toBe('saving');

    second.resolve();
    await flushMicrotasks();
    expect(coordinator.getState().status).toBe('saved');
  });

  it('stays in error without automatic retries until retry saves the latest revision', async () => {
    let revision = 0;
    const savedRevisions: number[] = [];
    const save = vi.fn(async () => {
      savedRevisions.push(revision);
      if (save.mock.calls.length === 1) {
        throw new Error('save failed');
      }
    });
    const coordinator = createFlowchartAutosaveCoordinator({
      delayMs: 3000,
      save,
      onStateChange: vi.fn(),
    });
    const change = () => {
      revision += 1;
      coordinator.markChanged();
    };

    change();
    await vi.advanceTimersByTimeAsync(3000);
    expect(coordinator.getState().status).toBe('error');

    change();
    change();
    expect(coordinator.getState().status).toBe('error');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(save).toHaveBeenCalledTimes(1);

    coordinator.retry();
    await flushMicrotasks();

    expect(save).toHaveBeenCalledTimes(2);
    expect(savedRevisions).toEqual([1, 3]);
    expect(coordinator.getState().status).toBe('saved');
  });

  it('clears a pending debounce timer when disposed', async () => {
    const save = vi.fn(async () => undefined);
    const coordinator = createFlowchartAutosaveCoordinator({
      delayMs: 3000,
      save,
      onStateChange: vi.fn(),
    });

    coordinator.markChanged();
    expect(vi.getTimerCount()).toBe(1);
    coordinator.dispose();
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(3000);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('getFlowchartContentFingerprint', () => {
  it('changes for element or file content and has no viewport state input', () => {
    const baseline = getFlowchartContentFingerprint(
      [{ id: 'one', version: 1 }],
      {}
    );

    expect(
      getFlowchartContentFingerprint([{ id: 'one', version: 1 }], {})
    ).toBe(baseline);
    expect(
      getFlowchartContentFingerprint([{ id: 'one', version: 2 }], {})
    ).not.toBe(baseline);
    expect(
      getFlowchartContentFingerprint([{ id: 'one', version: 1 }], {
        image: {},
      })
    ).not.toBe(baseline);
  });

  it('distinguishes element identity and stacking order without version sums', () => {
    const first = { id: 'first', version: 1 };
    const second = { id: 'second', version: 2 };

    expect(getFlowchartContentFingerprint([first, second], {})).not.toBe(
      getFlowchartContentFingerprint([second, first], {})
    );
    expect(getFlowchartContentFingerprint([first], {})).not.toBe(
      getFlowchartContentFingerprint([{ id: 'replacement', version: 1 }], {})
    );
  });
});
