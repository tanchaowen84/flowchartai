'use client';

import { LoginForm } from '@/components/auth/login-form';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { AIUsageLimitCard } from '@/components/shared/ai-usage-limit-card';
import { GuestUsageIndicator } from '@/components/shared/guest-usage-indicator';
import MarkdownRenderer from '@/components/shared/markdown-renderer';
import { PricingModal } from '@/components/shared/pricing-modal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAIUsageLimit } from '@/hooks/use-ai-usage-limit';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useGuestAIUsage } from '@/hooks/use-guest-ai-usage';
import { toast } from '@/hooks/use-toast';
import { useLocalePathname } from '@/i18n/navigation';
import { generateAICanvasDescription } from '@/lib/canvas-analyzer';
import {
  createImageThumbnail,
  encodeImageToBase64,
  formatFileSize,
  isValidImageFile,
} from '@/lib/image-utils';
import {
  convertMermaidToExcalidraw,
  countAiGeneratedElements,
  extractExistingMermaidCode,
  hasExistingAiFlowchart,
  removeAiGeneratedElements,
} from '@/lib/mermaid-converter';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  AlertCircle,
  ArrowUp,
  Camera,
  Edit,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  autoInput?: string;
  shouldAutoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
}

const AiChatSidebar: React.FC<AiChatSidebarProps> = ({
  className,
  isOpen,
  onToggle,
  excalidrawAPI,
  isAPIReady = false,
  width = 400,
  autoInput,
  shouldAutoGenerate,
  onAutoGenerateComplete,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [showUsageLimitCard, setShowUsageLimitCard] = useState(false);
  const [dailyLimitUsageInfo, setDailyLimitUsageInfo] = useState<any>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const hasAutoSentRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const { usageData, checkUsageLimit, refreshUsageData } = useAIUsageLimit();
  const {
    canUseAI: canGuestUseAI,
    hasUsedFreeRequest,
    markAsUsed: markGuestAsUsed,
    handleLimitReached: handleGuestLimitReached,
  } = useGuestAIUsage();

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
      const minHeight = 32;
      const maxHeight = 120;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAssistantMessage]);

  // Initialize textarea height on mount and when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // Auto-adjust textarea height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // Auto-send function that bypasses input state
  const handleAutoSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    // Check AI usage limit based on user type
    if (currentUser) {
      // Logged in user - check subscription limits
      const canUseAI = await checkUsageLimit();
      if (!canUseAI) {
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
    } else {
      // Guest user - let the request go to backend for real validation
      console.log(
        '🎯 Guest user sending request - backend will validate usage',
        { hasUsedBefore: hasUsedFreeRequest }
      );
    }

    // Create user message with the provided text
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput(''); // Clear input after sending
    setIsLoading(true);
    setCurrentAssistantMessage('');

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      await processAIConversation([
        // Send complete conversation history for context
        ...messages.map((msg) => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content,
        })),
        // Add current user message
        {
          role: 'user',
          content: userMessage.content,
        },
      ]);

      // Mark guest usage after successful AI response
      if (!currentUser) {
        markGuestAsUsed();
      }
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

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content:
          'Sorry, I encountered an error while processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setMessages((prev) => [...prev, errorMessage]);
      setCurrentAssistantMessage('');

      toast({
        title: 'Error',
        description: 'Failed to process your message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Handle auto-generation from homepage - ONLY ONCE
  useEffect(() => {
    if (
      shouldAutoGenerate &&
      autoInput &&
      isOpen &&
      isAPIReady &&
      !hasAutoSentRef.current
    ) {
      hasAutoSentRef.current = true; // Immediately mark as sent to prevent any duplicates
      setInput(autoInput);

      console.log(
        '🚀 Auto-sending message now that API is ready:',
        autoInput.substring(0, 50) + '...',
        {
          shouldAutoGenerate,
          hasAutoInput: !!autoInput,
          isOpen,
          isAPIReady,
          hasAutoSent: hasAutoSentRef.current,
        }
      );

      // Small delay to ensure component is fully loaded
      setTimeout(async () => {
        try {
          await handleAutoSendMessage(autoInput);

          // 🔧 只有在自动发送成功后才清除localStorage
          localStorage.removeItem('flowchart_auto_generate');
          localStorage.removeItem('flowchart_auto_input');
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
    if (shouldAutoGenerate && autoInput && isOpen && !hasAutoSentRef.current) {
      // 如果5秒后API还没准备好，尝试强制发送
      const timeoutId = setTimeout(() => {
        if (!hasAutoSentRef.current) {
          console.log(
            '⏰ API initialization timeout, attempting force send...'
          );
          if (isAPIReady) {
            // API现在准备好了，正常发送
            hasAutoSentRef.current = true;
            setInput(autoInput);
            setTimeout(async () => {
              try {
                await handleAutoSendMessage(autoInput);
                localStorage.removeItem('flowchart_auto_generate');
                localStorage.removeItem('flowchart_auto_input');
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

    const validFiles: File[] = [];
    const previewUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!isValidImageFile(file)) {
        toast({
          title: 'Invalid file',
          description: `${file.name} is not a valid image file or is too large (max 5MB)`,
          variant: 'destructive',
        });
        continue;
      }

      validFiles.push(file);
      previewUrls.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      setSelectedImages((prev) => [...prev, ...validFiles]);
      setImagePreviewUrls((prev) => [...prev, ...previewUrls]);
    }
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
  }

  interface CanvasEdgeSnapshot {
    id: string;
    type: string;
    fromElement?: string | null;
    toElement?: string | null;
    label?: string;
    aiGenerated?: boolean;
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
        };

        if (element.type === 'arrow') {
          edges.push({
            id: element.id,
            type: element.type,
            fromElement: 'startBinding' in element ? element.startBinding?.elementId : undefined,
            toElement: 'endBinding' in element ? element.endBinding?.elementId : undefined,
            label: 'text' in element ? element.text : undefined,
            aiGenerated: Boolean(element.customData?.aiGenerated),
          });
        } else {
          nodes.push({
            ...baseNode,
            text: 'text' in element ? element.text : undefined,
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
        description: generateAICanvasDescription(elements),
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
  }>({});

  const addFlowchartToCanvas = async (
    mermaidCode: string,
    mode: 'replace' | 'extend' = 'replace'
  ) => {
    if (!excalidrawAPI) {
      console.error('❌ ExcalidrawAPI not available');
      toast({
        title: 'Canvas not ready',
        description:
          'Please wait for the canvas to load before generating flowcharts.',
        variant: 'destructive',
      });
      return;
    }

    console.log('✅ Adding flowchart to canvas with mode:', mode);

    try {
      // Convert Mermaid to Excalidraw elements
      const result = await convertMermaidToExcalidraw(mermaidCode);

      if (!result.success) {
        throw new Error(result.error || 'Failed to convert flowchart');
      }

      if (!result.elements) {
        throw new Error('No elements generated from flowchart');
      }

      // Get current elements
      const currentElements = [...excalidrawAPI.getSceneElements()];
      const aiElementsCount = countAiGeneratedElements(currentElements);

      let newElements: any[];

      if (mode === 'replace') {
        // Replace mode: remove existing AI elements and add new ones
        const elementsWithoutAi = removeAiGeneratedElements(currentElements);
        newElements = [...elementsWithoutAi, ...result.elements];
      } else {
        // Extend mode: keep all existing elements and add new ones
        newElements = [...currentElements, ...result.elements];
      }

      // Update the scene with new elements (capture for undo/redo)
      excalidrawAPI.updateScene({
        elements: newElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      // Zoom to fit the new flowchart elements
      excalidrawAPI.scrollToContent(result.elements, {
        fitToContent: true,
        animate: true,
      });

      // Show appropriate toast message based on mode and context
      let toastTitle: string;
      let toastDescription: string;

      if (mode === 'extend') {
        toastTitle = 'Flowchart extended!';
        toastDescription =
          'New elements have been added to your existing flowchart.';
      } else {
        toastTitle =
          aiElementsCount > 0 ? 'Flowchart updated!' : 'Flowchart added!';
        toastDescription =
          aiElementsCount > 0
            ? 'Previous AI flowchart replaced with updated version.'
            : 'Your AI-generated flowchart has been added to the canvas.';
      }

      canvasContextRef.current.lastMermaid = {
        code: mermaidCode,
        generatedAt: Date.now(),
      };

      toast({
        title: toastTitle,
        description: toastDescription,
      });
    } catch (error) {
      console.error('Error adding flowchart to canvas:', error);
      toast({
        title: 'Failed to add flowchart',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;

    // Check AI usage limit based on user type
    if (currentUser) {
      // Logged in user - check subscription limits
      const canUseAI = await checkUsageLimit();
      if (!canUseAI) {
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
    } else {
      // Guest user - let the request go to backend for real validation
      // Backend will check actual database usage and return appropriate error if needed
      console.log(
        '🎯 Guest user sending request - backend will validate usage',
        { hasUsedBefore: hasUsedFreeRequest }
      );
    }

    // Prepare message content
    let messageContent: string | MessageContent[];
    let messageImages: { file: File; thumbnail: string; base64: string }[] = [];

    if (selectedImages.length > 0) {
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
    } else {
      messageContent = input.trim();
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
    setSelectedImages([]);
    setImagePreviewUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setIsLoading(true);
    setCurrentAssistantMessage('');

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      await processAIConversation([
        // 发送完整的对话历史以提供上下文
        ...messages.map((msg) => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content,
        })),
        // 添加当前用户消息
        {
          role: 'user',
          content: userMessage.content,
        },
      ]);

      // Mark guest usage after successful AI response
      if (!currentUser) {
        markGuestAsUsed();
      }
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

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content:
          'Sorry, I encountered an error while processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setMessages((prev) => [...prev, errorMessage]);
      setCurrentAssistantMessage('');

      toast({
        title: 'Error',
        description: 'Failed to process your message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 处理AI对话的核心函数，支持工具调用的递归处理
  const processAIConversation = async (conversationMessages: any[]) => {
    const canvasSnapshot = getCanvasState();
    const inferredMode = mode;

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
        },
      }),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        // Handle rate limit errors specifically
        const errorData = await response.json().catch(() => ({}));
        if (errorData.isGuest) {
          // Create a custom error with guest flag
          const guestError = new Error(
            errorData.message ||
              'Guest users can only use AI once per month. Please sign up for more requests.'
          );
          (guestError as any).isGuestLimit = true;
          throw guestError;
        }

        // Check if this is a daily limit error for registered users
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let accumulatedContent = '';
    let isFlowchartGenerated = false;
    let mermaidCode = '';
    let flowchartMode: 'replace' | 'extend' = 'replace';
    let pendingToolCalls: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'text' || data.type === 'content') {
              accumulatedContent += data.content;
              setCurrentAssistantMessage(accumulatedContent);
            } else if (data.type === 'tool-call') {
              // Handle different tool calls
              if (data.toolName === 'generate_flowchart') {
                mermaidCode = data.args.mermaid_code;
                flowchartMode = data.args.mode || 'replace';
                isFlowchartGenerated = true;

                // Add a simple message indicating flowchart generation (without showing code)
                const modeText =
                  flowchartMode === 'extend'
                    ? 'Extending flowchart...'
                    : 'Generating flowchart...';
                accumulatedContent += `\n\n🎨 ${modeText}`;
                setCurrentAssistantMessage(accumulatedContent);
              } else if (data.toolName === 'get_canvas_state') {
                // Handle canvas state request - get state from frontend
                accumulatedContent += '\n\n🔍 Analyzing current canvas...';
                setCurrentAssistantMessage(accumulatedContent);

                // 收集工具调用，稍后处理
                pendingToolCalls.push({
                  toolCallId: data.toolCallId,
                  toolName: data.toolName,
                  args: data.args,
                });
              }
            } else if (data.type === 'tool-result') {
              // Tool execution result
              console.log('Tool result:', data.result);
            } else if (data.type === 'finish') {
              // Final complete message
              if (!accumulatedContent.trim()) {
                accumulatedContent = data.content;
                setCurrentAssistantMessage(accumulatedContent);
              }
            } else if (data.type === 'done' || data === '[DONE]') {
              break;
            }
          } catch (e) {
            // Skip invalid JSON lines
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }

    // 处理待处理的工具调用
    if (pendingToolCalls.length > 0) {
      if (pendingToolCalls.length > 0) {
        const updatedMessages = [
          ...conversationMessages,
          {
            role: 'assistant',
            content: accumulatedContent,
            tool_calls: pendingToolCalls.map((tc) => ({
              id: tc.toolCallId,
              type: 'function',
              function: {
                name: tc.toolName,
                arguments: JSON.stringify(tc.args),
              },
            })),
          },
        ];

        return await processAIConversation(updatedMessages);
      }
    }

    // Create final assistant message
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: accumulatedContent,
      role: 'assistant',
      timestamp: new Date(),
      isFlowchart: isFlowchartGenerated,
      mermaidCode: isFlowchartGenerated ? mermaidCode : undefined,
    };

    setMessages((prev) => [...prev, aiMessage]);
    setCurrentAssistantMessage('');

    // If a flowchart was generated, add it to the canvas
    if (isFlowchartGenerated && mermaidCode) {
      console.log('🎨 Attempting to add flowchart to canvas:', {
        mermaidCode: mermaidCode.substring(0, 100) + '...',
        flowchartMode,
        excalidrawAPIReady: !!excalidrawAPI,
      });
      await addFlowchartToCanvas(mermaidCode, flowchartMode);
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
      setCurrentAssistantMessage('');
    }
  };

  const handleNewConversation = () => {
    // 如果正在加载中，先停止当前对话
    if (isLoading) {
      handleStopGeneration();
    }

    // 清空对话历史
    setMessages([]);
    setCurrentAssistantMessage('');
    setInput('');

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
        <div className="flex items-start gap-2 text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Error occurred</p>
            <p className="text-xs opacity-75">{message.error}</p>
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
      className={`fixed top-0 right-0 h-full bg-white shadow-lg transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: `${width}px` }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleNewConversation}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
              title="New Conversation"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-medium text-gray-900">
              FlowChart AI
            </h2>
            {isLoading && (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isLoading && (
              <Button
                onClick={handleStopGeneration}
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                <span className="text-xs">Stop</span>
              </Button>
            )}
            <Button
              onClick={onToggle}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
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
                  {excalidrawAPI && (
                    <div className="mt-3 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-md mx-auto w-fit">
                      🎨 Canvas context enabled - I can see your current drawing
                    </div>
                  )}
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

              {/* Current streaming message */}
              {isLoading && currentAssistantMessage && (
                <div className="max-w-full">
                  <div className="leading-relaxed">
                    {renderFormattedText(currentAssistantMessage)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1 w-1 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                </div>
              )}

              {/* Loading indicator when no current message */}
              {isLoading && !currentAssistantMessage && (
                <div className="max-w-full">
                  <div className="flex items-center gap-1 py-2">
                    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="p-6">
          {/* Image previews */}
          {selectedImages.length > 0 && (
            <div className="mb-3 mx-2">
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
            multiple
            onChange={(e) => handleImageSelect(e.target.files)}
            className="hidden"
          />

          <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-3 mx-2">
            <div className="flex items-end space-x-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0 mb-1"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  placeholder="Describe the flowchart you want to create..."
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Adjust height after state update
                    setTimeout(() => adjustTextareaHeight(), 0);
                  }}
                  onKeyDown={handleKeyPress}
                  disabled={isLoading}
                  className="min-h-[32px] max-h-[120px] resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent placeholder:text-gray-400 text-sm px-0 py-1 leading-5 overflow-y-auto"
                  style={{
                    height: '32px',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                />
              </div>
              <Button
                onClick={() => {
                  handleCameraClick();
                }}
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0 mb-1"
                disabled={isLoading}
                title="Upload image"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                size="icon"
                variant="ghost"
                disabled={
                  (!input.trim() && selectedImages.length === 0) || isLoading
                }
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 flex-shrink-0 mb-1"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal for Guest Users - Direct login modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-[400px] p-0">
          <DialogHeader className="hidden">
            <DialogTitle>Sign In</DialogTitle>
          </DialogHeader>
          <LoginForm callbackUrl={currentPath} className="border-none" />
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
