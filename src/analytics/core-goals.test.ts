import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CORE_GOALS,
  EVENTS,
  isProductionAnalytics,
  sanitizeEventProperties,
} from './core-goals';
import { trackFlowchartEvent } from './plausible-browser';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the six operating goals', () => {
  it('uses the SpriteFuse milestones with Flowchart names', () => {
    expect(CORE_GOALS).toEqual([
      'Registration Completed',
      'Flowchart Processing Started',
      'Flowchart Export Ready',
      'Download Clicked',
      'Checkout Handoff',
      'Payment Confirmed',
    ]);
  });

  it('drops content, identities, unknown keys and invalid enum values', () => {
    expect(
      sanitizeEventProperties({
        mode: 'image_to_flowchart',
        editor: 'drawio',
        format: 'png',
        prompt: 'private prompt',
        email: 'private@example.com',
        userId: '123',
        plan: 'custom-private-plan',
      })
    ).toEqual({ mode: 'image_to_flowchart', editor: 'drawio', format: 'png' });
  });

  it('keeps development and preview traffic out of production', () => {
    const env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://flowchartai.org',
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'flowchartai.org',
      NEXT_PUBLIC_PLAUSIBLE_SCRIPT: 'https://myplausible.app/js/script.js',
    };
    expect(isProductionAnalytics(env)).toBe(true);
    expect(isProductionAnalytics({ ...env, VERCEL_ENV: 'preview' })).toBe(
      false
    );
    expect(isProductionAnalytics({ ...env, NODE_ENV: 'development' })).toBe(
      false
    );
    expect(
      isProductionAnalytics({
        ...env,
        NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
      })
    ).toBe(false);
  });

  it('queues an event when the script has not loaded yet', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://flowchartai.org');
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'flowchartai.org');
    vi.stubEnv(
      'NEXT_PUBLIC_PLAUSIBLE_SCRIPT',
      'https://myplausible.app/js/script.js'
    );
    const browser = { location: { origin: 'https://flowchartai.org' } } as any;
    vi.stubGlobal('window', browser);
    trackFlowchartEvent(EVENTS.exportReady, { editor: 'drawio' });
    expect(browser.plausible.q).toHaveLength(1);
    expect(Array.from(browser.plausible.q[0])).toEqual([
      EVENTS.exportReady,
      { props: { editor: 'drawio' } },
    ]);
  });

  it('provider failures do not interrupt the product', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://flowchartai.org');
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'flowchartai.org');
    vi.stubEnv(
      'NEXT_PUBLIC_PLAUSIBLE_SCRIPT',
      'https://myplausible.app/js/script.js'
    );
    vi.stubGlobal('window', {
      location: { origin: 'https://flowchartai.org' },
      plausible: () => {
        throw new Error('blocked');
      },
    });
    expect(() =>
      trackFlowchartEvent(EVENTS.downloadClicked, { format: 'svg' })
    ).not.toThrow();
  });

  it('uses a beacon for checkout so navigating away does not lose the event', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://flowchartai.org');
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'flowchartai.org');
    vi.stubEnv(
      'NEXT_PUBLIC_PLAUSIBLE_SCRIPT',
      'https://myplausible.app/js/script.js'
    );
    const beacon = vi.fn().mockReturnValue(true);
    const plausible = vi.fn();
    vi.stubGlobal('window', {
      location: { origin: 'https://flowchartai.org' },
      navigator: { sendBeacon: beacon },
      plausible,
    });
    trackFlowchartEvent(EVENTS.checkoutHandoff);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe('https://myplausible.app/api/event');
    expect(JSON.parse(await beacon.mock.calls[0][1].text())).toEqual({
      name: EVENTS.checkoutHandoff,
      domain: 'flowchartai.org',
      url: 'https://flowchartai.org/pricing',
      props: {},
    });
    expect(plausible).not.toHaveBeenCalled();
  });
});
