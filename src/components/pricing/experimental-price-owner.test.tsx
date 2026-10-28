import { act, create } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { useExperimentalPack } from './use-experimental-pack';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('requires a fresh result when the same user logs in after logout', async () => {
  const pending: ((r: Response) => void)[] = [];
  const frames: { loading: boolean }[] = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('addEventListener', () => {});
  vi.stubGlobal('removeEventListener', () => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)))
  );
  function Price({ user }: { user?: string }) {
    const state = useExperimentalPack(user);
    frames.push({ loading: state.loading });
    return (
      <button type="button" disabled={state.loading || !!state.error}>
        Buy
      </button>
    );
  }
  let tree: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      tree = create(<Price user="first" />);
    });
    await act(async () => {
      pending.shift()!(Response.json({ quote: null }));
    });
    expect(frames.at(-1)?.loading).toBe(false);
    await act(async () => {
      tree!.update(<Price />);
    });
    const start = frames.length;
    await act(async () => {
      tree!.update(<Price user="first" />);
    });
    expect(frames.slice(start).every((f) => f.loading)).toBe(true);
    expect(tree!.root.findByType('button').props.disabled).toBe(true);
    await act(async () => {
      pending.shift()!(Response.json({ quote: null }));
    });
    expect(tree!.root.findByType('button').props.disabled).toBe(false);
  } finally {
    await act(async () => {
      tree?.unmount();
    });
  }
});
it('requires an explicit result for each owner and refresh before enabling purchase', async () => {
  const pending: ((r: Response) => void)[] = [];
  const frames: { user: string; loading: boolean; refresh: () => void }[] = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('addEventListener', () => {});
  vi.stubGlobal('removeEventListener', () => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)))
  );
  function Price({ user }: { user: string }) {
    const state = useExperimentalPack(user);
    frames.push({ user, ...state });
    return (
      <button type="button" disabled={state.loading || !!state.error}>
        Buy
      </button>
    );
  }
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Price user="first" />);
  });
  expect(frames.filter((f) => f.user === 'first').every((f) => f.loading)).toBe(
    true
  );
  await act(async () => {
    pending.shift()!(Response.json({ quote: null }));
  });
  expect(frames.at(-1)?.loading).toBe(false);
  await act(async () => {
    tree.update(<Price user="second" />);
  });
  expect(
    frames.filter((f) => f.user === 'second').every((f) => f.loading)
  ).toBe(true);
  await act(async () => {
    pending.shift()!(Response.json({ quote: null }));
  });
  expect(frames.at(-1)?.loading).toBe(false);
  const start = frames.length;
  await act(async () => {
    frames.at(-1)!.refresh();
  });
  expect(frames.slice(start).every((f) => f.loading)).toBe(true);
  await act(async () => {
    tree.unmount();
  });
});
