import { websiteConfig } from '@/config/website';
import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { source } from '@/lib/docs/source';
import { allCategories, allPosts } from 'content-collections';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl } from '../lib/urls/urls';

type Href = Parameters<typeof getLocalePathname>[0]['href'];

/**
 * 根据功能开关动态生成静态路由列表
 */
function getEnabledStaticRoutes(): string[] {
  const baseRoutes = [
    '/',
    '/pricing',
    '/blog',
    '/about',
    '/contact',
    '/changelog',
    '/privacy',
    '/terms',
    '/cookie',
    '/auth/login',
    '/auth/register',
  ];

  // 条件性添加页面路由
  const conditionalRoutes: string[] = [];

  if (websiteConfig.features.enableDocsPage) {
    conditionalRoutes.push('/docs');
  }

  // 条件性添加AI页面路由
  if (websiteConfig.features.enableAIPages) {
    conditionalRoutes.push('/ai/text', '/ai/image', '/ai/video', '/ai/audio');
  }

  return [...baseRoutes, ...conditionalRoutes];
}

/**
 * Generate a sitemap for the website
 *
 * https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
 * https://github.com/javayhu/cnblocks/blob/main/app/sitemap.ts
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapList: MetadataRoute.Sitemap = []; // final result

  // 使用动态路由列表
  const staticRoutes = getEnabledStaticRoutes();

  // add static routes
  sitemapList.push(
    ...staticRoutes.flatMap((route) => {
      return routing.locales.map((locale) => ({
        url: getUrl(route, locale),
        lastModified: new Date(),
        priority: 1,
        changeFrequency: 'weekly' as const,
      }));
    })
  );

  // add categories
  sitemapList.push(
    ...allCategories.flatMap((category: { slug: string }) =>
      routing.locales.map((locale) => ({
        url: getUrl(`/blog/category/${category.slug}`, locale),
        lastModified: new Date(),
        priority: 0.8,
        changeFrequency: 'weekly' as const,
      }))
    )
  );

  // add paginated blog list pages
  routing.locales.forEach((locale) => {
    const posts = allPosts.filter(
      (post) => post.locale === locale && post.published
    );
    const totalPages = Math.max(
      1,
      Math.ceil(posts.length / websiteConfig.blog.paginationSize)
    );
    // /blog/page/[page] (from 2)
    for (let page = 2; page <= totalPages; page++) {
      sitemapList.push({
        url: getUrl(`/blog/page/${page}`, locale),
        lastModified: new Date(),
        priority: 0.8,
        changeFrequency: 'weekly' as const,
      });
    }
  });

  // add paginated category pages
  routing.locales.forEach((locale) => {
    const localeCategories = allCategories.filter(
      (category) => category.locale === locale
    );
    localeCategories.forEach((category) => {
      // posts in this category and locale
      const postsInCategory = allPosts.filter(
        (post) =>
          post.locale === locale &&
          post.published &&
          post.categories.some((cat) => cat && cat.slug === category.slug)
      );
      const totalPages = Math.max(
        1,
        Math.ceil(postsInCategory.length / websiteConfig.blog.paginationSize)
      );
      // /blog/category/[slug] (first page)
      sitemapList.push({
        url: getUrl(`/blog/category/${category.slug}`, locale),
        lastModified: new Date(),
        priority: 0.8,
        changeFrequency: 'weekly' as const,
      });
      // /blog/category/[slug]/page/[page] (from 2)
      for (let page = 2; page <= totalPages; page++) {
        sitemapList.push({
          url: getUrl(`/blog/category/${category.slug}/page/${page}`, locale),
          lastModified: new Date(),
          priority: 0.8,
          changeFrequency: 'weekly' as const,
        });
      }
    });
  });

  // add posts (single post pages)
  sitemapList.push(
    ...allPosts.flatMap((post: { slugAsParams: string; locale: string }) =>
      routing.locales
        .filter((locale) => post.locale === locale)
        .map((locale) => ({
          url: getUrl(`/blog/${post.slugAsParams}`, locale),
          lastModified: new Date(),
          priority: 0.8,
          changeFrequency: 'weekly' as const,
        }))
    )
  );

  // 条件性添加docs页面
  if (websiteConfig.features.enableDocsPage) {
    const docsParams = source.generateParams();
    sitemapList.push(
      ...docsParams.flatMap((param) =>
        routing.locales.map((locale) => ({
          url: getUrl(`/docs/${param.slug.join('/')}`, locale),
          lastModified: new Date(),
          priority: 0.8,
          changeFrequency: 'weekly' as const,
        }))
      )
    );
  }

  return sitemapList;
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getLocalePathname({ locale, href });
  return getBaseUrl() + pathname;
}

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#sitemap
 * https://github.com/amannn/next-intl/blob/main/examples/example-app-router/src/app/sitemap.ts
 */
function getEntries(href: Href) {
  return routing.locales.map((locale) => ({
    url: getUrl(href, locale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((cur) => [cur, getUrl(href, cur)])
      ),
    },
  }));
}
