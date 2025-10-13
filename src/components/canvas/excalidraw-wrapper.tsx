'use client';

import {
  Excalidraw,
  MainMenu,
  exportToBlob,
  exportToClipboard,
  exportToSvg,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { websiteConfig } from '@/config/website';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFlowchart } from '@/hooks/use-flowchart';
import { useLocalePathname } from '@/i18n/navigation';
import {
  type AiAssistantMode,
  DEFAULT_AI_ASSISTANT_MODE,
} from '@/lib/ai-modes';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import { cn } from '@/lib/utils';
import {
  Check,
  Copy,
  Download,
  Edit,
  FileImage,
  FileText,
  Loader2Icon,
  User,
  XIcon,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
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

  const router = useRouter();
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const { flowchart, loading, error } = useFlowchart(currentFlowchartId);

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('png');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState<string>('');

  // Export formats configuration (without icons)
  const exportFormats = [
    {
      id: 'png',
      title: 'PNG Image',
      description: 'Perfect for web sharing, documents, and presentations',
      extension: 'png'
    },
    {
      id: 'svg',
      title: 'SVG Vector',
      description: 'Scalable format, ideal for editing and high-quality exports',
      extension: 'svg'
    },
    {
      id: 'json',
      title: 'Excalidraw File',
      description: 'Native format for editing in Excalidraw later',
      extension: 'excalidraw'
    }
  ];

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

  // Export modal function
  const handleExportWithModal = async (format: string) => {
    if (!excalidrawAPI) return;

    setIsExporting(true);
    setExportStatus('idle');
    setExportError('');

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (!elements || elements.length === 0) {
        throw new Error('Canvas is empty. Please draw something before exporting.');
      }

      let blob: Blob;
      let filename: string;

      switch (format) {
        case 'png':
          blob = await exportToBlob({
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
          filename = `${currentTitle || 'flowchart'}.png`;
          break;

        case 'svg':
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
          blob = new Blob([svgData], { type: 'image/svg+xml' });
          filename = `${currentTitle || 'flowchart'}.svg`;
          break;

        case 'json':
          const { collaborators, ...cleanAppState } = appState;
          const exportData = {
            type: 'excalidraw',
            version: 2,
            source: 'https://excalidraw.com',
            elements,
            appState: cleanAppState,
            files,
          };
          const jsonData = JSON.stringify(exportData, null, 2);
          blob = new Blob([jsonData], { type: 'application/json' });
          filename = `${currentTitle || 'flowchart'}.excalidraw`;
          break;

        default:
          throw new Error('Unsupported format');
      }

      // Download file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => {
        setIsExportModalOpen(false);
        setExportStatus('idle');
      }, 1500);

    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
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

  // Show loading state when fetching flowchart data or when data is not ready
  if (currentFlowchartId && (loading || !flowchart)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2Icon className="animate-spin h-12 w-12 text-primary" />
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
                excalidrawAPI={excalidrawAPI}
                flowchartId={currentFlowchartId}
                flowchartTitle={currentTitle}
                onFlowchartIdChange={handleFlowchartIdChange}
                isMerged={true}
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

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsExportModalOpen(false)}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative mx-4 w-full max-w-md bg-white rounded-xl border-2 border-white shadow-xl md:mx-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <motion.button
                className="absolute -top-16 right-0 rounded-full bg-neutral-900/50 p-2 text-xl text-white ring-1 backdrop-blur-md hover:bg-neutral-900/70 transition-colors"
                onClick={() => setIsExportModalOpen(false)}
              >
                <XIcon className="size-5" />
              </motion.button>

              {/* Export options content */}
              <div className="p-5">
                <div className="pb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Export Flowchart
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose your preferred export format
                  </p>
                </div>

                {/* Export status */}
                {exportStatus === 'success' && (
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center gap-2 text-green-800">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Export successful!</span>
                    </div>
                  </div>
                )}

                {exportStatus === 'error' && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{exportError}</span>
                    </div>
                  </div>
                )}

                <div className="grid gap-2 pb-4">
                  {exportFormats.map((format) => (
                    <Card
                      key={format.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-sm",
                        selectedFormat === format.id
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                      onClick={() => setSelectedFormat(format.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{format.title}</h3>
                            <p className="text-xs text-gray-600 mt-1">{format.description}</p>
                          </div>
                          {selectedFormat === format.id && (
                            <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsExportModalOpen(false)}
                    disabled={isExporting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleExportWithModal(selectedFormat)}
                    disabled={isExporting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Exporting...
                      </>
                    ) : (
                      `Export ${exportFormats.find(f => f.id === selectedFormat)?.title}`
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Chat Sidebar */}
      <AiChatSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        excalidrawAPI={excalidrawAPI}
        isAPIReady={isAPIReady}
        width={sidebarWidth}
        autoInput={autoInput}
        shouldAutoGenerate={shouldAutoGenerate}
        initialMode={initialMode}
        initialImage={autoImagePayload}
        onAutoGenerateComplete={() => {
          setAutoInput('');
          setAutoImagePayload(null);
          setShouldAutoGenerate(false);
          localStorage.removeItem('flowchart_auto_mode');
          localStorage.removeItem('flowchart_auto_image');
        }}
      />
    </div>
  );
};

export default ExcalidrawWrapper;
