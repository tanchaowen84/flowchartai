import BlogCard from '@/components/blog/blog-card';
import { HeaderSection } from '@/components/layout/header-section';
import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { type Post, allPosts } from 'content-collections';
import { getLocale, getTranslations } from 'next-intl/server';

function getTutorialPosts(locale: string): Post[] {
  const tutorials = allPosts
    .filter((post) => post.published)
    .filter((post) =>
      post.categories?.some((category) => category?.slug === 'tutorial')
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const localized = tutorials.filter((post) => post.locale === locale);

  if (localized.length > 0) {
    return localized;
  }

  return tutorials;
}

export default async function TutorialsSection() {
  const t = await getTranslations('HomePage.tutorials');
  const locale = await getLocale();
  const tutorials = getTutorialPosts(locale);

  if (tutorials.length === 0) {
    return null;
  }

  const featured = tutorials.slice(0, 3);
  const more = tutorials.slice(3, 8);

  return (
    <section id="flowchart-tutorials" className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-12">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="p"
          descriptionAs="p"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((post) => (
            <BlogCard key={post.slugAsParams} post={post} />
          ))}
        </div>

        {more.length > 0 ? (
          <div className="flex justify-center">
            <Button asChild size="lg" variant="outline">
              <LocaleLink href="/blog">{t('allLink')}</LocaleLink>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
