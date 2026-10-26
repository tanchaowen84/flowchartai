/** First-party page tracking. No account IDs, page content or secrets are sent by this SDK. */
interface Options {
  siteId: string;
  endpoint: string;
  identityEndpoint?: string;
  qa?: boolean;
  normalizePath?: (path: string) => string;
}
interface Stored {
  anonymous: string;
  session: string;
  lastActive: number;
  source: string;
  entry: string;
  owner?: string;
}
interface BrowserEvent {
  event_id: string;
  name: string;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  path: string;
  properties: Record<string, unknown>;
  qa: boolean;
}
export function start(options: Options) {
  const key = `insights:${options.siteId}`;
  const queueKey = `${key}:queue`;
  const safe = (s: string) =>
    /^[a-zA-Z0-9 _.:/-]{0,100}$/.test(s) ? s : 'Unknown';
  const path = () =>
    options.normalizePath
      ? options.normalizePath(location.pathname)
      : location.pathname.replace(/\/[a-f0-9-]{20,}(?=\/|$)/gi, '/:id');
  const source = () => {
    try {
      const url = new URL(location.href);
      const utm = url.searchParams.get('utm_source');
      if (utm) return safe(utm);
      const ref = document.referrer ? new URL(document.referrer) : null;
      return ref && ref.origin !== location.origin
        ? safe(ref.hostname)
        : 'Unknown';
    } catch {
      return 'Unknown';
    }
  };
  const fresh = (): Stored => ({
    anonymous: crypto.randomUUID(),
    session: crypto.randomUUID(),
    lastActive: Date.now(),
    source: source(),
    entry: path(),
  });
  let state: Stored;
  try {
    state = JSON.parse(localStorage.getItem(key) || 'null') || fresh();
  } catch {
    state = fresh();
  }
  let queue: BrowserEvent[] = [];
  try {
    queue = JSON.parse(localStorage.getItem(queueKey) || '[]')
      .filter(
        (e: BrowserEvent) => Date.parse(e.occurred_at) > Date.now() - 86400000
      )
      .slice(-100);
  } catch {}
  let busy = false;
  let stopped = false;
  let lastPath = path();
  let lastTick = Date.now();
  let activeUntil = Date.now() + 30000;
  let seconds = 0;
  const persist = () => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(queueKey, JSON.stringify(queue.slice(-100)));
    } catch {}
  };
  const session = () => {
    if (Date.now() - state.lastActive > 1800000)
      state.session = crypto.randomUUID();
    state.lastActive = Date.now();
    persist();
  };
  async function flush() {
    if (busy || stopped || !queue.length) return;
    busy = true;
    const batch = queue.slice(0, 20);
    try {
      const r = await fetch(
        `${options.endpoint}/api/v1/collect?site_id=${encodeURIComponent(options.siteId)}`,
        {
          method: 'POST',
          credentials: 'omit',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site_id: options.siteId, events: batch }),
          signal: AbortSignal.timeout(5000),
        }
      );
      if (r.ok || [400, 409, 413].includes(r.status)) {
        const ids = new Set(batch.map((e) => e.event_id));
        queue = queue.filter((e) => !ids.has(e.event_id));
        persist();
      }
    } catch {
    } finally {
      busy = false;
    }
  }
  function track(
    name: 'page_view' | 'engagement' | 'interaction',
    properties: Record<string, unknown> = {},
    eventPath = path()
  ) {
    if (stopped) return;
    session();
    queue.push({
      event_id: crypto.randomUUID(),
      name,
      occurred_at: new Date().toISOString(),
      anonymous_id: state.anonymous,
      session_id: state.session,
      path: eventPath,
      properties: {
        source: state.source,
        entry_path: state.entry,
        device: innerWidth < 768 ? 'mobile' : 'desktop',
        ...properties,
      },
      qa: !!options.qa,
    });
    queue = queue.slice(-100);
    persist();
    void flush();
  }
  function activity() {
    activeUntil = Date.now() + 30000;
    session();
  }
  function tick() {
    const now = Date.now();
    if (document.visibilityState === 'visible' && lastTick < activeUntil)
      seconds +=
        Math.min(now - lastTick, Math.max(0, activeUntil - lastTick), 1000) /
        1000;
    lastTick = now;
  }
  function duration() {
    tick();
    if (seconds > 0) {
      track(
        'engagement',
        { seconds: Math.min(60, Math.round(seconds * 100) / 100) },
        lastPath
      );
      seconds = 0;
    }
  }
  function page() {
    const next = path();
    if (next === lastPath) return;
    duration();
    lastPath = next;
    track('page_view');
  }
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const push: History['pushState'] = (...args) => {
    originalPush.apply(history, args);
    page();
  };
  const replace: History['replaceState'] = (...args) => {
    originalReplace.apply(history, args);
    page();
  };
  history.pushState = push;
  history.replaceState = replace;
  for (const name of ['pointerdown', 'keydown', 'scroll'])
    addEventListener(name, activity, { passive: true });
  addEventListener('popstate', page);
  addEventListener('pagehide', duration);
  const visibility = () => {
    duration();
    if (document.visibilityState === 'visible') {
      activeUntil = Date.now() + 30000;
      void flush();
    }
  };
  document.addEventListener('visibilitychange', visibility);
  const interval = setInterval(tick, 1000);
  const sender = setInterval(() => {
    duration();
    void flush();
  }, 15000);
  track('page_view');
  return {
    anonymousId: () => state.anonymous,
    track: (name: string) => track('interaction', { interaction: safe(name) }),
    async identify(owner: string) {
      if (state.owner && state.owner !== owner) this.reset();
      if (!options.identityEndpoint) return false;
      try {
        const r = await fetch(options.identityEndpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anonymous_id: state.anonymous,
            qa: !!options.qa,
          }),
        });
        if (r.ok) {
          state.owner = owner;
          persist();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    clearIdentity() {
      if (state.owner) this.reset();
    },
    reset() {
      duration();
      state = fresh();
      persist();
      track('page_view');
    },
    stop() {
      duration();
      void flush();
      stopped = true;
      clearInterval(interval);
      clearInterval(sender);
      for (const name of ['pointerdown', 'keydown', 'scroll'])
        removeEventListener(name, activity);
      removeEventListener('popstate', page);
      removeEventListener('pagehide', duration);
      document.removeEventListener('visibilitychange', visibility);
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace)
        history.replaceState = originalReplace;
    },
  };
}
