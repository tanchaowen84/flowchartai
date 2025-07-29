import * as Preview from '@/components/docs';
import { CustomMDXContent } from '@/components/shared/custom-mdx-content';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { LOCALES } from '@/i18n/routing';
import { source } from '@/lib/docs/source';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import Link from 'fumadocs-core/link';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export function generateStaticParams() {
  const slugParams = source.generateParams();
  const params = LOCALES.flatMap((locale) =>
    slugParams.map((param) => ({
      locale,
      slug: param.slug,
    }))
  );

  return params;
}

export async function generateMetadata({ params }: DocPageProps) {
  const { slug, locale } = await params;
  const language = locale as string;
  const page = source.getPage(slug, language);
  if (!page) {
    console.warn('docs page not found', slug, language);
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: `${page.data.title} | ${t('title')}`,
    description: page.data.description,
    canonicalUrl: getUrlWithLocale(`/docs/${page.slugs.join('/')}`, locale),
    noIndex: true,
  });
}

function PreviewRenderer({ preview }: { preview: string }): ReactNode {
  if (preview && preview in Preview) {
    const Comp = Preview[preview as keyof typeof Preview];
    return <Comp />;
  }

  return null;
}

export const revalidate = false;

interface DocPageProps {
  params: Promise<{
    slug?: string[];
    locale: Locale;
  }>;
}

/**
 * Doc Page
 *
 * ref:
 * https://github.com/fuma-nama/fumadocs/blob/dev/apps/docs/app/docs/%5B...slug%5D/page.tsx
 */
export default async function DocPage({ params }: DocPageProps) {
  const { slug, locale } = await params;
  const language = locale as string;
  const page = source.getPage(slug, language);

  if (!page) {
    console.warn('docs page not found', slug, language);
    notFound();
  }

  const preview = page.data.preview;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        {/* Preview Rendered Component */}
        {preview ? <PreviewRenderer preview={preview} /> : null}

        {/* MDX Content */}
        <CustomMDXContent
          code={page.data.body}
          customComponents={{
            a: ({ href, ...props }: { href?: string; [key: string]: any }) => {
              const found = source.getPageByHref(href ?? '', {
                dir: page.file.dirname,
              });

              if (!found) return <Link href={href} {...props} />;

              return (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Link
                      href={
                        found.hash
                          ? `${found.page.url}#${found.hash}`
                          : found.page.url
                      }
                      {...props}
                    />
                  </HoverCardTrigger>
                  <HoverCardContent className="text-sm">
                    <p className="font-medium">{found.page.data.title}</p>
                    <p className="text-fd-muted-foreground">
                      {found.page.data.description}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              );
            },
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}
