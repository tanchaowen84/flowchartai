'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { websiteConfig } from '@/config/website';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { FlowchartData } from '@/hooks/use-flowchart';
import { useFlowchartSave } from '@/hooks/use-flowchart-save';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocalePathname } from '@/i18n/navigation';
import {
  type AiAssistantMode,
  DEFAULT_AI_ASSISTANT_MODE,
} from '@/lib/ai-modes';
import type { FlowchartAiMetadata } from '@/lib/diagram/contracts';
import {
  deriveFlowchartAiMetadataFromElements,
  emptyFlowchartAiMetadata,
  parseFlowchartAiMetadata,
} from '@/lib/diagram/metadata';
import { createSavedSceneHydrationUpdate } from '@/lib/diagram/saved-scene-hydration';
import { getFlowchartContentFingerprint } from '@/lib/flowchart-autosave';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import {
  AlertCircle,
  Copy,
  Download,
  Edit,
  FileImage,
  FileText,
  Loader2Icon,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResizableDivider from './resizable-divider';
import { SaveButton } from './save-button';

interface ExcalidrawWrapperProps {
  className?: string;
  flowchartId?: string;
  initialFlowchart?: FlowchartData | null;
  isFlowchartLoading?: boolean;
  flowchartLoadError?: string | null;
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

const AiChatSidebar = dynamic(() => import('./ai-chat-sidebar'), {
  ssr: false,
  loading: () => (
    <div className="fixed right-0 top-0 z-40 flex h-full w-screen items-center justify-center bg-white text-sm text-gray-500 shadow-lg md:w-[400px]">
      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
      Loading assistant…
    </div>
  ),
});

const CanvasExportModal = dynamic(() => import('./canvas-export-modal'), {
  ssr: false,
});

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
  className,
  flowchartId,
  initialFlowchart = null,
  isFlowchartLoading = false,
  flowchartLoadError = null,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [currentFlowchartId, setCurrentFlowchartId] = useState(flowchartId);
  const [currentTitle, setCurrentTitle] = useState<string>('Untitled');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('Untitled');
  const [autoInput, setAutoInput] = useState<string>('');
  const [autoImagePayload, setAutoImagePayload] = useState<{
    base64: string;
    thumbnail?: string;
    filename?: string;
  } | null>(null);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);
  const [initialMode, setInitialMode] = useState<AiAssistantMode>(
    DEFAULT_AI_ASSISTANT_MODE
  );
  const [flowchartAiMetadata, setFlowchartAiMetadata] =
    useState<FlowchartAiMetadata>(() => emptyFlowchartAiMetadata());
  const [isSavedSceneLoaded, setIsSavedSceneLoaded] = useState(
    () => !flowchartId || Boolean(initialFlowchart?.content)
  );
  const loadedFlowchartContentRef = useRef<string | null>(
    initialFlowchart?.content || null
  );
  const lastContentFingerprintRef = useRef<string | null>(null);
  const suppressNextSceneAutosaveRef = useRef(false);

  const router = useRouter();
  const isMobile = useIsMobile();
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const flowchart = initialFlowchart;
  const loading = isFlowchartLoading;
  const error = flowchartLoadError;

  const handleFlowchartIdChange = useCallback((newId: string): void => {
    setCurrentFlowchartId(newId);
  }, []);

  const {
    saveNow,
    markChanged,
    retry: retrySave,
    status: saveStatus,
    error: saveError,
  } = useFlowchartSave(
    excalidrawAPI,
    currentFlowchartId,
    currentTitle,
    flowchartAiMetadata,
    handleFlowchartIdChange
  );

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Compute initial data based on flowchart content
  const initialData = useMemo((): ExcalidrawInitialDataState => {
    if (flowchart?.content) {
      return parseFlowchartData(flowchart.content);
    }
    return defaultInitialData;
  }, [flowchart?.content]);

  useEffect(() => {
    performance.mark('flowchartai:shellVisible');
  }, []);

  useEffect(() => {
    setFlowchartAiMetadata(
      flowchart?.content
        ? parseFlowchartAiMetadata(flowchart.content)
        : emptyFlowchartAiMetadata()
    );
  }, [flowchart?.content]);

  useEffect(() => {
    if (
      !excalidrawAPI ||
      !flowchart?.content ||
      loadedFlowchartContentRef.current === flowchart.content
    ) {
      return;
    }

    const parsed = parseFlowchartData(flowchart.content);
    suppressNextSceneAutosaveRef.current = true;
    if (parsed.files) {
      excalidrawAPI.addFiles(Object.values(parsed.files));
    }
    excalidrawAPI.updateScene(
      createSavedSceneHydrationUpdate({
        elements: parsed.elements || [],
        appState: parsed.appState as any,
      })
    );
    window.requestAnimationFrame(() => {
      suppressNextSceneAutosaveRef.current = false;
    });
    loadedFlowchartContentRef.current = flowchart.content;
    setIsSavedSceneLoaded(true);
    performance.mark('flowchartai:savedSceneVisible');
  }, [excalidrawAPI, flowchart]);

  useEffect(() => {
    if (isAPIReady && flowchart?.content) {
      performance.mark('flowchartai:savedSceneVisible');
    }
  }, [flowchart?.content, isAPIReady]);

  const isCanvasReady =
    isAPIReady && (!currentFlowchartId || isSavedSceneLoaded);

  const handleSceneChange = useCallback(
    (elements: readonly any[], _appState: any, files: any) => {
      const contentFingerprint = getFlowchartContentFingerprint(
        elements,
        files ?? {}
      );
      const hasBaseline = lastContentFingerprintRef.current !== null;
      const contentChanged =
        hasBaseline && contentFingerprint !== lastContentFingerprintRef.current;

      lastContentFingerprintRef.current = contentFingerprint;

      setFlowchartAiMetadata((current) => {
        const next = deriveFlowchartAiMetadataFromElements(elements, current);
        return JSON.stringify(next) === JSON.stringify(current)
          ? current
          : next;
      });

      if (suppressNextSceneAutosaveRef.current) {
        return;
      }
      if (contentChanged && currentUser) markChanged();
    },
    [currentUser, markChanged]
  );

  const handleFlowchartAiMetadataChange = useCallback(
    (metadata: FlowchartAiMetadata): void => {
      setFlowchartAiMetadata(metadata);
      if (currentUser) markChanged();
    },
    [currentUser, markChanged]
  );

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

  const handleTitleChange = (newTitle: string): void => {
    setCurrentTitle(newTitle);
    if (currentUser) markChanged();
  };

  const handleTitleEditStart = () => {
    setTempTitle(currentTitle);
    setIsEditingTitle(true);
  };

  const handleTitleEditSave = async () => {
    if (tempTitle.trim()) {
      handleTitleChange(tempTitle.trim());
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

  // Export functions
  const handleExportPNG = async () => {
    if (!excalidrawAPI || !isAPIReady) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (!elements || elements.length === 0) {
        alert('Canvas is empty. Please draw something before exporting.');
        return;
      }

      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          exportWithDarkMode: false,
        },
        files,
        mimeType: 'image/png',
        quality: 0.92,
        exportPadding: 20,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentTitle || 'flowchart'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Failed to export PNG. Please try again.');
    }
  };

  const handleExportSVG = async () => {
    if (!excalidrawAPI || !isAPIReady) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (!elements || elements.length === 0) {
        alert('Canvas is empty. Please draw something before exporting.');
        return;
      }

      const { exportToSvg } = await import('@excalidraw/excalidraw');
      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          exportWithDarkMode: false,
        },
        files,
        exportPadding: 20,
      });

      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentTitle || 'flowchart'}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting SVG:', error);
      alert('Failed to export SVG. Please try again.');
    }
  };

  const handleExportJSON = async () => {
    if (!excalidrawAPI || !isAPIReady) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (!elements || elements.length === 0) {
        alert('Canvas is empty. Please draw something before exporting.');
        return;
      }

      // Filter out runtime properties that shouldn't be saved
      const { collaborators, ...cleanAppState } = appState;

      const exportData = {
        type: 'excalidraw',
        version: 2,
        source: 'https://excalidraw.com',
        elements,
        appState: cleanAppState,
        files,
        flowchartAi: flowchartAiMetadata,
      };

      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentTitle || 'flowchart'}.excalidraw`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON. Please try again.');
    }
  };

  const handleCopyToClipboard = async (format: 'png' | 'svg' | 'json') => {
    if (!excalidrawAPI || !isAPIReady) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (!elements || elements.length === 0) {
        alert('Canvas is empty. Please draw something before copying.');
        return;
      }

      const { exportToClipboard } = await import('@excalidraw/excalidraw');
      await exportToClipboard({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          exportWithDarkMode: false,
        },
        files,
        type: format,
        quality: 0.92,
      });

      alert(`${format.toUpperCase()} copied to clipboard!`);
    } catch (error) {
      console.error(`Error copying ${format} to clipboard:`, error);
      alert(
        `Failed to copy ${format.toUpperCase()} to clipboard. Please try again.`
      );
    }
  };

  // Check for auto-generation from homepage
  useEffect(() => {
    const autoGenerate = localStorage.getItem('flowchart_auto_generate');
    const autoInputContent = localStorage.getItem('flowchart_auto_input');
    const storedMode = localStorage.getItem('flowchart_auto_mode');
    const autoImage = localStorage.getItem('flowchart_auto_image');
    const autoMode: AiAssistantMode = storedMode
      ? (storedMode as AiAssistantMode)
      : DEFAULT_AI_ASSISTANT_MODE;

    if (storedMode) {
      setInitialMode(autoMode);
    }

    const hasAutoInput = autoInputContent !== null;
    const hasAutoImage = !!autoImage;

    if (autoGenerate === 'true' && (hasAutoInput || hasAutoImage)) {
      setAutoInput(autoInputContent ?? '');
      setShouldAutoGenerate(true);
      setIsSidebarOpen(true);

      if (autoImage) {
        try {
          const imagePayload = JSON.parse(autoImage) as {
            base64: string;
            thumbnail?: string;
            filename?: string;
          };
          setAutoImagePayload(imagePayload);
          console.log('🖼️ Loaded homepage image payload');
        } catch (err) {
          console.error('Failed to parse homepage image payload', err);
        }
      }

      console.log('🚀 Auto-generation setup from homepage:', {
        autoInput: (autoInputContent ?? '').substring(0, 50) + '...',
        autoMode,
        hasImage: hasAutoImage,
        willAutoGenerate: true,
      });
    } else if (storedMode) {
      // 打开侧边栏以便用户直接切换到对应模式
      setIsSidebarOpen(true);
      localStorage.removeItem('flowchart_auto_generate');
      localStorage.removeItem('flowchart_auto_input');
      localStorage.removeItem('flowchart_auto_mode');
      localStorage.removeItem('flowchart_auto_image');
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

  return (
    <div className={`h-screen w-screen flex ${className || ''}`}>
      {/* Main Canvas Area */}
      <div
        className={`relative h-full ${
          isResizing ? '' : 'transition-all duration-300 ease-in-out'
        }`}
        style={{
          width:
            isSidebarOpen && !isMobile
              ? `calc(100% - ${sidebarWidth}px)`
              : '100%',
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
          {/* Export | Save Button - only show for logged in users */}
          {currentUser && (
            <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200">
              {/* Export Button */}
              <Button
                onClick={() => setIsExportModalOpen(true)}
                disabled={!excalidrawAPI}
                variant="ghost"
                size="sm"
                className="h-9 px-4 rounded-l-lg rounded-r-none border-r border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Export</span>
              </Button>

              {/* Save Button - use existing SaveButton logic */}
              <SaveButton
                status={saveStatus}
                onSave={saveNow}
                onRetry={retrySave}
                disabled={!excalidrawAPI}
                error={saveError}
                isMerged
              />
            </div>
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
              className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-500 text-white shadow-sm hover:bg-blue-600 hover:border-blue-300 transition-colors duration-200"
            >
              AI Assistant
            </Button>
          )}
        </div>

        <Excalidraw
          onChange={handleSceneChange}
          excalidrawAPI={(api) => {
            setExcalidrawAPI(api);
            setIsAPIReady(true);
            performance.mark('flowchartai:excalidrawApiReady');
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
              saveAsImage: true, // Enable "Save as image" button
            },
            dockedSidebarBreakpoint: 0, // Hide the default library sidebar
          }}
        >
          <MainMenu>
            <MainMenu.Item onSelect={handleGoHome}>Back To Home</MainMenu.Item>

            {/* Export Options Group */}
            <MainMenu.Group title="Export">
              <MainMenu.Item
                onSelect={handleExportPNG}
                icon={<FileImage className="h-4 w-4" />}
              >
                Export as PNG
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={handleExportSVG}
                icon={<FileText className="h-4 w-4" />}
              >
                Export as SVG
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={handleExportJSON}
                icon={<Download className="h-4 w-4" />}
              >
                Export as Excalidraw
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={() => handleCopyToClipboard('png')}
                icon={<Copy className="h-4 w-4" />}
              >
                Copy PNG to Clipboard
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={() => handleCopyToClipboard('svg')}
                icon={<Copy className="h-4 w-4" />}
              >
                Copy SVG to Clipboard
              </MainMenu.Item>
            </MainMenu.Group>

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
          </MainMenu>
        </Excalidraw>

        {currentFlowchartId && !isSavedSceneLoaded && !error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="inline-flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
              <Loader2Icon className="h-5 w-5 animate-spin text-primary" />
              <span>
                {loading ? 'Loading saved flowchart…' : 'Preparing canvas…'}
              </span>
            </div>
          </div>
        )}

        {currentFlowchartId && error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/95">
            <div className="flex max-w-md flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-800">
                Failed to load flowchart
              </h2>
              <p className="text-sm text-gray-600">{error}</p>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resizable Divider - only show when sidebar is open */}
      {isSidebarOpen && !isMobile && (
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

      {/* Export Modal */}
      {isExportModalOpen && excalidrawAPI && (
        <CanvasExportModal
          excalidrawAPI={excalidrawAPI}
          flowchartAiMetadata={flowchartAiMetadata}
          onClose={() => setIsExportModalOpen(false)}
          title={currentTitle}
        />
      )}

      {/* AI Chat Sidebar */}
      {isCanvasReady && (
        <AiChatSidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          excalidrawAPI={excalidrawAPI}
          isAPIReady={isCanvasReady}
          width={sidebarWidth}
          flowchartId={currentFlowchartId}
          autoInput={autoInput}
          shouldAutoGenerate={shouldAutoGenerate}
          initialMode={initialMode}
          initialImage={autoImagePayload}
          flowchartAiMetadata={flowchartAiMetadata}
          onFlowchartAiMetadataChange={handleFlowchartAiMetadataChange}
          onReady={() => performance.mark('flowchartai:chatReady')}
          onAutoGenerateComplete={() => {
            setAutoInput('');
            setAutoImagePayload(null);
            setShouldAutoGenerate(false);
            localStorage.removeItem('flowchart_auto_mode');
            localStorage.removeItem('flowchart_auto_image');
          }}
        />
      )}
    </div>
  );
};

export default ExcalidrawWrapper;
