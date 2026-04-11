import { DEFAULT_LOCALE } from '@/i18n/routing';
import { allCategories, allPosts } from 'content-collections';

const EXACT_PATHS = new Set([
  '/',
  '/pricing',
  '/blog',
  '/about',
  '/contact',
  '/changelog',
  '/cookie',
  '/privacy',
  '/terms',
  '/auth/login',
  '/auth/register',
  '/auth/error',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback/flowchart',
  '/dashboard',
  '/admin/users',
  '/settings/profile',
  '/settings/billing',
  '/settings/security',
  '/settings/notifications',
  '/ai/text',
  '/ai/image',
  '/ai/video',
  '/ai/audio',
  '/canvas',
  '/blog/flowchart-symbols',
  '/tools/ai-flowchart-generator',
  '/tools/flowchart-maker-ai',
]);

const SINGLE_SEGMENT_DYNAMIC_PATTERNS = [/^\/canvas\/[^/]+$/];

const VALID_BLOG_PATHS = buildValidBlogPaths();

export function isKnownUnlocalizedPath(pathname: string): boolean {
  const normalizedPath = normalizePathname(pathname);

  return (
    EXACT_PATHS.has(normalizedPath) ||
    VALID_BLOG_PATHS.has(normalizedPath) ||
    SINGLE_SEGMENT_DYNAMIC_PATTERNS.some((pattern) =>
      pattern.test(normalizedPath)
    )
  );
}

function buildValidBlogPaths(): Set<string> {
  const paths = new Set<string>();
  const publishedPosts = getPublishedPostsForDefaultLocale();
  const paginationSize = 6;

  for (const post of publishedPosts) {
    paths.add(`/blog/${post.slugAsParams}`);
  }

  const totalPages = Math.ceil(publishedPosts.length / paginationSize);
  for (let page = 2; page <= totalPages; page++) {
    paths.add(`/blog/page/${page}`);
  }

  const defaultLocaleCategories = allCategories.filter(
    (category) => category.locale === DEFAULT_LOCALE
  );

  for (const category of defaultLocaleCategories) {
    paths.add(`/blog/category/${category.slug}`);

    const categoryPostsCount = publishedPosts.filter((post) =>
      post.categories.some(
        (postCategory) => postCategory?.slug === category.slug
      )
    ).length;
    const categoryTotalPages = Math.ceil(categoryPostsCount / paginationSize);

    for (let page = 2; page <= categoryTotalPages; page++) {
      paths.add(`/blog/category/${category.slug}/page/${page}`);
    }
  }

  return paths;
}

function getPublishedPostsForDefaultLocale() {
  const localePosts = allPosts.filter(
    (post) => post.published && post.locale === DEFAULT_LOCALE
  );

  if (localePosts.length > 0) {
    return localePosts;
  }

  return allPosts.filter((post) => post.published);
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/+$/, '');
}
