import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
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
  const pt = await getTranslations({ locale, namespace: 'AIVideoPage' });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/ai/video', locale),
  });
}

export default async function AIVideoPage() {
  const t = await getTranslations('AIVideoPage');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* about section */}
      <div className="relative max-w-(--breakpoint-md) mx-auto mb-24 mt-8 md:mt-16">
        <div className="mx-auto flex flex-col justify-between">
          <div className="flex flex-row items-center gap-8">
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
                <h1 className="text-4xl text-foreground">{t('content')}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
