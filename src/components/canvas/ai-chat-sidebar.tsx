'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowUp,
  Bot,
  Camera,
  Edit,
  MessageCircle,
  Pencil,
  Plus,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface AiChatSidebarProps {
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
}

const AiChatSidebar: React.FC<AiChatSidebarProps> = ({
  className,
  isOpen,
  onToggle,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    // Simulate AI response (replace with actual AI integration later)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I understand you want to ${input.toLowerCase()}. Here are some suggestions for your flowchart...`,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
          </div>
          <Button
            onClick={onToggle}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${message.role === 'user' ? 'flex justify-end' : ''}`}
              >
                {message.role === 'user' ? (
                  <Card className="max-w-[280px] p-3 bg-gray-100 text-gray-900 border-gray-100">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </Card>
                ) : (
                  <div className="max-w-full">
                    <p className="text-sm leading-relaxed text-gray-900 font-medium mb-2">
                      {message.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
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
                placeholder="Ask another question..."
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
