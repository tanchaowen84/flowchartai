import { HeaderSection } from '@/components/layout/header-section';
import { BorderBeam } from '@/components/magicui/border-beam';
import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

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
          {/* Main Demo Video */}
          <div className="bg-background w-full relative flex overflow-hidden rounded-2xl border p-2">
            <div className="aspect-video bg-background relative w-full rounded-2xl">
              <div className="size-full overflow-hidden rounded-2xl border bg-zinc-900 shadow-md relative">
                <video
                  className="size-full object-cover object-center"
                  controls
                  preload="metadata"
                  poster="https://cdn.flowchartai.org/static/demo-thumbnail.png"
                >
                  <source
                    src="https://cdn.flowchartai.org/static/demo.mp4"
                    type="video/mp4"
                  />
                  <track
                    kind="captions"
                    src=""
                    srcLang="en"
                    label="English captions"
                    default
                  />
                  Your browser does not support the video tag.
                </video>
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
              <LocaleLink href="/canvas">{t('tryItNow')}</LocaleLink>
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
