'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFlowchart } from '@/hooks/use-flowchart';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Loader2, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AiChatSidebar from './ai-chat-sidebar';
import ResizableDivider from './resizable-divider';
import { SaveButton } from './save-button';

interface ExcalidrawWrapperProps {
  className?: string;
  flowchartId?: string;
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
  className,
  flowchartId,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const router = useRouter();
  const currentUser = useCurrentUser();
  const { flowchart, loading, error } = useFlowchart(flowchartId);

  const handleGoHome = () => {
    router.push('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleSidebarResize = (width: number) => {
    setSidebarWidth(width);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // Load flowchart data into Excalidraw when available
  useEffect(() => {
    if (excalidrawAPI && flowchart && !initialDataLoaded) {
      try {
        const parsedContent = JSON.parse(flowchart.content);

        // Prepare appState by excluding problematic properties
        const { collaborators, ...safeAppState } = parsedContent.appState || {};

        // Update the scene with loaded data
        excalidrawAPI.updateScene({
          elements: parsedContent.elements || [],
          appState: {
            ...safeAppState,
            viewBackgroundColor: '#ffffff',
            // Let Excalidraw initialize its own collaborators Map
            collaborators: new Map(),
          },
        });

        // Load files if they exist
        if (parsedContent.files) {
          // Note: File loading might need additional handling
          // depending on how files are stored
        }

        setInitialDataLoaded(true);
        console.log('Flowchart loaded successfully:', flowchart.title);
      } catch (err) {
        console.error('Error loading flowchart data:', err);
      }
    }
  }, [excalidrawAPI, flowchart, initialDataLoaded]);

  // Show loading state when fetching flowchart data
  if (flowchartId && loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-lg text-gray-600">Loading flowchart...</p>
        </div>
      </div>
    );
  }

  // Show error state if flowchart failed to load
  if (flowchartId && error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="text-red-500 text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800">
            Failed to Load Flowchart
          </h2>
          <p className="text-gray-600">{error}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex ${className || ''}`}>
      {/* Main Canvas Area */}
      <div
        className={`relative h-full ${
          isResizing ? '' : 'transition-all duration-300 ease-in-out'
        }`}
        style={{
          width: isSidebarOpen ? `calc(100% - ${sidebarWidth}px)` : '100%',
        }}
      >
        {/* Top Right Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Save Button - only show for logged in users */}
          {currentUser && (
            <SaveButton
              excalidrawAPI={excalidrawAPI}
              flowchartId={flowchartId}
            />
          )}

          {/* User Button/Sign In button */}
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

      {/* Resizable Divider - only show when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed top-0 h-full z-50"
          style={{ right: `${sidebarWidth - 1}px` }}
        >
          <ResizableDivider
            onResize={handleSidebarResize}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
            defaultWidth={sidebarWidth}
            minWidth={300}
            maxWidth={600}
          />
        </div>
      )}

      {/* AI Chat Sidebar */}
      <AiChatSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        excalidrawAPI={excalidrawAPI}
        width={sidebarWidth}
      />
    </div>
  );
};

export default ExcalidrawWrapper;
