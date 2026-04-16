'use client';

import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { templates } from '@/lib/infogiph-home-content';
import { EXPORT_PRESETS, type ExportPreset } from '@/hooks/use-export';
import { ChevronDownIcon, ImageIcon, SparkleIcon } from './icons';

const ASPECT_OPTIONS = (Object.keys(EXPORT_PRESETS) as ExportPreset[]).filter(
  (k) => k !== 'original',
);

export function Hero() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('ai');
  const [selectedAspect, setSelectedAspect] =
    useState<ExportPreset>('landscape');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setTemplateOpen(false);
        setAspectOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('Image must be under 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('flowchart_auto_generate', 'true');
        localStorage.setItem('flowchart_auto_input', trimmed);
      }
      if (selectedTemplate && selectedTemplate !== 'ai') {
        localStorage.setItem('flowchart_template', selectedTemplate);
      } else {
        localStorage.removeItem('flowchart_template');
      }
      if (selectedAspect) {
        localStorage.setItem('flowchart_aspect', selectedAspect);
      }
      if (imageData) {
        localStorage.setItem('flowchart_image', imageData);
      } else {
        localStorage.removeItem('flowchart_image');
      }
    }
    router.push('/canvas');
  };

  const activeTemplate = templates.find((t) => t.slug === selectedTemplate);

  return (
    <section className="mx-auto max-w-3xl px-4 md:px-6 py-2.5 pt-6 md:pt-10">
      <h1 className="text-center text-2xl md:text-4xl font-bold tracking-tight">
        What do you want to visualize?
      </h1>
      <p className="mt-2 text-center text-sm md:text-base text-muted-foreground mb-6">
        Your AI infographic designer for stunning, animated diagrams
      </p>

      <form onSubmit={handleCreate} className="mb-8 md:mb-10">
        <div className="w-full max-w-2xl mx-auto">
          <div className="rounded-lg border border-border bg-white ig-prompt-shadow">
            <div className="px-4 pt-4">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a system — e.g. 'SaaS architecture with auth, billing, and analytics'"
                className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
              />
              {imageName && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5 text-foreground/60" />
                  <span className="truncate max-w-[200px]">{imageName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageData(null);
                      setImageName(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="text-foreground/50 hover:text-foreground ml-1"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <div
              ref={wrapRef}
              className="flex items-center justify-between px-3 pb-3 pt-3"
            >
              <div className="flex items-center gap-2">
                {/* Image upload */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImage}
                />
                <button
                  type="button"
                  aria-label="Upload image"
                  onClick={() => fileRef.current?.click()}
                  className={
                    'inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-colors ' +
                    (imageData
                      ? 'border-foreground text-foreground'
                      : 'border-border text-foreground/70 hover:text-foreground hover:border-foreground/30')
                  }
                >
                  <ImageIcon className="h-4 w-4" />
                </button>

                {/* Template selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateOpen(!templateOpen);
                      setAspectOpen(false);
                    }}
                    className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-sm hover:bg-[#fafafa] transition-colors"
                  >
                    {selectedTemplate === 'ai' && (
                      <SparkleIcon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="font-medium truncate max-w-[110px]">
                      {selectedTemplate === 'ai'
                        ? 'AI Mode'
                        : activeTemplate?.title || 'Template'}
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                  {templateOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-white shadow-lg z-50 py-1 max-h-72 overflow-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplate('ai');
                          setTemplateOpen(false);
                        }}
                        className={
                          'w-full text-left px-3 py-2.5 transition-colors hover:bg-[#fafafa] ' +
                          (selectedTemplate === 'ai'
                            ? 'bg-[#f0f0f0]'
                            : '')
                        }
                      >
                        <span className="flex items-center gap-2">
                          <SparkleIcon className="h-4 w-4 shrink-0" />
                          <span>
                            <span className="text-sm font-medium block">
                              AI Mode
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Let AI choose what's best for you
                            </span>
                          </span>
                        </span>
                      </button>
                      <div className="my-1 h-px bg-border mx-2" />
                      {templates.map((t) => (
                        <button
                          key={t.slug}
                          type="button"
                          onClick={() => {
                            setSelectedTemplate(t.slug);
                            setTemplateOpen(false);
                          }}
                          className={
                            'w-full text-left px-3 py-2 text-sm hover:bg-[#fafafa] transition-colors ' +
                            (selectedTemplate === t.slug
                              ? 'bg-[#f0f0f0] font-medium'
                              : '')
                          }
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aspect ratio selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setAspectOpen(!aspectOpen);
                      setTemplateOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-sm hover:bg-[#fafafa] transition-colors"
                  >
                    <span className="font-medium">
                      {EXPORT_PRESETS[selectedAspect].label.split(' (')[0]}
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                  {aspectOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-border bg-white shadow-lg z-50 py-1">
                      {ASPECT_OPTIONS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setSelectedAspect(k);
                            setAspectOpen(false);
                          }}
                          className={
                            'w-full text-left px-3 py-2 text-sm hover:bg-[#fafafa] transition-colors ' +
                            (selectedAspect === k
                              ? 'bg-[#f0f0f0] font-medium'
                              : '')
                          }
                        >
                          {EXPORT_PRESETS[k].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className={
                  'inline-flex items-center justify-center rounded-full px-5 py-1.5 text-sm font-medium transition-colors ' +
                  (prompt.trim() || imageData
                    ? 'bg-foreground text-background hover:opacity-90'
                    : 'bg-[#e5e5e5] text-muted-foreground cursor-not-allowed')
                }
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
