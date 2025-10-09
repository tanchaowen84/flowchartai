'use client';

import { useEffect, useState } from 'react';

const INTERACTION_EVENTS: Array<keyof WindowEventMap> = [
  'scroll',
  'pointerdown',
  'keydown',
];

/**
 * 简单的延迟加载 hook：等待用户有交互或停留 3 秒再启用
 */
export function useDeferredThirdParty(delay = 3000) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || enabled) {
      return;
    }

    const enable = () => {
      setEnabled(true);
      clearTimeout(timer);
      INTERACTION_EVENTS.forEach((event) =>
        window.removeEventListener(event, enable)
      );
    };

    const timer = window.setTimeout(enable, delay);
    INTERACTION_EVENTS.forEach((event) =>
      window.addEventListener(event, enable, { once: true })
    );

    return () => {
      clearTimeout(timer);
      INTERACTION_EVENTS.forEach((event) =>
        window.removeEventListener(event, enable)
      );
    };
  }, [delay, enabled]);

  return enabled;
}
