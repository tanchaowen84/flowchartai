'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import {
  convertMermaidToExcalidraw,
  countAiGeneratedElements,
  removeAiGeneratedElements,
} from '@/lib/mermaid-converter';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  AlertCircle,
  ArrowUp,
  Bot,
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

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isFlowchart?: boolean;
  mermaidCode?: string;
  error?: string;
}

interface AiChatSidebarProps {
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
}

const AiChatSidebar: React.FC<AiChatSidebarProps> = ({
  className,
  isOpen,
  onToggle,
  excalidrawAPI,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAssistantMessage]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getCanvasState = () => {
    if (!excalidrawAPI) return null;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // 构建精简的画布状态，只包含AI需要的关键信息
      const canvasState = {
        // 元素信息 - 只包含非删除的元素的关键属性
        elements: elements.map((element) => {
          const baseElement = {
            id: element.id,
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
          };

          // 类型安全地添加特定元素的属性
          if (element.type === 'text' && 'text' in element) {
            return { ...baseElement, text: element.text };
          }

          if (
            element.type === 'arrow' &&
            'startBinding' in element &&
            'endBinding' in element
          ) {
            return {
              ...baseElement,
              startBinding: element.startBinding,
              endBinding: element.endBinding,
            };
          }

          if (element.type === 'frame' && 'children' in element) {
            return {
              ...baseElement,
              children: element.children,
              name: 'name' in element ? element.name : undefined,
            };
          }

          return baseElement;
        }),

        // 应用状态 - 只包含重要的视图信息
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

        // 场景元数据
        metadata: {
          elementsCount: elements.length,
          hasImages: Object.keys(files).length > 0,
          canvasSize: {
            width: appState.width,
            height: appState.height,
          },
        },
      };

      return canvasState;
    } catch (error) {
      console.warn('Failed to get canvas state:', error);
      return null;
    }
  };

  const addFlowchartToCanvas = async (mermaidCode: string) => {
    if (!excalidrawAPI) {
      toast({
        title: 'Canvas not ready',
        description:
          'Please wait for the canvas to load before generating flowcharts.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Convert Mermaid to Excalidraw elements
      const result = await convertMermaidToExcalidraw(mermaidCode);

      if (!result.success) {
        throw new Error(result.error || 'Failed to convert flowchart');
      }

      if (!result.elements) {
        throw new Error('No elements generated from flowchart');
      }

      // Get current elements and remove any previously AI-generated ones
      const currentElements = [...excalidrawAPI.getSceneElements()];
      const aiElementsCount = countAiGeneratedElements(currentElements);
      const elementsWithoutAi = removeAiGeneratedElements(currentElements);

      // Add new AI-generated elements
      const newElements = [...elementsWithoutAi, ...result.elements];

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

      // Show appropriate toast message
      const toastTitle =
        aiElementsCount > 0 ? 'Flowchart updated!' : 'Flowchart added!';
      const toastDescription =
        aiElementsCount > 0
          ? 'Previous AI flowchart replaced with updated version.'
          : 'Your AI-generated flowchart has been added to the canvas.';

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
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentAssistantMessage('');

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // 获取画布状态并记录调试信息
    const canvasState = excalidrawAPI ? getCanvasState() : null;
    if (canvasState) {
      console.log('Canvas state being sent to AI:', {
        elementsCount: canvasState.elements.length,
        hasImages: canvasState.metadata.hasImages,
        theme: canvasState.appState.theme,
        zoom: canvasState.appState.zoom,
      });
    }

    try {
      const response = await fetch('/api/ai/chat/flowchart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            // 发送完整的对话历史以提供上下文
            ...messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            // 添加当前用户消息
            {
              role: 'user',
              content: userMessage.content,
            },
          ],
          canvasState: canvasState,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';
      let isFlowchartGenerated = false;
      let mermaidCode = '';

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
                // Handle flowchart generation
                if (data.toolName === 'generate_flowchart') {
                  mermaidCode = data.args.mermaid_code;
                  isFlowchartGenerated = true;

                  // Add a special message indicating flowchart generation
                  accumulatedContent += `\n\n🎨 **Generating flowchart...**\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
                  setCurrentAssistantMessage(accumulatedContent);
                }
              } else if (data.type === 'tool-result') {
                // Tool execution result - could add success feedback here
                console.log('Tool result:', data.result);
              } else if (data.type === 'finish') {
                // Final complete message - use this as the final content
                accumulatedContent = data.content;
                setCurrentAssistantMessage(accumulatedContent);
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
        await addFlowchartToCanvas(mermaidCode);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const renderFormattedText = (text: string) => {
    // Split text by markdown patterns and render safely
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-gray-100 px-1 py-0.5 rounded text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
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
        <div className="text-sm leading-relaxed">
          {renderFormattedText(message.content)}
        </div>
        {message.isFlowchart && message.mermaidCode && (
          <Button
            onClick={() => addFlowchartToCanvas(message.mermaidCode!)}
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            disabled={!excalidrawAPI}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Add to Canvas
          </Button>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-white border-l border-gray-200 shadow-lg transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: '400px' }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
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
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
              >
                <X className="h-3 w-3" />
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

        {/* Messages */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea ref={scrollAreaRef} className="h-full w-full">
            <div className="space-y-4 px-4 pb-4 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                      <p className="text-sm leading-relaxed">
                        {message.content}
                      </p>
                    </Card>
                  ) : (
                    <div className="max-w-full">
                      <div className="flex items-start gap-2 mb-2">
                        <Bot className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          {renderMessageContent(message)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Current streaming message */}
              {isLoading && currentAssistantMessage && (
                <div className="max-w-full">
                  <div className="flex items-start gap-2 mb-2">
                    <Bot className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm leading-relaxed">
                        {renderFormattedText(currentAssistantMessage)}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1 w-1 bg-blue-500 rounded-full animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator when no current message */}
              {isLoading && !currentAssistantMessage && (
                <div className="max-w-full">
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
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
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="p-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-3 mx-2">
            <div className="flex items-center space-x-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Input
                type="text"
                placeholder="Describe the flowchart you want to create..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1 border-0 focus-visible:ring-0 shadow-none bg-transparent placeholder:text-gray-400 text-sm px-0"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                size="icon"
                variant="ghost"
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 flex-shrink-0"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiChatSidebar;
