import { getBaseUrl } from '@/lib/urls/urls';
import { defaultMessages } from '@/i18n/messages';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const baseUrl = getBaseUrl();
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: defaultMessages.Metadata.name,
        url: baseUrl,
        logo: `${baseUrl}/logo.png`,
        sameAs: [
          'https://x.com/tanchaowen84',
          'https://github.com/tanchaowen84/flowchartai',
        ],
      }}
    />
  );
}

export function WebSiteJsonLd() {
  const baseUrl = getBaseUrl();
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: defaultMessages.Metadata.name,
        url: baseUrl,
        description: defaultMessages.Metadata.description,
      }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  href: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const baseUrl = getBaseUrl();
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.href.startsWith('http')
            ? item.href
            : `${baseUrl}${item.href}`,
        })),
      }}
    />
  );
}

interface BlogPostingJsonLdProps {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  authorName?: string;
}

export function BlogPostingJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  image,
  authorName = 'InfoGiph Team',
}: BlogPostingJsonLdProps) {
  const baseUrl = getBaseUrl();
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description,
        url: url.startsWith('http') ? url : `${baseUrl}${url}`,
        datePublished,
        dateModified: dateModified || datePublished,
        image: image
          ? image.startsWith('http')
            ? image
            : `${baseUrl}${image}`
          : `${baseUrl}/og.png`,
        author: {
          '@type': 'Person',
          name: authorName,
        },
        publisher: {
          '@type': 'Organization',
          name: defaultMessages.Metadata.name,
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/logo.png`,
          },
        },
      }}
    />
  );
}
