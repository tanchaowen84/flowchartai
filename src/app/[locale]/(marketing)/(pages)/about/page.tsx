import Container from '@/components/layout/container';
import { BlurFadeDemo } from '@/components/magicui/example/blur-fade-example';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { websiteConfig } from '@/config/website';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { cn } from '@/lib/utils';
import { MailIcon, TwitterIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'AboutPage' });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/about', locale),
    noIndex: true,
  });
}

/**
 * inspired by https://astro-nomy.vercel.app/about
 */
export default async function AboutPage() {
  const t = await getTranslations('AboutPage');

  return (
    <Container className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* about section */}
        <div className="relative max-w-(--breakpoint-md) mx-auto mb-24 mt-8 md:mt-16">
          <div className="mx-auto flex flex-col justify-between">
            <div className="grid gap-8 sm:grid-cols-2">
              {/* avatar and name */}
              <div className="flex items-center gap-8">
                <Avatar className="size-32 p-0.5">
                  <AvatarImage
                    className="rounded-full border-4 border-gray-200"
                    src="https://cdn.flowchartai.org/static/logo.png"
                    alt="Avatar"
                  />
                  <AvatarFallback>
                    <div className="size-32 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-4xl text-foreground">
                    {t('authorName')}
                  </h1>
                  <p className="text-base text-muted-foreground mt-2">
                    {t('authorBio')}
                  </p>
                </div>
              </div>

              {/* introduction */}
              <div>
                <p className="mb-8 text-base text-muted-foreground">
                  {t('introduction')}
                </p>

                <div className="flex items-center gap-4">
                  {websiteConfig.metadata.social?.twitter && (
                    <a
                      href={websiteConfig.metadata.social.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: 'outline' }),
                        'rounded-lg cursor-pointer'
                      )}
                    >
                      <TwitterIcon className="mr-1 size-4" />
                      {t('followMe')}
                    </a>
                  )}
                  {websiteConfig.mail.supportEmail && (
                    <div className="flex items-center gap-4">
                      <Button className="rounded-lg cursor-pointer">
                        <MailIcon className="mr-1 size-4" />
                        <a href={`mailto:${websiteConfig.mail.supportEmail}`}>
                          {t('talkWithMe')}
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* image section */}
        <BlurFadeDemo />
      </div>
    </Container>
  );
}
