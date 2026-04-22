import path from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@/i18n/routing';
import { defineCollection, defineConfig } from '@content-collections/core';
import {
  createDocSchema,
  createMetaSchema,
  transformMDX,
} from '@fumadocs/content-collections/configuration';

/**
 * 1. Content Collections documentation
 * https://www.content-collections.dev/docs/quickstart/next
 * https://www.content-collections.dev/docs/configuration
 * https://www.content-collections.dev/docs/transform#join-collections
 *
 * 2. Use Content Collections for Fumadocs
 * https://fumadocs.dev/docs/headless/content-collections
 */
const docs = defineCollection({
  name: 'docs',
  directory: 'content/docs',
  include: '**/*.mdx',
  schema: (z) => ({
    ...createDocSchema(z),
    preview: z.string().optional(),
    index: z.boolean().default(false),
  }),
  transform: transformMDX,
});

const metas = defineCollection({
  name: 'meta',
  directory: 'content/docs',
  include: '**/meta**.json',
  parser: 'json',
  schema: createMetaSchema,
});

/**
 * Blog Author collection
 *
 * Authors are identified by their slug across all languages
 * New format: content/author/authorname.{locale}.mdx
 * Example: content/author/mksaas.mdx (default locale) and content/author/mksaas.zh.mdx (Chinese)
 *
 * For author, slug is slugAsParams
 */
export const authors = defineCollection({
  name: 'author',
  directory: 'content/author',
  include: '**/*.mdx',
  schema: (z) => ({
    slug: z.string(),
    name: z.string(),
    avatar: z.string(),
    locale: z.string().optional().default(DEFAULT_LOCALE),
  }),
  transform: async (data, context) => {
    // Get the filename from the path
    const filePath = data._meta.path;
    const fileName = filePath.split(path.sep).pop() || '';

    // Extract locale and base from filename
    const { locale, base } = extractLocaleAndBase(fileName);
    // console.log(`author processed: ${fileName}, locale=${locale}`);

    return {
      ...data,
      locale,
    };
  },
});

/**
 * Blog Category collection
 *
 * Categories are identified by their slug across all languages
 * New format: content/category/categoryname.{locale}.mdx
 * Example: content/category/tutorial.mdx (default locale) and content/category/tutorial.zh.mdx (Chinese)
 *
 * For category, slug is slugAsParams
 */
export const categories = defineCollection({
  name: 'category',
  directory: 'content/category',
  include: '**/*.mdx',
  schema: (z) => ({
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    locale: z.string().optional().default(DEFAULT_LOCALE),
  }),
  transform: async (data, context) => {
    // Get the filename from the path
    const filePath = data._meta.path;
    const fileName = filePath.split(path.sep).pop() || '';

    // Extract locale and base from filename
    const { locale, base } = extractLocaleAndBase(fileName);
    // console.log(`category processed: ${fileName}, locale=${locale}`);

    return {
      ...data,
      locale,
    };
  },
});

/**
 * Blog Post collection
 *
 * New format: content/blog/post-slug.{locale}.mdx
 *
 * slug: /blog/first-post, used in URL or sitemap
 * slugAsParams: first-post, used in route params
 *
 * 1. For a blog post at content/blog/first-post.mdx (default locale):
 * locale: en
 * slug: /blog/first-post
 * slugAsParams: first-post
 *
 * 2. For a blog post at content/blog/first-post.zh.mdx (Chinese locale):
 * locale: zh
 * slug: /blog/first-post
 * slugAsParams: first-post
 */
export const posts = defineCollection({
  name: 'post',
  directory: 'content/blog',
  include: '**/*.mdx',
  schema: (z) => ({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    date: z.string().datetime(),
    published: z.boolean().default(true),
    categories: z.array(z.string()),
    author: z.string(),
    estimatedTime: z.number().optional(), // Reading time in minutes
  }),
  transform: async (data, context) => {
    // Use Fumadocs transformMDX for consistent MDX processing
    const transformedData = await transformMDX(data, context);

    // Get the filename from the path
    const filePath = data._meta.path;
    const fileName = filePath.split(path.sep).pop() || '';

    // Extract locale and base from filename
    const { locale, base } = extractLocaleAndBase(fileName);
    // console.log(`post processed: ${fileName}, base=${base}, locale=${locale}`);

    // Find the author by matching slug and locale
    const blogAuthor = context
      .documents(authors)
      .find((a) => a.slug === data.author && a.locale === locale);

    // Find categories by matching slug and locale
    const blogCategories = data.categories
      .map((categorySlug) => {
        const category = context
          .documents(categories)
          .find((c) => c.slug === categorySlug && c.locale === locale);

        return category;
      })
      .filter(Boolean); // Remove null values

    // Create the slug and slugAsParams
    const slug = `/blog/${base}`;
    const slugAsParams = base;

    // Calculate estimated reading time only if not provided in frontmatter
    const estimatedTime =
      data.estimatedTime ||
      (() => {
        const wordCount = data.content.split(/\s+/).length;
        const wordsPerMinute = 200; // average reading speed: 200 words per minute
        return Math.max(Math.ceil(wordCount / wordsPerMinute), 1);
      })();

    return {
      ...data,
      locale,
      author: blogAuthor,
      categories: blogCategories,
      slug,
      slugAsParams,
      estimatedTime,
      body: transformedData.body,
      toc: transformedData.toc,
    };
  },
});

/**
 * Pages collection for policy pages like privacy-policy, terms-of-service, etc.
 *
 * New format: content/pages/page-slug.{locale}.mdx
 *
 * 1. For a page at content/pages/privacy-policy.mdx (default locale):
 * locale: en
 * slug: /pages/privacy-policy
 * slugAsParams: privacy-policy
 *
 * 2. For a page at content/pages/privacy-policy.zh.mdx (Chinese locale):
 * locale: zh
 * slug: /pages/privacy-policy
 * slugAsParams: privacy-policy
 */
export const pages = defineCollection({
  name: 'page',
  directory: 'content/pages',
  include: '**/*.mdx',
  schema: (z) => ({
    title: z.string(),
    description: z.string(),
    date: z.string().datetime(),
    published: z.boolean().default(true),
  }),
  transform: async (data, context) => {
    // Use Fumadocs transformMDX for consistent MDX processing
    const transformedData = await transformMDX(data, context);

    // Get the filename from the path
    const filePath = data._meta.path;
    const fileName = filePath.split(path.sep).pop() || '';

    // Extract locale and base from filename
    const { locale, base } = extractLocaleAndBase(fileName);
    // console.log(`page processed: ${fileName}, base=${base}, locale=${locale}`);

    // Create the slug and slugAsParams
    const slug = `/pages/${base}`;
    const slugAsParams = base;

    return {
      ...data,
      locale,
      slug,
      slugAsParams,
      body: transformedData.body,
      toc: transformedData.toc,
    };
  },
});

/**
 * Releases collection for changelog
 *
 * New format: content/release/version-slug.{locale}.mdx
 *
 * 1. For a release at content/release/v1-0-0.mdx (default locale):
 * locale: en
 * slug: /release/v1-0-0
 * slugAsParams: v1-0-0
 *
 * 2. For a release at content/release/v1-0-0.zh.mdx (Chinese locale):
 * locale: zh
 * slug: /release/v1-0-0
 * slugAsParams: v1-0-0
 */
export const releases = defineCollection({
  name: 'release',
  directory: 'content/release',
  include: '**/*.mdx',
  schema: (z) => ({
    title: z.string(),
    description: z.string(),
    date: z.string().datetime(),
    version: z.string(),
    published: z.boolean().default(true),
  }),
  transform: async (data, context) => {
    // Use Fumadocs transformMDX for consistent MDX processing
    const transformedData = await transformMDX(data, context);

    // Get the filename from the path
    const filePath = data._meta.path;
    const fileName = filePath.split(path.sep).pop() || '';

    // Extract locale and base from filename
    const { locale, base } = extractLocaleAndBase(fileName);
    // console.log(`release processed: ${fileName}, base=${base}, locale=${locale}`);

    // Create the slug and slugAsParams
    const slug = `/release/${base}`;
    const slugAsParams = base;

    return {
      ...data,
      locale,
      slug,
      slugAsParams,
      body: transformedData.body,
      toc: transformedData.toc,
    };
  },
});

/**
 * Helper function to extract locale and base name from filename
 * Handles filename formats:
 * - name -> locale: DEFAULT_LOCALE, base: name
 * - name.zh -> locale: zh, base: name
 *
 * @param fileName Filename without extension (already has .mdx removed)
 * @returns Object with locale and base name
 */
function extractLocaleAndBase(fileName: string): {
  locale: string;
  base: string;
} {
  // Split filename into parts
  const parts = fileName.split('.');

  if (parts.length === 1) {
    // Simple filename without locale: xxx
    return { locale: DEFAULT_LOCALE, base: parts[0] };
  }
  if (parts.length === 2 && LOCALES.includes(parts[1])) {
    // Filename with locale: xxx.zh
    return { locale: parts[1], base: parts[0] };
  }
  // Unexpected format, use first part as base and default locale
  console.warn(`Unexpected filename format: ${fileName}`);
  return { locale: DEFAULT_LOCALE, base: parts[0] };
}

export default defineConfig({
  collections: [docs, metas, authors, categories, posts, pages, releases],
});
