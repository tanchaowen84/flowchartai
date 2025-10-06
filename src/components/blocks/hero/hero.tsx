'use client';

import { Ripple } from '@/components/magicui/ripple';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-current-user';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

export default function HeroSection() {
  const t = useTranslations('HomePage.hero');
  const router = useRouter();
  const currentUser = useCurrentUser();

  // State for the input
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
      'w-full h-16 text-lg px-6 pr-16 rounded-2xl border-2 bg-background text-foreground placeholder:text-muted-foreground',
      'transition-all duration-300 ease-in-out',
      // 暗夜模式适配
      'dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-400 dark:border-zinc-700',
      // 聚焦状态
      isFocused &&
        'border-primary shadow-lg shadow-primary/20 scale-[1.02] dark:border-primary dark:shadow-primary/20',
      !isFocused &&
        'border-border hover:border-primary/50 dark:border-zinc-700 dark:hover:border-primary/50',
      // 加载状态
      isLoading && 'opacity-50 cursor-not-allowed'
    );
  }, [isFocused, isLoading]);

  const buttonClassName = useMemo(() => {
    return cn(
      // 基础样式
      'absolute right-2 top-1/2 -translate-y-1/2',
      'h-12 w-12 rounded-full',
      'transition-all duration-300 ease-in-out',
      // 状态样式
      input.trim() && !isLoading
        ? 'bg-primary hover:bg-primary/90 scale-100'
        : 'bg-muted-foreground/20 scale-90'
    );
  }, [input, isLoading]);

  const iconClassName = useMemo(() => {
    return cn(
      'h-5 w-5 transition-transform duration-300',
      isLoading ? 'animate-pulse' : 'group-hover:translate-x-0.5'
    );
  }, [isLoading]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!input.trim()) {
        toast.error('Please enter a description for your flowchart');
        return;
      }

      if (input.trim().length < 5) {
        toast.error('Please provide a more detailed description');
        return;
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
          localStorage.setItem('flowchart_auto_input', input.trim());
          localStorage.setItem('flowchart_auto_generate', 'true');

          router.push(`/canvas/${data.id}`);
        } else {
          // Guest user - go to canvas directly
          localStorage.setItem('flowchart_auto_input', input.trim());
          localStorage.setItem('flowchart_auto_generate', 'true');

          router.push('/canvas');
        }
      } catch (error) {
        console.error('Error creating flowchart:', error);
        toast.error('Failed to create new flowchart');
        setIsLoading(false);
      }
    },
    [input, currentUser, router]
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
          <div className="relative pt-12">
            <div className="mx-auto max-w-7xl px-6">
              <Ripple />

              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                {/* title */}
                <h1 className="mt-8 text-balance text-5xl font-bricolage-grotesque lg:mt-16 xl:text-[5rem]">
                  {t('title')}
                </h1>

                {/* description */}
                <p className="mx-auto mt-8 max-w-4xl text-balance text-lg text-muted-foreground">
                  {t('description')}
                </p>

                {/* input form */}
                <div className="mt-12 flex flex-col items-center justify-center gap-6">
                  <form onSubmit={handleSubmit} className="w-full max-w-4xl">
                    <div className="relative group">
                      <Input
                        value={input}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="Describe the flowchart you want to create..."
                        className={inputClassName}
                        disabled={isLoading}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                        className={buttonClassName}
                      >
                        <Send className={iconClassName} />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* images */}
            <div>
              <div className="relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
                <div
                  aria-hidden
                  className="bg-linear-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                />
                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
                  <Image
                    className="z-2 border-border/25 relative rounded-2xl border"
                    src="https://cdn.flowchartai.org/static/blocks/demo.png"
                    alt="FlowChart AI Demo"
                    width={2796}
                    height={2008}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
