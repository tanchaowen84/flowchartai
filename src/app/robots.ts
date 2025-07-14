import type { MetadataRoute } from 'next';
import { getBaseUrl } from '../lib/urls/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/*',
        '/_next/*',
        '/settings/*',
        '/dashboard/*',
        '/auth/*',
        '/canvas/*',
        '/admin/*',
      ],
    },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
