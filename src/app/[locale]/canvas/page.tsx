'use client';

import dynamic from 'next/dynamic';

// Dynamic import for Excalidraw with SSR disabled for client-side rendering
const ExcalidrawWrapper = dynamic(
  () => import('@/components/canvas/excalidraw-wrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen w-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          <div className="text-lg text-gray-600">Loading FlowChart AI...</div>
        </div>
      </div>
    ),
  }
);

export default function CanvasPage() {
  return (
    <div className="h-screen w-screen">
      <ExcalidrawWrapper />
    </div>
  );
}
