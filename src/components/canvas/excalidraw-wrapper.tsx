'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ExcalidrawWrapperProps {
  className?: string;
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({ className }) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className={`h-screen w-screen ${className || ''}`}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={{
          appState: {
            viewBackgroundColor: '#ffffff',
            currentItemFontFamily: 1,
            zenModeEnabled: false,
          },
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: {
              saveFileToDisk: true,
            },
            saveToActiveFile: true,
          },
        }}
      >
        <MainMenu>
          <MainMenu.Item onSelect={handleGoHome}>Back To Home</MainMenu.Item>
          <MainMenu.DefaultItems.Socials />
          <MainMenu.DefaultItems.Export />
        </MainMenu>
      </Excalidraw>
    </div>
  );
};

export default ExcalidrawWrapper;
