'use client';

import { Ripple } from '@/components/magicui/ripple';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  AI_ASSISTANT_MODES,
  DEFAULT_AI_ASSISTANT_MODE,
  type AiAssistantMode,
} from '@/lib/ai-modes';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

export function FlowchartMakerHero({
  title = 'AI Flowchart Maker',
  description = 'Create professional flowcharts instantly with AI. Just describe your process and watch it come to life.',
  placeholder = 'Describe the flowchart you want to create...',
}: {
  title?: string;
  description?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();

  // State for the input
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedMode, setSelectedMode] = useState<AiAssistantMode>(
    DEFAULT_AI_ASSISTANT_MODE
  );

  // 使用useCallback稳定函数引用
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // 使用useMemo缓存className计算结果
  const inputClassName = useMemo(() => {
    return cn(
      // 基础样式
      'w-full h-16 text-lg px-6 pr-16 rounded-2xl border-2',
      'transition-all duration-300 ease-in-out',
      // 聚焦状态
      isFocused && 'border-primary shadow-lg shadow-primary/20 scale-[1.02]',
      !isFocused && 'border-border hover:border-primary/50',
      // 加载状态
      isLoading && 'opacity-50 cursor-not-allowed'
    );
  }, [isFocused, isLoading]);

  const isSubmitEnabled = useMemo(() => {
    if (isLoading) return false;
    return selectedMode === 'image_to_flowchart' || input.trim().length > 0;
  }, [input, isLoading, selectedMode]);

  const buttonClassName = useMemo(() => {
    return cn(
      'absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full transition-all duration-300 ease-in-out',
      isSubmitEnabled
        ? 'bg-primary hover:bg-primary/90 scale-100'
        : 'bg-muted-foreground/20 scale-90'
    );
  }, [isSubmitEnabled]);

  const iconClassName = useMemo(() => {
    return cn(
      'h-5 w-5 transition-transform duration-300',
      isLoading ? 'animate-pulse' : 'group-hover:translate-x-0.5'
    );
  }, [isLoading]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedInput = input.trim();

      if (selectedMode === 'text_to_flowchart') {
        if (!trimmedInput) {
          toast.error('Please enter a description for your flowchart');
          return;
        }

        if (trimmedInput.length < 5) {
          toast.error('Please provide a more detailed description');
          return;
        }
      } else if (!trimmedInput) {
        toast.info(
          'You can add a note. The canvas will prompt you to upload an image next.'
        );
      }

      setIsLoading(true);

      try {
        if (currentUser) {
          // Logged in user - pre-create flowchart
          const response = await fetch('/api/flowcharts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // Empty body for pre-creation
          });

          if (!response.ok) {
            throw new Error('Failed to create flowchart');
          }

          const data = await response.json();

          // Store the input for auto-generation
          localStorage.setItem('flowchart_auto_input', trimmedInput);
          localStorage.setItem('flowchart_auto_generate', 'true');
          localStorage.setItem('flowchart_auto_mode', selectedMode);

          router.push(`/canvas/${data.id}`);
        } else {
          // Guest user - go to canvas directly
          localStorage.setItem('flowchart_auto_input', trimmedInput);
          localStorage.setItem('flowchart_auto_generate', 'true');
          localStorage.setItem('flowchart_auto_mode', selectedMode);

          router.push('/canvas');
        }
      } catch (error) {
        console.error('Error creating flowchart:', error);
        toast.error('Failed to create new flowchart');
        setIsLoading(false);
      }
    },
    [input, selectedMode, currentUser, router]
  );

  return (
    <>
      <main id="hero" className="overflow-hidden">
        {/* background, light shadows on top of the hero section */}
        <div
          aria-hidden
          className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block"
        >
          <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        </div>

        <section>
          <div className="relative pt-12 pb-16">
            <div className="mx-auto max-w-7xl px-6">
              <Ripple />

              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                {/* title */}
                <h1 className="mt-8 text-balance text-5xl font-bricolage-grotesque lg:mt-16 xl:text-[5rem]">
                  {title}
                </h1>

                {/* description */}
                <p className="mx-auto mt-8 max-w-4xl text-balance text-lg text-muted-foreground">
                  {description}
                </p>

                <div className="mt-12 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center gap-2 rounded-full bg-muted px-1.5 py-1 text-sm shadow-lg border border-border/60 max-w-4xl w-full justify-center">
                    {(Object.keys(AI_ASSISTANT_MODES) as AiAssistantMode[]).map(
                      (mode) => {
                        const isActive = selectedMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSelectedMode(mode)}
                            className={cn(
                              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                              isActive
                                ? 'bg-primary text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {AI_ASSISTANT_MODES[mode].label}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="w-full max-w-4xl">
                    <div className="relative group">
                      <Input
                        value={input}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder={
                          selectedMode === 'text_to_flowchart'
                            ? placeholder
                            : 'Optionally describe the flowchart you want to recreate from an image'
                        }
                        className={inputClassName}
                        disabled={isLoading}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={!isSubmitEnabled}
                        className={buttonClassName}
                      >
                        <Send className={iconClassName} />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
