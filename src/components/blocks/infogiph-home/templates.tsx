'use client';

import Link from 'next/link';
import { useState } from 'react';
import { categories, templates } from '@/lib/infogiph-home-content';
import { AnimatedPreview } from './animated-preview';
import { SearchIcon } from './icons';
import { templatePreviews } from './template-icons';
import type { TemplateCategory } from './types';

export function Templates() {
  const [active, setActive] = useState<TemplateCategory>('All');
  const visible =
    active === 'All'
      ? templates
      : templates.filter((t) => t.category === active);

  // Only show categories that have at least one template
  const activeCategories = categories.filter(
    (c) => c === 'All' || templates.some((t) => t.category === c),
  );

  return (
    <section className="px-4 md:px-6 pb-10">
      <div className="mx-auto max-w-7xl pt-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide max-w-full pb-1 mb-5">
          <button
            type="button"
            aria-label="Search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-[#fafafa]"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          {activeCategories.map((c) => {
            const isActive = c === active;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                className={
                  'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ' +
                  (isActive
                    ? 'bg-foreground text-background'
                    : 'text-foreground/70 hover:text-foreground hover:bg-[#fafafa]')
                }
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((t) => (
            <Link
              key={t.slug}
              href="/canvas"
              className="group text-left w-full cursor-pointer hover:opacity-90 transition-opacity block"
            >
              <div className="relative rounded-xl overflow-hidden mb-3">
                <div className="relative overflow-hidden rounded-xl bg-muted aspect-[3/4] w-full">
                  {templatePreviews[t.slug] ? (
                    <AnimatedPreview {...templatePreviews[t.slug]} />
                  ) : null}
                </div>
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-black transition-colors line-clamp-1">
                {t.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {t.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
