'use client';

import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useState } from 'react';

interface ExcalidrawWrapperProps {
  className?: string;
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({ className }) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  return (
    <div className={`w-full h-full ${className || ''}`}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={{
          appState: {
            viewBackgroundColor: '#ffffff',
            currentItemFontFamily: 1,
          },
        }}
      />
    </div>
  );
};

export default ExcalidrawWrapper;
