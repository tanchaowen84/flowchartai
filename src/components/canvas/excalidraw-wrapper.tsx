'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AiChatSidebar from './ai-chat-sidebar';

interface ExcalidrawWrapperProps {
  className?: string;
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({ className }) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className={`h-screen w-screen flex ${className || ''}`}>
      {/* Main Canvas Area */}
      <div
        className="h-full transition-all duration-300 ease-in-out"
        style={{
          width: isSidebarOpen ? 'calc(100% - 400px)' : '100%',
        }}
      >
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
            dockedSidebarBreakpoint: 0, // Hide the default library sidebar
          }}
        >
          <MainMenu>
            <MainMenu.Item onSelect={handleGoHome}>Back To Home</MainMenu.Item>
            <MainMenu.DefaultItems.Socials />
            <MainMenu.DefaultItems.Export />
          </MainMenu>
        </Excalidraw>
      </div>

      {/* AI Chat Sidebar */}
      <AiChatSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
    </div>
  );
};

export default ExcalidrawWrapper;
