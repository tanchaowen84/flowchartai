'use client';

import { useState } from 'react';
import { faqs } from '@/lib/infogiph-home-content';
import { ChevronDownIcon } from './icons';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-12 sm:pb-20">
      <h3 className="text-xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
        Frequently asked questions
      </h3>
      <div>
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={item.q}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex items-center justify-between w-full py-5 text-left hover:text-black transition-colors"
              >
                <span className="font-semibold text-sm sm:text-lg pr-8">
                  {item.q}
                </span>
                <ChevronDownIcon
                  className={
                    'h-5 w-5 shrink-0 transition-transform ' +
                    (isOpen ? 'rotate-180' : '')
                  }
                />
              </button>
              {isOpen ? (
                <div className="pb-5 text-muted-foreground leading-relaxed text-sm sm:text-base">
                  {item.a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
