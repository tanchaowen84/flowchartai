'use client';

import { HeaderSection } from '@/components/layout/header-section';
import { BorderBeam } from '@/components/magicui/border-beam';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { startFlowchartSession } from '@/lib/utils';
import {
  FileText,
  GitBranch,
  ListChecks,
  PenSquare,
  Repeat,
  Wand2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ExampleCard = {
  title: string;
  snippet: string;
  description: string;
  ctaLabel: string;
  ctaPrompt: string;
};

/**
 * https://nsui.irung.me/features
 * pnpm dlx shadcn@canary add https://nsui.irung.me/r/features-12.json
 */
export default function FeaturesSection() {
  const t = useTranslations('HomePage.features');
  type ImageKey = 'item-1' | 'item-2' | 'item-3' | 'item-4';
  const [activeItem, setActiveItem] = useState<ImageKey>('item-1');
  const examples = (t.raw('examplesSection.items') as ExampleCard[]) ?? [];
  const examplesTitle = t('examplesSection.title');
  const router = useRouter();

  const images: Record<
    ImageKey,
    {
      image: string;
      darkImage: string;
      alt: string;
      width: number;
      height: number;
    }
  > = {
    'item-1': {
      image: 'https://cdn.flowchartai.org/static/blocks/feature1.png',
      darkImage: 'https://cdn.flowchartai.org/static/blocks/feature1.png',
      alt: 'Product Feature One',
      width: 1024,
      height: 1024,
    },
    'item-2': {
      image: 'https://cdn.flowchartai.org/static/blocks/feature2.png',
      darkImage: 'https://cdn.flowchartai.org/static/blocks/feature2.png',
      alt: 'Product Feature Two',
      width: 1024,
      height: 1024,
    },
    'item-3': {
      image: 'https://cdn.flowchartai.org/static/blocks/feature3.png',
      darkImage: 'https://cdn.flowchartai.org/static/blocks/feature3.png',
      alt: 'Product Feature Three',
      width: 1024,
      height: 1024,
    },
    'item-4': {
      image: 'https://cdn.flowchartai.org/static/blocks/feature4.png',
      darkImage: 'https://cdn.flowchartai.org/static/blocks/feature4.png',
      alt: 'Product Feature Four',
      width: 1024,
      height: 1024,
    },
  };

  const activeMedia = images[activeItem];
  const aspectRatio = activeMedia.height
    ? activeMedia.width / activeMedia.height
    : 1.3;

  return (
    <section id="features" className="px-4 py-16">
      <div className="bg-linear-to-b absolute inset-0 -z-10 sm:inset-6 sm:rounded-b-3xl dark:block dark:to-[color-mix(in_oklab,var(--color-zinc-900)_75%,var(--color-background))]" />
      <div className="mx-auto max-w-6xl space-y-8 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          subtitleAs="p"
          description={t('description')}
          descriptionAs="p"
        />

        <div className="grid gap-12 sm:px-12 lg:grid-cols-12 lg:gap-24 lg:px-0">
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="lg:pr-0 text-left">
              <h3 className="text-3xl font-semibold lg:text-4xl text-gradient_indigo-purple leading-normal py-1">
                {t('overviewTitle')}
              </h3>
              <p className="mt-4 text-muted-foreground">
                {t('overviewDescription')}
              </p>
            </div>
            <Accordion
              type="single"
              value={activeItem}
              onValueChange={(value) => setActiveItem(value as ImageKey)}
              className="w-full"
            >
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-base">
                    <ListChecks className="size-5 text-primary" />
                    {t('items.item-1.title')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t('items.item-1.description')}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-base">
                    <Wand2 className="size-5 text-primary" />
                    {t('items.item-2.title')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t('items.item-2.description')}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-base">
                    <PenSquare className="size-5 text-primary" />
                    {t('items.item-3.title')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t('items.item-3.description')}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-base">
                    <Repeat className="size-5 text-primary" />
                    {t('items.item-4.title')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t('items.item-4.description')}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="bg-background w-full relative flex overflow-hidden rounded-2xl border p-2 lg:h-auto lg:col-span-7">
            <div
              className="bg-background relative w-full rounded-2xl"
              style={{ aspectRatio }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeItem}-id`}
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="relative size-full overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 shadow-md"
                >
                  <Image
                    src={activeMedia.image}
                    className="object-cotain dark:hidden"
                    alt={activeMedia.alt}
                    fill
                    sizes="(min-width: 1024px) 640px, 100vw"
                    priority={activeItem === 'item-1'}
                  />
                  <Image
                    src={activeMedia.darkImage}
                    className="object-contain hidden dark:block"
                    alt={activeMedia.alt}
                    fill
                    sizes="(min-width: 1024px) 640px, 100vw"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <BorderBeam
              duration={6}
              size={200}
              className="from-transparent via-violet-700 to-transparent dark:via-white/50"
            />
          </div>
        </div>
      </div>

      {examples.length > 0 ? (
        <div className="mt-16 space-y-8">
          <h3 className="text-center text-2xl font-semibold text-foreground">
            {examplesTitle}
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {examples.map((example, index) => (
              <Card
                key={`text-flowchart-example-${example.title}`}
                className="flex h-full flex-col gap-4 rounded-2xl border bg-background p-6 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <ExampleIcon index={index} />
                    <h4 className="text-lg font-semibold text-foreground">
                      {example.title}
                    </h4>
                  </div>
                  <p className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/10 to-transparent p-4 text-sm text-foreground/90 shadow-sm">
                    {example.snippet}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {example.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto self-start"
                  onClick={async () => {
                    await startFlowchartSession({
                      mode: 'text_to_flowchart',
                      prompt: example.ctaPrompt,
                      router,
                    });
                  }}
                >
                  {example.ctaLabel}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ExampleIcon({ index }: { index: number }) {
  const iconClassName = 'size-5 text-primary';
  switch (index) {
    case 1:
      return <GitBranch className={iconClassName} />;
    case 2:
      return <PenSquare className={iconClassName} />;
    default:
      return <FileText className={iconClassName} />;
  }
}
