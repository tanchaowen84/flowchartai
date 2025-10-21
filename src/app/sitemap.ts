import { websiteConfig } from '@/config/website';
import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { source } from '@/lib/docs/source';
import { allPosts } from 'content-collections';
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
    '/about',
    '/contact',
    '/changelog',
    '/privacy',
    '/terms',
    '/cookie',
    '/blog', // 添加博客主页
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

  // add static routes with different priorities
  sitemapList.push(
    ...staticRoutes.flatMap((route) => {
      // Set different priorities based on page importance
      let priority = 0.8; // default priority
      let changeFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly';

      if (route === '/') {
        priority = 1.0; // highest priority for homepage
        changeFrequency = 'daily';
      } else if (route === '/pricing') {
        priority = 0.9; // high priority for key pages
        changeFrequency = 'weekly';
      } else if (route === '/blog') {
        priority = 0.8; // high priority for blog main page
        changeFrequency = 'daily';
      } else if (route === '/about' || route === '/contact') {
        priority = 0.7; // medium priority for info pages
        changeFrequency = 'monthly';
      } else if (
        route.includes('/privacy') ||
        route.includes('/terms') ||
        route.includes('/cookie')
      ) {
        priority = 0.5; // lower priority for legal pages
        changeFrequency = 'monthly';
      }

      return routing.locales.map((locale) => ({
        url: getUrl(route, locale),
        lastModified: new Date(),
        priority,
        changeFrequency,
      }));
    })
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

  // 添加博客文章页面
  const publishedPosts = allPosts.filter((post) => post.published);
  if (publishedPosts.length > 0) {
    sitemapList.push(
      ...publishedPosts.flatMap((post) =>
        routing.locales.map((locale) => ({
          url: getUrl(post.slug, locale),
          lastModified: new Date(post.date),
          priority: 0.7,
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
