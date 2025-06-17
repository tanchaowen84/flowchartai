'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { User } from 'lucide-react';
import Link from 'next/link';
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
  const currentUser = useCurrentUser();

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
        className="relative h-full transition-all duration-300 ease-in-out"
        style={{
          width: isSidebarOpen ? 'calc(100% - 400px)' : '100%',
        }}
      >
        {/* Top Right Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Moved UserButton/Sign In button before Create button */}
          {currentUser ? (
            <UserButton user={currentUser} />
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-9 px-3">
              <Link href="/auth/login" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            </Button>
          )}
          {!isSidebarOpen && (
            <Button
              onClick={toggleSidebar}
              variant="ghost"
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
            >
              Create
            </Button>
          )}
        </div>

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
