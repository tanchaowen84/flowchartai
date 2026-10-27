import { betterFetch } from '@better-fetch/fetch';
import {
  anonymousCookie,
  qaCookie,
  uuidPattern,
} from '@site-insights/sdk/contracts';
import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { experimentQa } from './analytics/experiment-qa';
import { LOCALES, routing } from './i18n/routing';
import { safeAuthCallback } from './lib/auth-callback-url';
import type { Session } from './lib/auth-types';
import { isKnownUnlocalizedPath } from './lib/routing/known-unlocalized-paths';
import { originalRequestUrl } from './lib/routing/request-url';
import {
  DEFAULT_LOGIN_REDIRECT,
  protectedRoutes,
  routesNotAllowedByLoggedInUsers,
} from './routes';

const intlMiddleware = createMiddleware(routing);

/**
 * 1. Next.js middleware
 * https://nextjs.org/docs/app/building-your-application/routing/middleware
 *
 * 2. Better Auth middleware
 * https://www.better-auth.com/docs/integrations/next#middleware
 *
 * In Next.js middleware, it's recommended to only check for the existence of a session cookie
 * to handle redirection. To avoid blocking requests by making API or database calls.
 */
export default async function middleware(req: NextRequest) {
  // Even with skipMiddlewareUrlNormalize, nextUrl itself is normalized by Next.
  // next-intl reads nextUrl.search, so restore it from the original request URL.
  req.nextUrl.search = originalRequestUrl(req).search;
  const { nextUrl, headers } = req;
  console.log('>> middleware start, pathname', nextUrl.pathname);

  // do not use getSession() here, it will cause error related to edge runtime
  // const session = await getSession();
  const { data: session } = await betterFetch<Session>(
    '/api/auth/get-session',
    {
      baseURL: req.nextUrl.origin,
      headers: {
        cookie: req.headers.get('cookie') || '', // Forward the cookies from the request
      },
    }
  );
  const isLoggedIn = !!session;
  // console.log('middleware, isLoggedIn', isLoggedIn);

  // Get the pathname of the request (e.g. /zh/dashboard to /dashboard)
  const pathnameWithoutLocale = getPathnameWithoutLocale(
    nextUrl.pathname,
    LOCALES
  );

  // If the route can not be accessed by logged in users, redirect if the user is logged in
  if (isLoggedIn) {
    const isNotAllowedRoute = routesNotAllowedByLoggedInUsers.some((route) =>
      new RegExp(`^${route}$`).test(pathnameWithoutLocale)
    );
    if (isNotAllowedRoute) {
      console.log(
        '<< middleware end, not allowed route, already logged in, redirecting to dashboard'
      );
      return NextResponse.redirect(
        new URL(
          safeAuthCallback(
            nextUrl.searchParams.get('callbackUrl'),
            nextUrl.origin,
            DEFAULT_LOGIN_REDIRECT
          ),
          nextUrl
        )
      );
    }
  }

  const isProtectedRoute = protectedRoutes.some((route) =>
    new RegExp(`^${route}$`).test(pathnameWithoutLocale)
  );
  // console.log('middleware, isProtectedRoute', isProtectedRoute);

  // If the route is a protected route, redirect to login if user is not logged in
  if (!isLoggedIn && isProtectedRoute) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) {
      callbackUrl += nextUrl.search;
    }
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    console.log(
      '<< middleware end, not logged in, redirecting to login, callbackUrl',
      callbackUrl
    );
    return NextResponse.redirect(
      new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    );
  }

  const hasLocalePrefix = pathnameHasLocale(nextUrl.pathname, LOCALES);
  if (!hasLocalePrefix && !isKnownUnlocalizedPath(nextUrl.pathname)) {
    console.log(
      '<< middleware end, unknown unlocalized path, skipping intl rewrite'
    );
    return NextResponse.next();
  }

  // Apply intlMiddleware for all routes
  console.log('<< middleware end, applying intlMiddleware');
  if (process.env.SITE_INSIGHTS_EXPERIMENTS_ENABLED === 'true') {
    const site = process.env.SITE_INSIGHTS_SITE_ID || 'flowchart';
    const cookie = anonymousCookie(site);
    const old = req.cookies.get(cookie)?.value;
    const anonymous = old && uuidPattern.test(old) ? old : crypto.randomUUID();
    const qa = experimentQa(
      req.headers.get('cookie') || '',
      session?.user?.id,
      req.nextUrl.searchParams.get('insights_qa')
    );
    req.cookies.set(cookie, anonymous);
    req.cookies.set(qaCookie(site), qa ? '1' : '0');
    req.headers.set('x-insights-anonymous', anonymous);
    req.headers.set('x-insights-qa', qa ? '1' : '0');
    const response = intlMiddleware(req);
    response.cookies.set(qaCookie(site), qa ? '1' : '0', {
      path: '/',
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 31536000,
    });
    response.cookies.set(cookie, anonymous, {
      path: '/',
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 31536000,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  return intlMiddleware(req);
}

/**
 * Get the pathname of the request (e.g. /zh/dashboard to /dashboard)
 */
function getPathnameWithoutLocale(pathname: string, locales: string[]): string {
  const localePattern = new RegExp(`^/(${locales.join('|')})/`);
  return pathname.replace(localePattern, '/');
}

function pathnameHasLocale(pathname: string, locales: string[]): boolean {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return !!firstSegment && locales.includes(firstSegment);
}

/**
 * Next.js internationalized routing
 * specify the routes the middleware applies to
 *
 * https://next-intl.dev/docs/routing#base-path
 */
export const config = {
  // The `matcher` is relative to the `basePath`
  matcher: [
    // Match all pathnames except for
    // - if they start with `/api`, `/_next` or `/_vercel`
    // - if they contain a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
