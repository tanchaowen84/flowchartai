import BlogGridWithPagination from '@/components/blog/blog-grid-with-pagination';
import { websiteConfig } from '@/config/website';
import { LOCALES } from '@/i18n/routing';
import { getPaginatedBlogPosts } from '@/lib/blog/data';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { allPosts } from 'content-collections';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export function generateStaticParams() {
  const paginationSize = websiteConfig.blog.paginationSize;
  const params: { locale: string; page: string }[] = [];
  for (const locale of LOCALES) {
    const publishedPosts = allPosts.filter(
      (post) => post.published && post.locale === locale
    );
    const totalPages = Math.max(
      1,
      Math.ceil(publishedPosts.length / paginationSize)
    );
    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
      params.push({
        locale,
        page: String(pageNumber),
      });
    }
  }
  return params;
}

export async function generateMetadata({ params }: BlogListPageProps) {
  const { locale, page } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'BlogPage' });
  const canonicalPath = `/blog/page/${page}`;
  return constructMetadata({
    title: pt('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale(canonicalPath, locale),
  });
}

interface BlogListPageProps {
  params: Promise<{
    locale: Locale;
    page: string;
  }>;
}

export default async function BlogListPage({ params }: BlogListPageProps) {
  const { page, locale } = await params;
  const currentPage = Number(page);
  const { paginatedPosts, totalPages } = getPaginatedBlogPosts({
    locale,
    page: currentPage,
  });
  return (
    <BlogGridWithPagination
      posts={paginatedPosts}
      totalPages={totalPages}
      routePrefix={'/blog'}
    />
  );
}
