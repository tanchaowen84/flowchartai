export const EXPLICITLY_NOINDEX_MARKETING_PAGES = [
  '/about',
  '/contact',
  '/changelog',
] as const;

type ExplicitlyNoIndexMarketingPage =
  (typeof EXPLICITLY_NOINDEX_MARKETING_PAGES)[number];

const explicitlyNoIndexMarketingPageSet =
  new Set<ExplicitlyNoIndexMarketingPage>(EXPLICITLY_NOINDEX_MARKETING_PAGES);

export function isExplicitlyNoIndexMarketingPage(pathname: string): boolean {
  const normalizedPath = normalizePathname(pathname);

  return explicitlyNoIndexMarketingPageSet.has(
    normalizedPath as ExplicitlyNoIndexMarketingPage
  );
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/+$/, '');
}
