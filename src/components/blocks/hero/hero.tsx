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
import {
  createImageThumbnail,
  encodeImageToBase64,
  formatFileSize,
  isValidImageFile,
  MAX_FILE_SIZE,
} from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { Camera, Send, UploadCloud, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChangeEvent, DragEvent, useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function HeroSection() {
  const t = useTranslations('HomePage.hero');
  const router = useRouter();
  const currentUser = useCurrentUser();

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await handleValidatedImage(file);
    },
    [handleValidatedImage]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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
                  thumbnail: imagePreview ?? (await createImageThumbnail(imageFile, 320, 200)),
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
          // Guest user - go to canvas directly
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
                  thumbnail: imagePreview ?? (await createImageThumbnail(imageFile, 320, 200)),
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

          router.push('/canvas');
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
    [input, selectedMode, currentUser, router, imageFile, clearImage]
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

                {/* input form with mode selection */}
                <div className="mt-12 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center gap-2 rounded-full bg-muted px-1.5 py-1 text-sm shadow-lg border border-border/60 max-w-2xl w-full justify-center">
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
                              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
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
                            isFocused
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 bg-background/80'
                          )}
                        >
                          {imagePreview ? (
                            <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-sm">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-full object-cover"
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
                                  Supported formats: JPG, PNG, WEBP, GIF. Max size {formatFileSize(MAX_FILE_SIZE)}.
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
                                  <p className="text-xs text-red-500">{imageError}</p>
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
