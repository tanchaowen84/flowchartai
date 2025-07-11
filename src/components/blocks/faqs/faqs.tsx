'use client';

import { HeaderSection } from '@/components/layout/header-section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { IconName } from 'lucide-react/dynamic';
import { useLocale, useTranslations } from 'next-intl';

type FAQItem = {
  id: string;
  icon: IconName;
  question: string;
  answer: string;
};

export default function FaqSection() {
  const locale = useLocale();
  const t = useTranslations('HomePage.faqs');

  const faqItems: FAQItem[] = [
    {
      id: 'item-1',
      icon: 'calendar-clock',
      question: t('items.item-1.question'),
      answer: t('items.item-1.answer'),
    },
    {
      id: 'item-2',
      icon: 'wallet',
      question: t('items.item-2.question'),
      answer: t('items.item-2.answer'),
    },
    {
      id: 'item-3',
      icon: 'refresh-cw',
      question: t('items.item-3.question'),
      answer: t('items.item-3.answer'),
    },
    {
      id: 'item-4',
      icon: 'hand-coins',
      question: t('items.item-4.question'),
      answer: t('items.item-4.answer'),
    },
    {
      id: 'item-5',
      icon: 'mail',
      question: t('items.item-5.question'),
      answer: t('items.item-5.answer'),
    },
    {
      id: 'item-6',
      icon: 'network',
      question: t('items.item-6.question'),
      answer: t('items.item-6.answer'),
    },
    {
      id: 'item-7',
      icon: 'lightbulb',
      question: t('items.item-7.question'),
      answer: t('items.item-7.answer'),
    },
    {
      id: 'item-8',
      icon: 'users',
      question: t('items.item-8.question'),
      answer: t('items.item-8.answer'),
    },
    {
      id: 'item-9',
      icon: 'upload',
      question: t('items.item-9.question'),
      answer: t('items.item-9.answer'),
    },
  ];

  return (
    <section id="faqs" className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <HeaderSection
          title={t('title')}
          titleAs="h2"
          subtitle={t('subtitle')}
          subtitleAs="p"
        />

        <div className="mx-auto max-w-4xl mt-12">
          <Accordion
            type="single"
            collapsible
            className="ring-muted w-full rounded-2xl border px-8 py-3 shadow-sm ring-4 dark:ring-0"
          >
            {faqItems.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border-dashed"
              >
                <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-base text-muted-foreground">
                    {item.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
