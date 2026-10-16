import { beforeEach, expect, it, vi } from 'vitest';
import { EVENTS } from './core-goals';
import { usePaywallView } from './use-paywall-view';

const { track, previous } = vi.hoisted(() => ({
  track: vi.fn(),
  previous: { current: false },
}));
vi.mock('./plausible-browser', () => ({ trackFlowchartEvent: track }));
vi.mock('react', () => ({
  useRef: () => previous,
  // Exercise repeated effects too, as in Strict Mode's initial effect replay.
  useEffect: (effect: () => void) => effect(),
}));
beforeEach(() => {
  track.mockClear();
  previous.current = false;
});

it('counts actual open transitions, not closed renders or open rerenders', () => {
  usePaywallView(false);
  usePaywallView(false);
  expect(track).not.toHaveBeenCalled();
  usePaywallView(true);
  usePaywallView(true);
  usePaywallView(true);
  expect(track).toHaveBeenCalledExactlyOnceWith(EVENTS.paywallViewed, {
    source: 'paywall',
  });
  usePaywallView(false);
  usePaywallView(true);
  expect(track).toHaveBeenCalledTimes(2);
});
