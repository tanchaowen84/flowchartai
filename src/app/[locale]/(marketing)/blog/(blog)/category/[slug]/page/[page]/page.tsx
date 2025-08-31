import BlogGridWithPagination from '@/components/blog/blog-grid-with-pagination';
import { websiteConfig } from '@/config/website';
import { LOCALES } from '@/i18n/routing';
import { getPaginatedBlogPosts } from '@/lib/blog/data';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { allCategories, allPosts } from 'content-collections';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

// Generate all static params for SSG (locale + category + pagination)
export function generateStaticParams() {
  const params: { locale: string; slug: string; page: string }[] = [];
  for (const locale of LOCALES) {
    const localeCategories = allCategories.filter(
      (category) => category.locale === locale
    );
    for (const category of localeCategories) {
      const totalPages = Math.ceil(
        allPosts.filter(
          (post) =>
            post.locale === locale &&
            post.categories.some((cat) => cat && cat.slug === category.slug)
        ).length / websiteConfig.blog.paginationSize
      );
      for (let page = 2; page <= totalPages; page++) {
        params.push({ locale, slug: category.slug, page: String(page) });
      }
    }
  }
  return params;
}

// Generate metadata for each static category page (locale + category + pagination)
export async function generateMetadata({ params }: BlogCategoryPageProps) {
  const { locale, slug, page } = await params;
  const category = allCategories.find(
    (category) => category.slug === slug && category.locale === locale
  );
  if (!category) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const canonicalPath = `/blog/category/${slug}/page/${page}`;
  return constructMetadata({
    title: category.name,
    description: category.description,
    canonicalUrl: getUrlWithLocale(canonicalPath, locale),
  });
}

interface BlogCategoryPageProps {
  params: Promise<{
    locale: Locale;
    slug: string;
    page: string;
  }>;
}

export default async function BlogCategoryPage({
  params,
}: BlogCategoryPageProps) {
  const { locale, slug, page } = await params;
  const currentPage = Number(page);
  const category = allCategories.find(
    (category) => category.slug === slug && category.locale === locale
  );
  if (!category) {
    notFound();
  }
  const { paginatedPosts, totalPages } = getPaginatedBlogPosts({
    locale,
    page: currentPage,
    category: slug,
  });
  return (
    <BlogGridWithPagination
      posts={paginatedPosts}
      totalPages={totalPages}
      routePrefix={`/blog/category/${slug}`}
    />
  );
}
