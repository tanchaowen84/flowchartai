'use client';

import { LoginForm } from '@/components/auth/login-form';
import { Ripple } from '@/components/magicui/ripple';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  AI_ASSISTANT_MODES,
  type AiAssistantMode,
  DEFAULT_AI_ASSISTANT_MODE,
} from '@/lib/ai-modes';
import {
  MAX_FILE_SIZE,
  createImageThumbnail,
  encodeImageToBase64,
  formatFileSize,
  isValidImageFile,
} from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import {
  buildCallbackUrl,
  generateStateId,
  savePendingFlowchartData,
} from '@/lib/flowchart-callback-handler';
import { Camera, Send, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

export default function HeroSection() {
  const t = useTranslations('HomePage.hero');
  const router = useRouter();
  const currentUser = useCurrentUser();

  const heroTitle = t.rich('title', {
    flow: (chunks) => (
      <span className="bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
        {chunks}
      </span>
    ),
    ai: (chunks) => (
      <span className="bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500 bg-clip-text text-transparent">
        {chunks}
      </span>
    ),
  });

  // State for the input
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedMode, setSelectedMode] = useState<AiAssistantMode>(
    DEFAULT_AI_ASSISTANT_MODE
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCallbackUrl, setLoginCallbackUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modeSectionRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (
      selectedMode === 'image_to_flowchart' &&
      typeof window !== 'undefined'
    ) {
      const scrollWithOffset = () => {
        const target = modeSectionRef.current;
        if (!target) return;
        const { top } = target.getBoundingClientRect();
        const desiredTop = window.scrollY + top - 140;
        window.scrollTo({ top: Math.max(desiredTop, 0), behavior: 'smooth' });
      };

      const timeoutId = window.setTimeout(scrollWithOffset, 60);
      return () => window.clearTimeout(timeoutId);
    }
  }, [selectedMode]);

  
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

  const isSubmitEnabled = useMemo(() => {
    if (isLoading) return false;
    if (selectedMode === 'image_to_flowchart') {
      return imageFile !== null;
    }
    return input.trim().length > 0;
  }, [input, isLoading, selectedMode, imageFile]);

  const buttonClassName = useMemo(() => {
    return cn(
      'absolute right-2 top-1/2 -translate-y-1/2',
      'h-12 w-12 rounded-full transition-all duration-300 ease-in-out',
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

  const clearImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  }, [imagePreview]);

  const handleValidatedImage = useCallback(
    async (file: File | null) => {
      if (!file) {
        clearImage();
        return;
      }

      if (!isValidImageFile(file)) {
        setImageError(
          file.size > MAX_FILE_SIZE
            ? `Image exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`
            : 'Unsupported image format. Please use JPG, PNG, WEBP, or GIF.'
        );
        clearImage();
        return;
      }

      setImageError(null);
      setImageFile(file);
      const previewUrl = await createImageThumbnail(file, 480, 320);
      setImagePreview(previewUrl);
    },
    [clearImage]
  );

  const handleImageSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await handleValidatedImage(file);
    },
    [handleValidatedImage]
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await handleValidatedImage(file);
    },
    [handleValidatedImage]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setIsDragActive(false);
  }, []);

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
      } else if (selectedMode === 'image_to_flowchart') {
        if (!imageFile) {
          toast.error('Please upload a flowchart image to continue');
          return;
        }
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

          // Store the input & mode for auto-generation
          localStorage.setItem('flowchart_auto_input', trimmedInput);
          localStorage.setItem('flowchart_auto_generate', 'true');
          localStorage.setItem('flowchart_auto_mode', selectedMode);
          if (imageFile) {
            try {
              const base64 = await encodeImageToBase64(imageFile);
              localStorage.setItem(
                'flowchart_auto_image',
                JSON.stringify({
                  base64,
                  thumbnail:
                    imagePreview ??
                    (await createImageThumbnail(imageFile, 320, 200)),
                  filename: imageFile.name,
                })
              );
            } catch (error) {
              console.error('Failed to encode image:', error);
              toast.error('Failed to prepare image. Please try again.');
              setIsLoading(false);
              return;
            }
          }

          router.push(`/canvas/${data.id}`);
        } else {
          // Guest user - show login modal
          console.log('🎯 Guest user detected - showing login modal');

          // Generate state ID and save pending data
          const stateId = generateStateId();

          try {
            await savePendingFlowchartData(
              stateId,
              trimmedInput,
              selectedMode,
              imageFile,
              imagePreview
            );

            // Build callback URL and show login modal
            const callbackUrl = buildCallbackUrl(stateId);
            setLoginCallbackUrl(callbackUrl);
            setShowLoginModal(true);
            console.log('✅ Pending data saved and login modal shown', {
              stateId,
              mode: selectedMode,
              hasImage: !!imageFile
            });

          } catch (error) {
            console.error('Error saving pending data:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to prepare your request';
            toast.error(errorMessage);
            setIsLoading(false);
            setShowLoginModal(false);
          }
        }
      } catch (error) {
        console.error('Error creating flowchart:', error);
        toast.error('Failed to create new flowchart');
        setIsLoading(false);
      } finally {
        if (selectedMode === 'image_to_flowchart') {
          clearImage();
        }
      }
    },
    [input, selectedMode, currentUser, router, imageFile, imagePreview, clearImage]
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
                  {heroTitle}
                </h1>

                {/* description */}
                <p className="mx-auto mt-8 max-w-4xl text-balance text-lg text-muted-foreground">
                  {t('description')}
                </p>

                {/* input form with mode selection */}
                <div
                  ref={modeSectionRef}
                  className="mt-12 flex flex-col items-center justify-center gap-3"
                >
                  <div className="inline-flex items-center gap-3 rounded-full bg-muted px-3 py-2 text-sm shadow-lg border border-border/60">
                    {(Object.keys(AI_ASSISTANT_MODES) as AiAssistantMode[]).map(
                      (mode) => {
                        const isActive = selectedMode === mode;
                        const label = AI_ASSISTANT_MODES[mode].label;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSelectedMode(mode)}
                            className={cn(
                              'rounded-full px-6 py-2 text-base font-medium transition-all',
                              isActive
                                ? 'bg-primary text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {label}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="w-full max-w-4xl">
                    {selectedMode === 'text_to_flowchart' ? (
                      <div className="relative group">
                        <Input
                          value={input}
                          onChange={handleInputChange}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          placeholder="Describe the flowchart you want to create..."
                          className={cn(
                            inputClassName,
                            'h-20 text-base px-6 pr-20 rounded-3xl'
                          )}
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
                    ) : (
                      <div className="relative group">
                        <div
                          className={cn(
                            'flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-8 py-6 text-center transition-all duration-300',
                            isFocused || isDragActive
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 bg-background/80'
                          )}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                        >
                          {imagePreview ? (
                            <div className="relative flex h-56 w-full max-w-xl items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="max-h-full max-w-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={clearImage}
                                className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white hover:bg-black/70"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <UploadCloud className="h-8 w-8" />
                              </div>
                              <div className="space-y-2">
                                <p className="text-base font-medium text-foreground">
                                  Drag & drop or upload a flowchart image
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Supported formats: JPG, PNG, WEBP, GIF. Max
                                  size {formatFileSize(MAX_FILE_SIZE)}.
                                </p>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="gap-2"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isLoading}
                                >
                                  <Camera className="h-4 w-4" /> Upload image
                                </Button>
                                {imageError && (
                                  <p className="text-xs text-red-500">
                                    {imageError}
                                  </p>
                                )}
                              </div>
                            </>
                          )}

                          <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelect}
                          />
                        </div>

                        <div className="mt-4">
                          <Input
                            value={input}
                            onChange={handleInputChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder="Optional note for the AI (e.g. 'highlight decision points')"
                            className={cn(
                              inputClassName,
                              'h-16 text-base px-6 pr-20 rounded-3xl'
                            )}
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
                      </div>
                    )}
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
                    src="https://cdn.flowchartai.org/static/blocks/demo-1400.jpg"
                    alt="FlowChart AI Demo"
                    width={1400}
                    height={651}
                    priority
                    quality={80}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, (max-width: 1440px) 70vw, 1200px"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Login Modal - Simple wrapper for our default LoginForm */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="p-0 max-w-md">
          <div className="p-6 pb-0 text-center">
            <p className="text-sm text-muted-foreground">
              Your input will be saved and you won't need to re-enter it after logging in.
            </p>
          </div>
          <LoginForm
            callbackUrl={loginCallbackUrl || ''}
            className="border-none shadow-none pt-0"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
