'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

// Dynamic import without ssr:false since we're now in a client component
const ExcalidrawWrapper = dynamic(
  () => import('@/components/canvas/excalidraw-wrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading Canvas...</div>
      </div>
    ),
  }
);

export default function CanvasPage() {
  const t = useTranslations('CanvasPage');

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">FlowChart AI</h1>
          <div className="text-sm text-muted-foreground">{t('subtitle')}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Future: Add AI chat button, save/export buttons */}
          <div className="text-sm text-muted-foreground">
            AI Assistant (Coming Soon)
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative">
        <ExcalidrawWrapper />
      </div>
    </div>
  );
}
