'use client';

import { LoginForm } from '@/components/auth/login-form';
import { AIUsageLimitCard } from '@/components/shared/ai-usage-limit-card';
import { GuestUsageIndicator } from '@/components/shared/guest-usage-indicator';
import MarkdownRenderer from '@/components/shared/markdown-renderer';
import { PricingModal } from '@/components/shared/pricing-modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAIUsageLimit } from '@/hooks/use-ai-usage-limit';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useGuestAIUsage } from '@/hooks/use-guest-ai-usage';
import { toast } from '@/hooks/use-toast';
import { useLocalePathname } from '@/i18n/navigation';
import {
  AI_ASSISTANT_MODES,
  type AiAssistantMode,
  DEFAULT_AI_ASSISTANT_MODE,
} from '@/lib/ai-modes';
import { generateAICanvasDescription } from '@/lib/canvas-analyzer';
import { prepareCanvasCommand } from '@/lib/diagram/canvas-command-executor';
import {
  type CanvasCommand,
  type FlowchartAiMetadata,
  canvasCommandSchema,
} from '@/lib/diagram/contracts';
import { deriveFlowchartAiMetadataFromElements } from '@/lib/diagram/metadata';
import { resolveDiagramTarget } from '@/lib/diagram/target-resolver';
import {
  buildRetryConversation,
  getCanvasChatStorageKey,
  parseCanvasChatSession,
  sanitizeCanvasChatMessagesForStorage,
  serializeCanvasChatSession,
} from '@/lib/mastra/chat-session-storage';
import { createSseEventDecoder } from '@/lib/mastra/sse-client';
import { createCanvasUsageGate } from '@/lib/mastra/usage-gate';
import {
  extractExistingMermaidCode,
  hasExistingAiFlowchart,
  preloadMermaidConverter,
} from '@/lib/mermaid-converter';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  AlertCircle,
  ArrowUp,
  Loader2,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface Message {
  id: string;
  content: string | MessageContent[];
  role: 'user' | 'assistant';
  timestamp: Date;
  isFlowchart?: boolean;
  mermaidCode?: string;
  error?: string;
  images?: {
    file: File;
    thumbnail: string;
    base64: string;
  }[];
}

interface AiChatSidebarProps {
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
  isAPIReady?: boolean;
  width?: number;
  flowchartId?: string;
  autoInput?: string;
  shouldAutoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
  initialMode?: AiAssistantMode;
  initialImage?: {
    base64: string;
    thumbnail?: string;
    filename?: string;
  } | null;
  flowchartAiMetadata: FlowchartAiMetadata;
  onFlowchartAiMetadataChange: (metadata: FlowchartAiMetadata) => void;
  onReady?: () => void;
}

function getUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  const typedError = error as (Error & { userFacingMessage?: string }) | null;

  if (
    error instanceof Error &&
    typeof typedError?.userFacingMessage === 'string'
  ) {
    return typedError.userFacingMessage;
  }

  return fallbackMessage;
}

const ASSISTANT_THINKING_STATUS = 'Thinking...';
const FLOWCHART_EDITING_STATUS = 'Editing...';
const FLOWCHART_RENDERING_STATUS = 'Rendering...';

type AssistantResponsePhase = 'idle' | 'thinking' | 'editing' | 'rendering';

function markFlowchartPerformance(name: string): void {
  if (typeof performance !== 'undefined') {
    performance.mark(`flowchartai:${name}`);
  }
}

function waitForNextPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

const AiChatSidebar: React.FC<AiChatSidebarProps> = ({
  className,
  isOpen,
  onToggle,
  excalidrawAPI,
  isAPIReady = false,
  width = 400,
  flowchartId,
  autoInput,
  shouldAutoGenerate,
  onAutoGenerateComplete,
  initialMode,
  initialImage,
  flowchartAiMetadata,
  onFlowchartAiMetadataChange,
  onReady,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [assistantResponsePhase, setAssistantResponsePhase] =
    useState<AssistantResponsePhase>('idle');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [showUsageLimitCard, setShowUsageLimitCard] = useState(false);
  const [dailyLimitUsageInfo, setDailyLimitUsageInfo] = useState<any>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCallbackUrl, setLoginCallbackUrl] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AiAssistantMode>(
    initialMode ?? DEFAULT_AI_ASSISTANT_MODE
  );
  const [isChatHydrated, setIsChatHydrated] = useState(false);
  const hasAutoSentRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const hasReportedReadyRef = useRef(false);
  const chatStorageKeyRef = useRef<string | null>(null);
  const latestChatStateRef = useRef({ messages, input, aiMode });

  latestChatStateRef.current = { messages, input, aiMode };

  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const { usageData, checkUsageLimit, refreshUsageData } = useAIUsageLimit();
  const { handleLimitReached: handleGuestLimitReached } = useGuestAIUsage();

  const activeSendStatus = sendStatus;

  useEffect(() => {
    if (!hasReportedReadyRef.current) {
      hasReportedReadyRef.current = true;
      onReady?.();
    }
  }, [onReady]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        // 使用 smooth 滚动以获得更好的用户体验
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  };

  // Auto-resize textarea based on content with proper line wrapping
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Calculate new height based on content
      const minHeight = 80;
      const maxHeight = 200;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize textarea height on mount and when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  useEffect(() => {
    if (initialMode) {
      setAiMode(initialMode);
    }
  }, [initialMode]);

  const chatStorageKey = getCanvasChatStorageKey(flowchartId);

  useEffect(() => {
    setIsChatHydrated(false);

    const previousKey = chatStorageKeyRef.current;
    const unsavedKey = getCanvasChatStorageKey();
    let serialized = localStorage.getItem(chatStorageKey);

    if (!serialized && flowchartId && previousKey === unsavedKey) {
      serialized = localStorage.getItem(unsavedKey);
      if (!serialized) {
        const latest = latestChatStateRef.current;
        serialized = serializeCanvasChatSession({
          version: 1,
          draft: latest.input,
          mode: latest.aiMode,
          messages: sanitizeCanvasChatMessagesForStorage(
            latest.messages.map(({ images: _images, ...message }) => message)
          ),
        });
      }

      try {
        localStorage.setItem(chatStorageKey, serialized);
        localStorage.removeItem(unsavedKey);
      } catch {
        // Keep the active in-memory session when storage is unavailable.
      }
    }

    const storedSession = parseCanvasChatSession(serialized);
    if (storedSession) {
      setMessages(storedSession.messages);
      setInput(storedSession.draft);
      setAiMode(storedSession.mode);
    } else if (previousKey && previousKey !== chatStorageKey) {
      setMessages([]);
      setInput('');
      setAiMode(initialMode ?? DEFAULT_AI_ASSISTANT_MODE);
    }

    chatStorageKeyRef.current = chatStorageKey;
    setIsChatHydrated(true);
  }, [chatStorageKey, flowchartId, initialMode]);

  useEffect(() => {
    if (!isChatHydrated) return;

    try {
      localStorage.setItem(
        chatStorageKey,
        serializeCanvasChatSession({
          version: 1,
          draft: input,
          mode: aiMode,
          messages: sanitizeCanvasChatMessagesForStorage(
            messages.map(({ images: _images, ...message }) => message)
          ),
        })
      );
    } catch {
      // Chat remains available for the current session if storage is full.
    }
  }, [aiMode, chatStorageKey, input, isChatHydrated, messages]);

  useEffect(() => {
    if (initialImage) {
      canvasContextRef.current.homepageImage = initialImage;
    } else {
      canvasContextRef.current.homepageImage = undefined;
    }
  }, [initialImage]);

  useEffect(() => {
    if (!isAPIReady) return;
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const preload = () => {
      void preloadMermaidConverter().catch(() => undefined);
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(preload);
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timeoutId = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [isAPIReady]);

  // Auto-adjust textarea height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // Auto-send function that bypasses input state
  const handleAutoSendMessage = async (messageText: string) => {
    const homepageImage = canvasContextRef.current.homepageImage;
    const trimmed = messageText.trim();

    if ((!trimmed && !homepageImage) || isLoading) {
      return;
    }

    // Check if user is guest and show login modal instead of processing request
    if (!currentUser) {
      // Generate callback URL to preserve current state
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      setLoginCallbackUrl(callbackUrl);
      setShowLoginModal(true);
      return;
    }

    setIsLoading(true);
    setSendStatus(null);

    // Create user message with the provided text
    const mimeMatch = homepageImage?.base64?.match(/^data:(.*?);/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const filename =
      homepageImage?.filename ||
      `uploaded-image.${mimeType.split('/')[1] || 'png'}`;

    let messageContent: string | MessageContent[] = trimmed;
    let messageImages: { file: File; thumbnail: string; base64: string }[] = [];

    if (homepageImage && aiMode === 'image_to_flowchart') {
      messageImages = [
        {
          file: new File([], filename, { type: mimeType }),
          thumbnail: homepageImage.thumbnail || homepageImage.base64,
          base64: homepageImage.base64,
        },
      ];
      messageContent = [
        ...(trimmed
          ? [
              {
                type: 'text' as const,
                text: trimmed,
              },
            ]
          : []),
        {
          type: 'image_url' as const,
          image_url: {
            url: homepageImage.base64,
          },
        },
      ];
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
      images: messageImages.length > 0 ? messageImages : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    if (homepageImage && aiMode === 'image_to_flowchart') {
      canvasContextRef.current.homepageImage = undefined;
      localStorage.removeItem('flowchart_auto_image');
    }
    setIsStreamingResponse(true);
    setAssistantResponsePhase('thinking');

    try {
      await waitForNextPaint();

      // Logged in user - check subscription limits after rendering the user's message
      const canUseAI = await checkUsageLimit();
      if (!canUseAI) {
        setIsLoading(false);
        setSendStatus(null);
        setIsStreamingResponse(false);
        setAssistantResponsePhase('idle');
        // Check if it's a daily limit for free users
        if (usageData?.timeFrame === 'daily') {
          console.log(
            '🎯 Daily limit detected - showing PricingModal directly'
          );
          // Set daily limit context and show pricing modal directly
          setDailyLimitUsageInfo({
            timeFrame: 'daily',
            nextResetTime: usageData.nextResetTime,
          });
          setShowPricingModal(true);
        } else {
          setShowUsageLimitCard(true);
        }
        return;
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      await processAIConversation([
        // Send complete conversation history for context
        ...messages.map((msg) => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content,
        })),
        {
          role: 'user',
          content: userMessage.content,
        },
      ]);

      // 移除访客使用标记，改为在流程图成功生成后计费
      // if (!currentUser) {
      //   markGuestAsUsed();
      // }
    } catch (error) {
      console.error('Error sending auto message:', error);
      // Handle errors similar to handleSendMessage
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (error instanceof Error && (error as any).isGuestLimit) {
        if (!currentUser) {
          handleGuestLimitReached();
          setShowLoginModal(true);
          return;
        }
      }

      if (error instanceof Error && (error as any).isDailyLimit) {
        if (currentUser) {
          console.log(
            '✅ Showing PricingModal with daily limit context for registered user'
          );
          setDailyLimitUsageInfo((error as any).usageInfo);
          setShowPricingModal(true);
          return;
        }
      }

      const userFacingMessage = getUserFacingErrorMessage(
        error,
        'Sorry, I encountered an error while processing your request. Please try again.'
      );

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: userFacingMessage,
        role: 'assistant',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Error',
        description: userFacingMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setSendStatus(null);
      setAssistantResponsePhase('idle');
      abortControllerRef.current = null;
      setIsStreamingResponse(false);
      streamingMessageIdRef.current = null;
    }
  };

  // Handle auto-generation from homepage - ONLY ONCE
  useEffect(() => {
    const hasHomepageImage = !!canvasContextRef.current.homepageImage;
    const normalizedAutoInput = autoInput ?? '';

    if (
      shouldAutoGenerate &&
      (normalizedAutoInput || hasHomepageImage) &&
      isOpen &&
      isAPIReady &&
      !hasAutoSentRef.current
    ) {
      hasAutoSentRef.current = true; // Immediately mark as sent to prevent any duplicates
      setInput(normalizedAutoInput);

      console.log(
        '🚀 Auto-sending message now that API is ready:',
        normalizedAutoInput.substring(0, 50) + '...',
        {
          shouldAutoGenerate,
          hasAutoInput: Boolean(normalizedAutoInput),
          hasHomepageImage,
          isOpen,
          isAPIReady,
          hasAutoSent: hasAutoSentRef.current,
        }
      );

      // Small delay to ensure component is fully loaded
      setTimeout(async () => {
        try {
          await handleAutoSendMessage(normalizedAutoInput);

          // 🔧 只有在自动发送成功后才清除localStorage
          localStorage.removeItem('flowchart_auto_generate');
          localStorage.removeItem('flowchart_auto_input');
          localStorage.removeItem('flowchart_auto_mode');
          console.log('✅ Auto-generation completed, localStorage cleared');

          onAutoGenerateComplete?.();
        } catch (error) {
          console.error('❌ Auto-generation failed:', error);
          // 如果失败，不清除localStorage，允许用户重试
        }
      }, 500);
    }
  }, [shouldAutoGenerate, autoInput, isOpen, isAPIReady]);

  // 🔧 备用机制：如果API初始化很慢，提供一个超时重试
  useEffect(() => {
    const hasHomepageImage = !!canvasContextRef.current.homepageImage;
    const normalizedAutoInput = autoInput ?? '';

    if (
      shouldAutoGenerate &&
      (normalizedAutoInput || hasHomepageImage) &&
      isOpen &&
      !hasAutoSentRef.current
    ) {
      // 如果5秒后API还没准备好，尝试强制发送
      const timeoutId = setTimeout(() => {
        if (!hasAutoSentRef.current) {
          console.log(
            '⏰ API initialization timeout, attempting force send...'
          );
          if (isAPIReady) {
            // API现在准备好了，正常发送
            hasAutoSentRef.current = true;
            setInput(normalizedAutoInput);
            setTimeout(async () => {
              try {
                await handleAutoSendMessage(normalizedAutoInput);
                localStorage.removeItem('flowchart_auto_generate');
                localStorage.removeItem('flowchart_auto_input');
                localStorage.removeItem('flowchart_auto_mode');
                localStorage.removeItem('flowchart_auto_image');
                console.log('✅ Force auto-generation completed');
                onAutoGenerateComplete?.();
              } catch (error) {
                console.error('❌ Force auto-generation failed:', error);
              }
            }, 500);
          } else {
            console.warn(
              '⚠️ ExcalidrawAPI still not ready after 5s, user will need to manually send'
            );
          }
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    }
  }, [shouldAutoGenerate, autoInput, isOpen, isAPIReady]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clean up image preview URLs
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Handle image selection
  const handleImageSelect = async (files: FileList | null) => {
    if (!files) return;

    const { isValidImageFile } = await import('@/lib/image-utils');

    const file = files[0];
    if (!file || !isValidImageFile(file)) {
      toast({
        title: 'Invalid file',
        description: `${file?.name || 'This file'} is not a valid image file or is too large (max 5MB)`,
        variant: 'destructive',
      });
      return;
    }

    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImages([file]);
    setImagePreviewUrls([URL.createObjectURL(file)]);
  };

  // Remove selected image
  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviewUrls((prev) => {
      const urlToRevoke = prev[index];
      URL.revokeObjectURL(urlToRevoke);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Handle camera button click
  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  interface CanvasNodeSnapshot {
    id: string;
    type: string;
    text?: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    aiGenerated?: boolean;
    diagramId?: string;
    semanticId?: string;
    entityType?: string;
  }

  interface CanvasEdgeSnapshot {
    id: string;
    type: string;
    fromElement?: string | null;
    toElement?: string | null;
    label?: string;
    aiGenerated?: boolean;
    diagramId?: string;
    semanticId?: string;
    entityType?: string;
  }

  const getCanvasState = () => {
    if (!excalidrawAPI) return null;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const nodes: CanvasNodeSnapshot[] = [];
      const edges: CanvasEdgeSnapshot[] = [];

      elements.forEach((element) => {
        const baseNode = {
          id: element.id,
          type: element.type,
          position: { x: element.x, y: element.y },
          size: { width: element.width ?? 0, height: element.height ?? 0 },
          aiGenerated: Boolean(element.customData?.aiGenerated),
          diagramId:
            typeof element.customData?.diagramId === 'string'
              ? element.customData.diagramId
              : undefined,
          semanticId:
            typeof element.customData?.semanticId === 'string'
              ? element.customData.semanticId
              : undefined,
          entityType:
            typeof element.customData?.entityType === 'string'
              ? element.customData.entityType
              : undefined,
        };

        if (element.type === 'arrow') {
          edges.push({
            id: element.id,
            type: element.type,
            fromElement:
              'startBinding' in element
                ? element.startBinding?.elementId
                : undefined,
            toElement:
              'endBinding' in element
                ? element.endBinding?.elementId
                : undefined,
            label: 'text' in element ? (element as any).text : undefined,
            aiGenerated: Boolean(element.customData?.aiGenerated),
            diagramId: baseNode.diagramId,
            semanticId: baseNode.semanticId,
            entityType: baseNode.entityType,
          });
        } else {
          nodes.push({
            ...baseNode,
            text: 'text' in element ? (element as any).text : undefined,
          });
        }
      });

      // 构建精简的画布状态，只包含AI需要的关键信息
      const canvasState = {
        nodes,
        edges,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
          theme: appState.theme,
          gridSize: appState.gridSize,
          // 当前选中的元素
          selectedElementIds: appState.selectedElementIds,
        },

        // 文件数量统计（不传递实际文件数据以节省带宽）
        filesCount: Object.keys(files).length,

        metadata: {
          elementsCount: elements.length,
          hasImages: Object.keys(files).length > 0,
          canvasSize: {
            width: appState.width,
            height: appState.height,
          },
        },

        // AI流程图上下文信息
        existingMermaid: extractExistingMermaidCode([...elements]),
        hasAiFlowchart: hasExistingAiFlowchart([...elements]),
        description: generateAICanvasDescription([...elements]),
      };

      return canvasState;
    } catch (error) {
      console.warn('Failed to get canvas state:', error);
      return null;
    }
  };

  const canvasContextRef = useRef<{
    lastMermaid?: {
      code: string;
      generatedAt: number;
    };
    homepageImage?: {
      base64: string;
      thumbnail?: string;
      filename?: string;
    };
  }>({});

  const applyCanvasCommand = async (command: CanvasCommand) => {
    if (!excalidrawAPI) {
      throw new Error('Canvas is not ready');
    }

    const usageGate = createCanvasUsageGate(async (metadata) => {
      try {
        const response = await fetch('/api/ai/usage/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'flowchart_generation',
            success: true,
            metadata,
          }),
        });
        if (!response.ok) {
          console.error('Failed to record AI usage:', response.status);
        }
      } catch (error) {
        console.error('Failed to record AI usage:', error);
      }
    });

    try {
      if (abortControllerRef.current?.signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      setAssistantResponsePhase('rendering');
      markFlowchartPerformance('renderStarted');
      await waitForNextPaint();
      const currentElements = [...excalidrawAPI.getSceneElements()];
      const currentMetadata = deriveFlowchartAiMetadataFromElements(
        currentElements,
        flowchartAiMetadata
      );
      const currentTargetResolution = resolveDiagramTarget({
        elements: currentElements,
        selectedElementIds: excalidrawAPI.getAppState().selectedElementIds,
        metadata: currentMetadata,
      });
      const prepared = await prepareCanvasCommand({
        command,
        currentElements,
        metadata: currentMetadata,
        targetResolution: currentTargetResolution,
      });

      if (abortControllerRef.current?.signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (Object.keys(prepared.files).length > 0) {
        excalidrawAPI.addFiles(Object.values(prepared.files) as any);
      }
      excalidrawAPI.updateScene({
        elements: prepared.nextElements as any,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      onFlowchartAiMetadataChange(prepared.nextMetadata);
      markFlowchartPerformance('canvasCommitted');

      if (prepared.operation !== 'patch' && prepared.focusElements.length > 0) {
        excalidrawAPI.scrollToContent(prepared.focusElements as any, {
          fitToContent: true,
          animate: true,
        });
      }

      canvasContextRef.current.lastMermaid = {
        code: prepared.sourceMermaid,
        generatedAt: Date.now(),
      };

      void usageGate.commit({
        operation: prepared.operation,
        diagramId: prepared.diagramId,
        sourceMode: aiMode,
        isImageMode: aiMode === 'image_to_flowchart',
        mermaidLength: prepared.sourceMermaid.length,
        elementCount: prepared.focusElements.length,
      });

      toast({
        title:
          prepared.operation === 'create'
            ? 'Flowchart added!'
            : 'Flowchart updated!',
        description:
          prepared.operation === 'patch'
            ? 'The selected part was updated; other canvas content was preserved.'
            : 'The target diagram was rendered on the canvas.',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        usageGate.abort();
      } else {
        usageGate.fail();
      }
      throw error;
    }
  };

  const handleRetry = async (failedAssistantId: string) => {
    if (isLoading) return;

    const retryMessages = buildRetryConversation(messages, failedAssistantId);
    if (!retryMessages) return;

    if (!currentUser) {
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      setLoginCallbackUrl(callbackUrl);
      setShowLoginModal(true);
      return;
    }

    setIsLoading(true);
    setSendStatus(null);
    setIsStreamingResponse(true);
    setAssistantResponsePhase('thinking');

    try {
      await waitForNextPaint();

      const canUseAI = await checkUsageLimit();
      if (!canUseAI) {
        if (usageData?.timeFrame === 'daily') {
          setDailyLimitUsageInfo({
            timeFrame: 'daily',
            nextResetTime: usageData.nextResetTime,
          });
          setShowPricingModal(true);
        } else {
          setShowUsageLimitCard(true);
        }
        return;
      }

      setMessages(retryMessages);
      abortControllerRef.current = new AbortController();
      await processAIConversation(
        retryMessages.map((message) => ({
          role: message.role,
          content: message.content,
        }))
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;

      if (error instanceof Error && (error as any).isDailyLimit) {
        setDailyLimitUsageInfo((error as any).usageInfo);
        setShowPricingModal(true);
        return;
      }

      const userFacingMessage = getUserFacingErrorMessage(
        error,
        'The request failed. Please try it again.'
      );
      setMessages((current) => [
        ...current,
        {
          id: `assistant_error_${Date.now()}`,
          content: userFacingMessage,
          role: 'assistant',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ]);

      toast({
        title: 'Request failed',
        description: userFacingMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setSendStatus(null);
      setAssistantResponsePhase('idle');
      abortControllerRef.current = null;
      setIsStreamingResponse(false);
      streamingMessageIdRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (
      (selectedImages.length === 0 &&
        !input.trim() &&
        !canvasContextRef.current.homepageImage) ||
      isLoading
    ) {
      return;
    }

    // Check if user is guest and show login modal instead of processing request
    if (!currentUser) {
      // Generate callback URL to preserve current state
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      setLoginCallbackUrl(callbackUrl);
      setShowLoginModal(true);
      return;
    }

    setIsLoading(true);
    setSendStatus(null);

    // Prepare message content
    let messageContent: string | MessageContent[] = input.trim();
    let messageImages: { file: File; thumbnail: string; base64: string }[] = [];

    const homepageImage = canvasContextRef.current.homepageImage;

    try {
      if (selectedImages.length > 0) {
        setSendStatus('Preparing your image...');
        const { createImageThumbnail, encodeImageToBase64 } = await import(
          '@/lib/image-utils'
        );
        // Convert images to base64 and create message content array
        const imageData = await Promise.all(
          selectedImages.map(async (file) => {
            const base64 = await encodeImageToBase64(file);
            const thumbnail = await createImageThumbnail(file);
            return { file, thumbnail, base64 };
          })
        );

        messageImages = imageData;

        // Create multimodal content
        const contentArray: MessageContent[] = [];

        if (input.trim()) {
          contentArray.push({
            type: 'text',
            text: input.trim(),
          });
        }

        for (const { base64 } of imageData) {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: base64,
            },
          });
        }

        messageContent = contentArray;
      } else if (homepageImage && aiMode === 'image_to_flowchart') {
        setSendStatus('Preparing your image...');
        const mimeMatch = homepageImage.base64.match(/^data:(.*?);/);
        const mimeType = mimeMatch?.[1] || 'image/png';
        const filename =
          homepageImage.filename ||
          `uploaded-image.${mimeType.split('/')[1] || 'png'}`;
        messageImages = [
          {
            file: new File([], filename, { type: mimeType }),
            thumbnail: homepageImage.thumbnail || homepageImage.base64,
            base64: homepageImage.base64,
          },
        ];

        messageContent = [
          ...(input.trim()
            ? [
                {
                  type: 'text' as const,
                  text: input.trim(),
                },
              ]
            : []),
          {
            type: 'image_url' as const,
            image_url: {
              url: homepageImage.base64,
            },
          },
        ];
      }
    } catch (error) {
      console.error('Failed to prepare message:', error);
      toast({
        title: 'Image preparation failed',
        description: 'Please try a smaller image or upload it again.',
        variant: 'destructive',
      });
      setIsLoading(false);
      setSendStatus(null);
      return;
    }

    const userMessageId = Date.now().toString();
    const userMessage: Message = {
      id: userMessageId,
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
      images: messageImages.length > 0 ? messageImages : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImages([]);
    setImagePreviewUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    if (homepageImage && aiMode === 'image_to_flowchart') {
      canvasContextRef.current.homepageImage = undefined;
      localStorage.removeItem('flowchart_auto_image');
    }
    setIsStreamingResponse(true);
    setAssistantResponsePhase('thinking');

    try {
      await waitForNextPaint();

      // Logged in user - check subscription limits after rendering the user's message
      const canUseAI = await checkUsageLimit();
      if (!canUseAI) {
        setIsLoading(false);
        setSendStatus(null);
        setIsStreamingResponse(false);
        setAssistantResponsePhase('idle');
        // Check if it's a daily limit for free users
        if (usageData?.timeFrame === 'daily') {
          console.log(
            '🎯 Daily limit detected - showing PricingModal directly'
          );
          // Set daily limit context and show pricing modal directly
          setDailyLimitUsageInfo({
            timeFrame: 'daily',
            nextResetTime: usageData.nextResetTime,
          });
          setShowPricingModal(true);
        } else {
          setShowUsageLimitCard(true);
        }
        return;
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const conversationPayload: any[] = [
        ...messages.map((msg) => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content,
        })),
        {
          role: 'user',
          content: userMessage.content,
        },
      ];

      await processAIConversation(conversationPayload);

      // 移除访客使用标记，改为在流程图成功生成后计费
      // if (!currentUser) {
      //   markGuestAsUsed();
      // }
    } catch (error) {
      console.error('Error sending message:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }

      // Check if this is a guest usage limit error
      if (error instanceof Error && (error as any).isGuestLimit) {
        // Handle guest limit reached
        if (!currentUser) {
          handleGuestLimitReached();
          setShowLoginModal(true);
          return;
        }
      }

      // Check if this is a daily limit error for registered users
      if (error instanceof Error && (error as any).isDailyLimit) {
        // Handle daily limit reached for registered users
        if (currentUser) {
          console.log(
            '✅ Showing PricingModal with daily limit context for registered user'
          );
          setDailyLimitUsageInfo((error as any).usageInfo);
          setShowPricingModal(true);
          return;
        }
      }

      const userFacingMessage = getUserFacingErrorMessage(
        error,
        'Sorry, I encountered an error while processing your request. Please try again.'
      );

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: userFacingMessage,
        role: 'assistant',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Error',
        description: userFacingMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setSendStatus(null);
      setAssistantResponsePhase('idle');
      abortControllerRef.current = null;
      setIsStreamingResponse(false);
      streamingMessageIdRef.current = null;
    }
  };

  // Process one agent stream. Canvas mutations are committed only after a
  // validated complete tool result and the terminal finish event arrive.
  const processAIConversation = async (conversationMessages: any[]) => {
    const canvasSnapshot = getCanvasState();
    const sceneElements = excalidrawAPI
      ? [...excalidrawAPI.getSceneElements()]
      : [];
    const selectedElementIds = excalidrawAPI
      ? excalidrawAPI.getAppState().selectedElementIds
      : {};
    const targetResolution = resolveDiagramTarget({
      elements: sceneElements,
      selectedElementIds,
      metadata: deriveFlowchartAiMetadataFromElements(
        sceneElements,
        flowchartAiMetadata
      ),
    });
    if (targetResolution.status === 'ambiguous') {
      const ambiguousTargetError = new Error(
        'Diagram target is ambiguous; select one diagram first'
      );
      (
        ambiguousTargetError as Error & { userFacingMessage?: string }
      ).userFacingMessage =
        'Select one AI diagram before asking the assistant to edit it.';
      throw ambiguousTargetError;
    }
    const currentMetadata = deriveFlowchartAiMetadataFromElements(
      sceneElements,
      flowchartAiMetadata
    );
    if (
      JSON.stringify(currentMetadata) !== JSON.stringify(flowchartAiMetadata)
    ) {
      onFlowchartAiMetadataChange(currentMetadata);
    }
    const inferredMode =
      targetResolution.status === 'resolved' ? 'extend' : 'replace';

    setSendStatus(null);
    setAssistantResponsePhase('thinking');
    markFlowchartPerformance('agentRequestStarted');

    const response = await fetch('/api/ai/chat/flowchart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: conversationMessages,
        aiContext: {
          canvasSnapshot,
          lastMermaid: canvasContextRef.current.lastMermaid,
          requestedMode: inferredMode,
          mode: aiMode,
          selectedDiagramId:
            targetResolution.status === 'resolved'
              ? targetResolution.diagramId
              : undefined,
          targetResolution,
          flowchartAi: currentMetadata,
        },
      }),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        // Handle rate limit errors specifically
        if (errorData.isGuest) {
          const guestError = new Error(
            errorData.message ||
              'Guest users can only use AI once per month. Please sign up for more requests.'
          );
          (guestError as any).isGuestLimit = true;
          throw guestError;
        }

        if (errorData.usageInfo?.timeFrame === 'daily') {
          console.log('🔄 Detected daily limit error:', errorData.usageInfo);
          const dailyLimitError = new Error(
            errorData.message || 'You have reached your daily AI usage limit.'
          );
          (dailyLimitError as any).isDailyLimit = true;
          (dailyLimitError as any).usageInfo = errorData.usageInfo;
          throw dailyLimitError;
        }

        throw new Error(
          errorData.message || 'You have reached your AI usage limit.'
        );
      }

      const requestError = new Error(
        typeof errorData.message === 'string'
          ? errorData.message
          : `HTTP error! status: ${response.status}`
      );

      if (
        errorData.error === 'prompt_rejected' ||
        errorData.error === 'prompt_flagged' ||
        errorData.error === 'moderation_unavailable'
      ) {
        (requestError as { userFacingMessage?: string }).userFacingMessage =
          errorData.message;
      }

      throw requestError;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const sseDecoder = createSseEventDecoder();
    const streamingMessageId = `assistant_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    let messageCreated = false;
    let accumulatedContent = '';
    let pendingCommand: CanvasCommand | null = null;
    let streamFinished = false;
    let finishToolCallsCompleted = false;
    let streamAborted = false;
    let streamError: Error | null = null;
    let receivedDone = false;
    let receivedFirstEvent = false;

    const ensureStreamingMessage = () => {
      if (messageCreated) return;
      messageCreated = true;
      streamingMessageIdRef.current = streamingMessageId;
      const timestamp = new Date();
      setMessages((prev) => [
        ...prev,
        {
          id: streamingMessageId,
          content: '',
          role: 'assistant',
          timestamp,
          isFlowchart: false,
        },
      ]);
    };

    const updateStreamingMessage = (updater: (prev: Message) => Message) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === streamingMessageId ? updater(msg) : msg))
      );
    };

    const setStreamingContent = (content: string) => {
      ensureStreamingMessage();
      accumulatedContent = content;
      updateStreamingMessage((msg) => ({
        ...msg,
        content,
      }));
    };

    const appendStreamingContent = (delta: string) => {
      if (!delta) return;
      const nextContent = accumulatedContent + delta;
      setStreamingContent(nextContent);
    };

    const handleEvent = (event: unknown): void => {
      if (event === '[DONE]') {
        receivedDone = true;
        return;
      }
      if (!event || typeof event !== 'object') return;
      if (!receivedFirstEvent) {
        receivedFirstEvent = true;
        markFlowchartPerformance('firstAgentEvent');
      }

      const data = event as Record<string, any>;
      if (data.type === 'text') {
        setAssistantResponsePhase('idle');
        setSendStatus(null);
        appendStreamingContent(data.content ?? '');
        return;
      }
      if (data.type === 'tool-call') {
        const parsed = canvasCommandSchema.safeParse(data.args);
        if (data.toolName !== 'generate_flowchart' || !parsed.success) {
          streamError = new Error('Agent returned an invalid canvas command');
          return;
        }
        if (pendingCommand) {
          streamError = new Error('Agent returned multiple canvas commands');
          return;
        }
        pendingCommand = parsed.data;
        setAssistantResponsePhase('editing');
        setSendStatus(null);
        markFlowchartPerformance('canvasToolReceived');
        return;
      }
      if (data.type === 'finish') {
        streamFinished = true;
        finishToolCallsCompleted = Boolean(data.toolCallsCompleted);
        return;
      }
      if (data.type === 'aborted') {
        streamAborted = true;
        return;
      }
      if (data.type === 'error') {
        streamError = new Error(data.error || 'Agent stream failed');
      }
    };

    while (!receivedDone) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of sseDecoder.push(value)) handleEvent(event);
    }
    for (const event of sseDecoder.finish()) handleEvent(event);

    const completedCommand = pendingCommand as CanvasCommand | null;
    const mermaidCode =
      completedCommand?.kind === 'render-mermaid'
        ? completedCommand.mermaidCode
        : undefined;

    if (messageCreated) {
      updateStreamingMessage((msg) => ({
        ...msg,
        content: accumulatedContent,
        isFlowchart: Boolean(completedCommand),
        mermaidCode,
        timestamp: new Date(),
      }));
    } else if (accumulatedContent.trim().length > 0) {
      streamingMessageIdRef.current = null;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          content: accumulatedContent,
          role: 'assistant',
          timestamp: new Date(),
          isFlowchart: Boolean(completedCommand),
          mermaidCode,
        },
      ]);
    }

    if (!accumulatedContent.trim() && !completedCommand && messageCreated) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== streamingMessageId)
      );
    }

    if (streamAborted || abortControllerRef.current?.signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    if (streamError) throw streamError;
    if (!streamFinished) {
      throw new Error('Agent stream ended before completion');
    }
    if (completedCommand && !finishToolCallsCompleted) {
      throw new Error('Canvas command was not completed by the agent');
    }
    if (!completedCommand && finishToolCallsCompleted) {
      throw new Error('Agent completed a tool without a canvas command');
    }
    if (completedCommand) {
      await applyCanvasCommand(completedCommand);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setSendStatus(null);
      setAssistantResponsePhase('idle');
      setIsStreamingResponse(false);
      streamingMessageIdRef.current = null;
    }
  };

  const handleNewConversation = () => {
    // 如果正在加载中，先停止当前对话
    if (isLoading) {
      handleStopGeneration();
    }

    // 清空对话历史
    setMessages([]);
    setInput('');
    setSendStatus(null);
    setAssistantResponsePhase('idle');
    setIsStreamingResponse(false);
    streamingMessageIdRef.current = null;
    localStorage.removeItem(chatStorageKey);

    // 显示提示信息
    toast({
      title: 'New conversation created',
      description:
        'Chat history cleared. You can start a fresh AI conversation.',
    });
  };

  const renderFormattedText = (text: string) => {
    return <MarkdownRenderer content={text} />;
  };

  const renderMessageContent = (message: Message) => {
    if (message.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Request failed</p>
              <p className="mt-1 text-sm">
                {typeof message.content === 'string'
                  ? message.content
                  : 'The request could not be completed.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8 border-red-200 bg-white text-red-700 hover:bg-red-100"
                onClick={() => handleRetry(message.id)}
                disabled={isLoading}
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="leading-relaxed">
          {typeof message.content === 'string'
            ? renderFormattedText(message.content)
            : message.content.map((content, index) => (
                <div key={index}>
                  {content.type === 'text' && content.text && (
                    <div>{renderFormattedText(content.text)}</div>
                  )}
                  {content.type === 'image_url' && content.image_url && (
                    <div className="mt-2">
                      <img
                        src={content.image_url.url}
                        alt="Uploaded content"
                        className="max-w-full h-auto rounded-lg border border-gray-200"
                        style={{ maxHeight: '200px' }}
                      />
                    </div>
                  )}
                </div>
              ))}
        </div>
        {/* Flowchart is automatically added to canvas, no need for manual button */}
      </div>
    );
  };

  return (
    <div
      className={`fixed top-0 right-0 z-40 h-full w-screen max-w-full bg-white shadow-lg transition-transform duration-300 ease-in-out md:w-[var(--sidebar-width)] ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ '--sidebar-width': `${width}px` } as CSSProperties}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium text-gray-900">
              AI Assistant
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleNewConversation}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              disabled={isLoading}
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              onClick={onToggle}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close AI assistant"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Guest Usage Indicator */}
        {!currentUser && (
          <div className="px-4 pb-4">
            <GuestUsageIndicator />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea ref={scrollAreaRef} className="h-full w-full">
            <div className="space-y-4 px-4 pb-4 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Ask me to create a flowchart!</p>
                  <p className="text-xs mt-1 opacity-75">
                    I can help you visualize processes, workflows, and ideas.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${message.role === 'user' ? 'flex justify-end' : ''}`}
                >
                  {message.role === 'user' ? (
                    <Card className="max-w-[280px] p-3 bg-gray-100 text-gray-900 border-gray-100">
                      <div className="text-sm leading-relaxed space-y-2">
                        {typeof message.content === 'string' ? (
                          <p>{message.content}</p>
                        ) : (
                          message.content.map((content, index) => (
                            <div key={index}>
                              {content.type === 'text' && content.text && (
                                <p>{content.text}</p>
                              )}
                              {content.type === 'image_url' &&
                                content.image_url && (
                                  <div className="mt-2">
                                    <img
                                      src={content.image_url.url}
                                      alt="Uploaded content"
                                      className="max-w-full h-auto rounded-lg border border-gray-200"
                                      style={{ maxHeight: '150px' }}
                                    />
                                  </div>
                                )}
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  ) : (
                    <div className="max-w-full">
                      <div className="flex-1">
                        {renderMessageContent(message)}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isStreamingResponse &&
                assistantResponsePhase === 'thinking' &&
                !streamingMessageIdRef.current && (
                  <div className="max-w-full">
                    <div
                      className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-2 text-sm text-gray-600"
                      aria-live="polite"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{ASSISTANT_THINKING_STATUS}</span>
                    </div>
                  </div>
                )}

              {isStreamingResponse &&
                (assistantResponsePhase === 'editing' ||
                  assistantResponsePhase === 'rendering') && (
                  <div className="max-w-full">
                    <div
                      className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm text-blue-700"
                      aria-live="polite"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {assistantResponsePhase === 'editing'
                          ? FLOWCHART_EDITING_STATUS
                          : FLOWCHART_RENDERING_STATUS}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200">
          {/* Image previews */}
          {selectedImages.length > 0 && (
            <div className="mb-3 mx-4 mt-4">
              <div className="flex flex-wrap gap-2">
                {selectedImages.map((file, index) => (
                  <div key={index} className="relative">
                    <img
                      src={imagePreviewUrls[index]}
                      alt={`Preview ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      disabled={isLoading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-b-lg truncate">
                      {file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageSelect(e.target.files)}
            className="hidden"
          />

          <div className="p-3">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <Textarea
                ref={textareaRef}
                placeholder="Describe what to create or change..."
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setTimeout(() => adjustTextareaHeight(), 0);
                }}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className="min-h-[80px] max-h-[200px] resize-none overflow-y-auto rounded-2xl border-0 bg-transparent px-3 py-3 text-sm leading-6 text-gray-900 shadow-none placeholder:text-gray-400 focus-visible:ring-0"
                style={{
                  height: '80px',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              />

              <div className="flex min-w-0 items-center gap-1.5 border-t border-gray-100 p-2">
                <Select
                  value={aiMode}
                  onValueChange={(value) => setAiMode(value as AiAssistantMode)}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    size="sm"
                    className="min-w-0 max-w-[150px] border-0 bg-gray-50 px-2 shadow-none"
                    aria-label="Assistant mode"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AI_ASSISTANT_MODES) as AiAssistantMode[]).map(
                      (mode) => (
                        <SelectItem key={mode} value={mode}>
                          {AI_ASSISTANT_MODES[mode].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  onClick={handleCameraClick}
                  disabled={isLoading}
                  aria-label="Attach image"
                  title="Attach image"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <div className="min-w-0 flex-1" />

                {isLoading ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-gray-600 hover:bg-gray-100"
                    onClick={handleStopGeneration}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleSendMessage}
                    disabled={!input.trim() && selectedImages.length === 0}
                    aria-label="Send message"
                    title="Send"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <p
              className="mt-2 flex min-h-4 items-center gap-1.5 px-1 text-xs text-gray-400"
              aria-live="polite"
            >
              {activeSendStatus && (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              )}
              <span>
                {activeSendStatus ??
                  'Enter to send · Shift+Enter for a new line'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Login Modal for Guest Users - Direct login modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-[400px] p-0">
          <DialogHeader className="hidden">
            <DialogTitle>Sign In</DialogTitle>
          </DialogHeader>
          <LoginForm
            callbackUrl={loginCallbackUrl || currentPath}
            className="border-none"
          />
        </DialogContent>
      </Dialog>

      {/* AI Usage Limit Card */}
      {showUsageLimitCard && usageData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUsageLimitCard(false)}
              className="absolute -top-2 -right-2 z-10 bg-white shadow-md hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
            <AIUsageLimitCard
              usedCount={usageData.usedCount}
              totalLimit={usageData.totalLimit}
              currentPlan={usageData.subscriptionStatus}
              onUpgrade={() => {
                setShowUsageLimitCard(false);
                setShowPricingModal(true);
              }}
              onLearnMore={() => {
                setShowUsageLimitCard(false);
                setShowPricingModal(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => {
          setShowPricingModal(false);
          setDailyLimitUsageInfo(null); // Clear limit context
          refreshUsageData(); // Refresh usage data when modal closes
        }}
        limitContext={
          dailyLimitUsageInfo
            ? {
                type: 'daily',
                nextResetTime: dailyLimitUsageInfo.nextResetTime
                  ? new Date(dailyLimitUsageInfo.nextResetTime)
                  : undefined,
                message: "You've used your free AI request for today",
              }
            : undefined
        }
      />
    </div>
  );
};

export default AiChatSidebar;
