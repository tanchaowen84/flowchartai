import { EVENTS } from '@/analytics/core-goals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreditCheckout } from './use-credit-checkout';

const { track, growth, setState } = vi.hoisted(() => ({
  track: vi.fn(),
  growth: vi.fn(),
  setState: vi.fn(),
}));
vi.mock('@/analytics/growth-browser', () => ({ trackGrowth: growth }));
vi.mock('@/analytics/plausible-browser', () => ({
  trackFlowchartEvent: track,
}));
vi.mock('react', () => ({
  useState: (value: unknown) => [value, setState],
  useRef: (value: unknown) => ({ current: value }),
}));
const checkoutUrl = 'https://checkout.waffo.com/test';
let popup: {
  closed: boolean;
  opener: unknown;
  location: { replace: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
};
let request: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  popup = {
    closed: false,
    opener: {},
    location: { replace: vi.fn() },
    close: vi.fn(),
  };
  vi.stubGlobal('window', { open: vi.fn(() => popup) });
  request = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'private-checkout', url: checkoutUrl }),
  });
  vi.stubGlobal('fetch', request);
});
afterEach(() => vi.unstubAllGlobals());

describe('Waffo checkout handoff', () => {
  it('preserves continuation registration and records only after popup navigation, without sending checkout identity', async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    popup.location.replace.mockImplementation(() => {
      expect(onCreated).toHaveBeenCalledWith('private-checkout');
      expect(track).not.toHaveBeenCalled();
    });
    const checkout = useCreditCheckout(onCreated, 'paywall');
    await checkout.buy('pack_small');
    expect(popup.location.replace).toHaveBeenCalledWith(checkoutUrl);
    expect(track).toHaveBeenCalledExactlyOnceWith(EVENTS.checkoutHandoff, {
      source: 'paywall',
    });
    checkout.trackHandoff();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('waits for a fallback click when the popup is blocked and deduplicates repeat clicks', async () => {
    window.open = vi.fn().mockReturnValue(null);
    const checkout = useCreditCheckout();
    await checkout.buy('pack_small');
    expect(track).not.toHaveBeenCalled();
    checkout.trackHandoff();
    checkout.trackHandoff();
    expect(track).toHaveBeenCalledExactlyOnceWith(EVENTS.checkoutHandoff, {
      source: 'pricing',
    });
  });

  it('does not count an already closed popup as a handoff', async () => {
    popup.closed = true;
    await useCreditCheckout().buy('pack_small');
    expect(track).not.toHaveBeenCalled();
    expect(popup.location.replace).not.toHaveBeenCalled();
  });

  it('does not count navigation failure, but allows the real fallback click', async () => {
    popup.location.replace.mockImplementation(() => {
      throw new Error('closed');
    });
    const checkout = useCreditCheckout();
    await checkout.buy('pack_small');
    expect(track).not.toHaveBeenCalled();
    checkout.trackHandoff();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('does not count checkout creation failure or a click without a checkout', async () => {
    request.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Unavailable' }),
    });
    const checkout = useCreditCheckout();
    await checkout.buy('pack_small');
    checkout.trackHandoff();
    expect(track).not.toHaveBeenCalled();
  });

  it('rejects an invalid checkout URL before registering continuation or navigating', async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'private-checkout', url: 'javascript:void(0)' }),
    });
    const onCreated = vi.fn();
    const checkout = useCreditCheckout(onCreated, 'paywall');
    await checkout.buy('pack_small');
    checkout.trackHandoff();
    expect(onCreated).not.toHaveBeenCalled();
    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('counts a resumed checkout only when its fallback link is used', async () => {
    request.mockResolvedValue({
      ok: false,
      json: async () => ({
        message: 'Existing checkout',
        resumeUrl: checkoutUrl,
        checkoutId: 'owned-pending-checkout',
      }),
    });
    const checkout = useCreditCheckout(undefined, 'paywall');
    await checkout.buy('pack_small');
    expect(track).not.toHaveBeenCalled();
    checkout.trackHandoff();
    expect(track).toHaveBeenCalledExactlyOnceWith(EVENTS.checkoutHandoff, {
      source: 'paywall',
    });
    expect(growth).toHaveBeenCalledExactlyOnceWith(
      'checkout_handoff',
      { checkoutId: 'owned-pending-checkout' },
      { source: 'paywall' }
    );
  });
});
