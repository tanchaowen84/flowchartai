import { HeaderSection } from '@/components/layout/header-section';
import { BorderBeam } from '@/components/magicui/border-beam';
import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { PlayIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export default function DemoSection() {
  const t = useTranslations('HomePage.demo');

  return (
    <section id="demo" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="mt-12 space-y-8">
          {/* Main Demo Video/Image */}
          <div className="bg-background w-full relative flex overflow-hidden rounded-2xl border p-2">
            <div className="aspect-video bg-background relative w-full rounded-2xl">
              <div className="size-full overflow-hidden rounded-2xl border bg-zinc-900 shadow-md relative">
                <Image
                  src="https://cdn.flowchartai.org/static/blocks/music-light.png"
                  className="size-full object-cover object-left-top dark:hidden"
                  alt="FlowChart AI Demo"
                  width={1207}
                  height={929}
                />
                <Image
                  src="https://cdn.flowchartai.org/static/blocks/music.png"
                  className="size-full object-cover object-left-top dark:block hidden"
                  alt="FlowChart AI Demo"
                  width={1207}
                  height={929}
                />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Button size="lg" className="rounded-full h-16 w-16 p-0">
                    <PlayIcon className="size-6 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
            <BorderBeam
              duration={6}
              size={200}
              className="from-transparent via-violet-700 to-transparent dark:via-white/50"
            />
          </div>

          {/* Demo Features */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DemoFeature
              title={t('features.feature-1.title')}
              description={t('features.feature-1.description')}
            />
            <DemoFeature
              title={t('features.feature-2.title')}
              description={t('features.feature-2.description')}
            />
            <DemoFeature
              title={t('features.feature-3.title')}
              description={t('features.feature-3.description')}
            />
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button asChild size="lg">
              <LocaleLink href="/canvas">
                {t('tryItNow')}
              </LocaleLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const DemoFeature = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  return (
    <div className="text-center space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
};
