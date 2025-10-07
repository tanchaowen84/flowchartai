'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const DemoSection = dynamic(() => import('@/components/blocks/demo/demo'), {
  ssr: false,
});

const ComparisonSection = dynamic(
  () => import('@/components/blocks/comparison/comparison'),
  {
    ssr: false,
  }
);

const AiCapabilitiesSection = dynamic(
  () => import('@/components/blocks/ai-capabilities/ai-capabilities'),
  {
    ssr: false,
  }
);

export function LazyDemoSection() {
  return (
    <Suspense fallback={<MarketingSectionPlaceholder />}>
      <DemoSection />
    </Suspense>
  );
}

export function LazyComparisonSection() {
  return (
    <Suspense fallback={<MarketingSectionPlaceholder />}>
      <ComparisonSection />
    </Suspense>
  );
}

export function LazyAiCapabilitiesSection() {
  return (
    <Suspense fallback={<MarketingSectionPlaceholder />}>
      <AiCapabilitiesSection />
    </Suspense>
  );
}

function MarketingSectionPlaceholder() {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-52 rounded bg-muted animate-pulse" />
        <div className="h-4 w-72 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      </div>
    </section>
  );
}
