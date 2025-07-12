'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { websiteConfig } from '@/config/website';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFlowchart } from '@/hooks/use-flowchart';
import { useLocalePathname } from '@/i18n/navigation';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import { Edit, Loader2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AiChatSidebar from './ai-chat-sidebar';
import ResizableDivider from './resizable-divider';
import { SaveButton } from './save-button';

interface ExcalidrawWrapperProps {
  className?: string;
  flowchartId?: string;
}

// Helper function to parse flowchart data for Excalidraw initialData
const parseFlowchartData = (content: string): ExcalidrawInitialDataState => {
  try {
    const parsedContent = JSON.parse(content);

    // Prepare appState by excluding problematic properties
    const { collaborators, ...safeAppState } = parsedContent.appState || {};

    return {
      elements: parsedContent.elements || [],
      appState: {
        ...safeAppState,
        viewBackgroundColor: '#ffffff',
        // Don't override collaborators, let Excalidraw manage it
      },
      files: parsedContent.files || {},
    };
  } catch (error) {
    console.error('Error parsing flowchart data:', error);
    // Return default data if parsing fails
    return {
      appState: {
        viewBackgroundColor: '#ffffff',
        currentItemFontFamily: 1,
        zenModeEnabled: false,
      },
    };
  }
};

// Default initial data for new flowcharts
const defaultInitialData: ExcalidrawInitialDataState = {
  appState: {
    viewBackgroundColor: '#ffffff',
    currentItemFontFamily: 1,
    zenModeEnabled: false,
  },
};

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
  className,
  flowchartId,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [currentFlowchartId, setCurrentFlowchartId] = useState(flowchartId);
  const [currentTitle, setCurrentTitle] = useState<string>('Untitled');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('Untitled');
  const [autoInput, setAutoInput] = useState<string>('');
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  const router = useRouter();
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const { flowchart, loading, error } = useFlowchart(currentFlowchartId);

  // Compute initial data based on flowchart content
  const initialData = useMemo((): ExcalidrawInitialDataState => {
    if (flowchart?.content) {
      return parseFlowchartData(flowchart.content);
    }
    return defaultInitialData;
  }, [flowchart?.content]);

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

  const handleFlowchartIdChange = (newId: string) => {
    setCurrentFlowchartId(newId);
  };

  const handleTitleChange = async (newTitle: string) => {
    setCurrentTitle(newTitle);

    // Auto-save when title changes for existing flowcharts
    if (currentFlowchartId && excalidrawAPI) {
      try {
        const response = await fetch(`/api/flowcharts/${currentFlowchartId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: newTitle,
          }),
        });

        if (!response.ok) {
          console.error('Failed to update title');
        }
      } catch (error) {
        console.error('Error updating title:', error);
      }
    }
  };

  const handleTitleEditStart = () => {
    setTempTitle(currentTitle);
    setIsEditingTitle(true);
  };

  const handleTitleEditSave = async () => {
    if (tempTitle.trim()) {
      await handleTitleChange(tempTitle.trim());
      setCurrentTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleEditCancel = () => {
    setTempTitle(currentTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleEditSave();
    } else if (e.key === 'Escape') {
      handleTitleEditCancel();
    }
  };

  // Check for auto-generation from homepage
  useEffect(() => {
    const autoGenerate = localStorage.getItem('flowchart_auto_generate');
    const autoInputContent = localStorage.getItem('flowchart_auto_input');

    if (autoGenerate === 'true' && autoInputContent) {
      setAutoInput(autoInputContent);
      setShouldAutoGenerate(true);
      setIsSidebarOpen(true);

      // 🔧 不要立即清除localStorage，等待自动发送成功后再清除
      console.log('🚀 Auto-generation setup from homepage:', {
        autoInput: autoInputContent.substring(0, 50) + '...',
        willAutoGenerate: true,
      });
    }
  }, []);

  // Update title when flowchart data is loaded
  useEffect(() => {
    if (flowchart) {
      const title = flowchart.title || 'Untitled';
      setCurrentTitle(title);
      setTempTitle(title);
      console.log('✅ Flowchart data loaded:', flowchart.title);
    }
  }, [flowchart]);

  // Show loading state when fetching flowchart data or when data is not ready
  if (currentFlowchartId && (loading || !flowchart)) {
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
  if (currentFlowchartId && error) {
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
        {/* Title Bar - only show for logged in users */}
        {currentUser && (
          <div className="absolute top-4 left-20 z-10 flex items-center">
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Title Display/Edit */}
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <Input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleTitleEditSave}
                    className="h-8 px-2 text-sm font-medium min-w-32 max-w-64 bg-white/90 border-gray-300"
                    autoFocus
                    placeholder="Enter title..."
                  />
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-800 max-w-64 truncate">
                      {currentTitle}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTitleEditStart}
                      className="h-6 w-6 p-0 hover:bg-gray-100/50"
                    >
                      <Edit className="h-3 w-3 text-gray-600" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top Right Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Save Button - only show for logged in users */}
          {currentUser && (
            <SaveButton
              excalidrawAPI={excalidrawAPI}
              flowchartId={currentFlowchartId}
              flowchartTitle={currentTitle}
              onFlowchartIdChange={handleFlowchartIdChange}
            />
          )}

          {/* User Button/Sign In button */}
          {currentUser ? (
            <UserButton user={currentUser} />
          ) : (
            <LoginWrapper mode="modal" asChild callbackUrl={currentPath}>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                <span>Sign In</span>
              </Button>
            </LoginWrapper>
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
          key={flowchart ? flowchart.id : 'new'}
          excalidrawAPI={(api) => {
            setExcalidrawAPI(api);
            setIsAPIReady(true);
            console.log('✅ ExcalidrawAPI initialized and ready');
          }}
          initialData={initialData}
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
            {/* Custom Social Links */}
            {websiteConfig.metadata.social?.github && (
              <MainMenu.Item
                onSelect={() =>
                  window.open(websiteConfig.metadata.social?.github!, '_blank')
                }
              >
                GitHub
              </MainMenu.Item>
            )}
            {websiteConfig.metadata.social?.discord && (
              <MainMenu.Item
                onSelect={() =>
                  window.open(websiteConfig.metadata.social?.discord!, '_blank')
                }
              >
                Discord
              </MainMenu.Item>
            )}
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
            maxWidth={500}
          />
        </div>
      )}

      {/* AI Chat Sidebar */}
      <AiChatSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        excalidrawAPI={excalidrawAPI}
        isAPIReady={isAPIReady}
        width={sidebarWidth}
        autoInput={autoInput}
        shouldAutoGenerate={shouldAutoGenerate}
        onAutoGenerateComplete={() => {
          setAutoInput('');
          setShouldAutoGenerate(false);
        }}
      />
    </div>
  );
};

export default ExcalidrawWrapper;
