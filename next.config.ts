import { withContentCollections } from '@content-collections/next';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * https://nextjs.org/docs/app/api-reference/config/next-config-js
 */
const nextConfig: NextConfig = {
  devIndicators: false,

  // Remove all console.* calls in production only
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  images: {
    // Cloudflare Workers requires unoptimized images
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: 'html.tailus.io',
      },
      {
        protocol: 'https',
        hostname: 'cdn.flowchartai.org',
      },
    ],
  },

  // Production optimizations
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },

  async redirects() {
    return [
      {
        source: '/blog/flowchart-symbols',
        destination: '/blog/flowchart-symbols-guide',
        permanent: true,
      },
      {
        source: '/:locale/blog/flowchart-symbols',
        destination: '/:locale/blog/flowchart-symbols-guide',
        permanent: true,
      },
      {
        source: '/tools/ai-flowchart-generator',
        destination: '/',
        permanent: true,
      },
      {
        source: '/:locale/tools/ai-flowchart-generator',
        destination: '/:locale',
        permanent: true,
      },
      {
        source: '/tools/flowchart-maker-ai',
        destination: '/',
        permanent: true,
      },
      {
        source: '/:locale/tools/flowchart-maker-ai',
        destination: '/:locale',
        permanent: true,
      },
    ];
  },
};

/**
 * You can specify the path to the request config file or use the default one (@/i18n/request.ts)
 *
 * https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing#next-config
 */
const withNextIntl = createNextIntlPlugin();

/**
 * withContentCollections must be the outermost plugin
 *
 * https://www.content-collections.dev/docs/quickstart/next
 */
export default withContentCollections(withNextIntl(nextConfig));

// Add OpenNext Cloudflare development support
if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare')
    .then(({ initOpenNextCloudflareForDev }) => {
      initOpenNextCloudflareForDev();
    })
    .catch(() => {
      // Silently fail if package is not available
    });
}
