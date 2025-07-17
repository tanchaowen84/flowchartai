import { BlogCategoryFilter } from '@/components/blog/blog-category-filter';
import Container from '@/components/layout/container';
import type { Params } from '@/types/next-page-props';
import { allCategories } from 'content-collections';
import { getTranslations } from 'next-intl/server';
import type { PropsWithChildren } from 'react';

interface BlogListLayoutProps extends PropsWithChildren {
  params: Promise<Params>;
}

export default async function BlogListLayout({
  children,
  params,
}: BlogListLayoutProps) {
  const resolvedParams = await params;
  const { locale } = resolvedParams;
  const t = await getTranslations('BlogPage');

  // Filter categories by locale
  const categoryList = allCategories.filter(
    (category) => category.locale === locale
  );

  return (
    <div className="mb-16">
      <div className="mt-8 w-full flex flex-col items-center justify-center gap-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-center text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <h2 className="text-center text-lg text-muted-foreground">
            {t('subtitle')}
          </h2>
        </div>

        <BlogCategoryFilter categoryList={categoryList} />
      </div>

      <Container className="mt-8 px-4">{children}</Container>
    </div>
  );
}
