import { NotFoundContent } from '@/components/layout/not-found-content';
import Link from 'next/link';

/**
 * Catching non-localized requests
 *
 * This page renders when a route like `/unknown.txt` is requested.
 * In this case, the layout at `app/[locale]/layout.tsx` receives
 * an invalid value as the `[locale]` param and calls `notFound()`.
 *
 * https://next-intl.dev/docs/environments/error-files#catching-non-localized-requests
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <NotFoundContent
          title="404"
          message="Sorry, the page you are looking for does not exist."
          homeLink={<Link href="/">Back to home</Link>}
        />
      </body>
    </html>
  );
}
