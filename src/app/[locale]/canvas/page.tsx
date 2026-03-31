'use client';

import dynamic from 'next/dynamic';

const FlowVizArchitectWrapper = dynamic(
  () => import('@/components/canvas/flowviz-architect'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
          <div className="text-lg text-muted-foreground">Loading InfoGiph...</div>
        </div>
      </div>
    ),
  }
);

export default function CanvasPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <FlowVizArchitectWrapper />
    </div>
  );
}
