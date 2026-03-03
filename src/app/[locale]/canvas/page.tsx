'use client';

import dynamic from 'next/dynamic';

// Dynamic import for FlowViz with SSR disabled for client-side rendering
const FlowVizArchitectWrapper = dynamic(
  () => import('@/components/canvas/flowviz-architect'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen w-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
          <div className="text-lg text-slate-600">Loading InfoGiph...</div>
        </div>
      </div>
    ),
  }
);

export default function CanvasPage() {
  return (
    <div className="h-screen w-screen overflow-y-auto bg-slate-50">
      <FlowVizArchitectWrapper />
    </div>
  );
}
