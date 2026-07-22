'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { ToasterProps } from 'sonner';

const Toaster = dynamic(
  () => import('sonner').then((module) => module.Toaster),
  { ssr: false }
);

export function DeferredToaster(props: ToasterProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const showToaster = () => setReady(true);
    const fallbackTimer = window.setTimeout(showToaster, 4000);

    window.addEventListener('pointerdown', showToaster, { once: true });
    window.addEventListener('keydown', showToaster, { once: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('pointerdown', showToaster);
      window.removeEventListener('keydown', showToaster);
    };
  }, []);

  return ready ? <Toaster {...props} /> : null;
}
