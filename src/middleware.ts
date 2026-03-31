import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { LOCALES, routing } from './i18n/routing';
import { createSupabaseMiddlewareClient } from './lib/supabase-middleware';
import {
  DEFAULT_LOGIN_REDIRECT,
  protectedRoutes,
  routesNotAllowedByLoggedInUsers,
} from './routes';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  console.log('>> middleware start, pathname', nextUrl.pathname);

  // Get the pathname without locale prefix (e.g. /zh/dashboard → /dashboard)
  const pathnameWithoutLocale = getPathnameWithoutLocale(
    nextUrl.pathname,
    LOCALES
  );

  // Skip authentication check for animate route to avoid slow loading
  const isAnimateRoute = pathnameWithoutLocale === '/animate';

  let isLoggedIn = false;

  if (!isAnimateRoute) {
    // Create Supabase middleware client which handles session refresh
    const { supabase, supabaseResponse } = createSupabaseMiddlewareClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = !!user;

    // If the route can not be accessed by logged in users, redirect
    if (isLoggedIn) {
      const isNotAllowedRoute = routesNotAllowedByLoggedInUsers.some((route) =>
        new RegExp(`^${route}$`).test(pathnameWithoutLocale)
      );
      if (isNotAllowedRoute) {
        console.log(
          '<< middleware end, not allowed route, already logged in, redirecting to dashboard'
        );
        return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
      }
    }

    const isProtectedRoute = protectedRoutes.some((route) =>
      new RegExp(`^${route}$`).test(pathnameWithoutLocale)
    );

    // If the route is protected and user is not logged in, redirect to login
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

    // Apply intlMiddleware and merge Supabase session cookies
    const intlResponse = intlMiddleware(req);

    // Copy Supabase session-refresh cookies into the intl response
    for (const cookie of supabaseResponse.cookies.getAll()) {
      intlResponse.cookies.set(cookie.name, cookie.value);
    }

    console.log('<< middleware end, applying intlMiddleware');
    return intlResponse;
  }

  // For animate route, skip auth check entirely
  console.log('<< middleware end, applying intlMiddleware');
  return intlMiddleware(req);
}

/**
 * Get the pathname of the request (e.g. /zh/dashboard to /dashboard)
 */
function getPathnameWithoutLocale(pathname: string, locales: string[]): string {
  const localePattern = new RegExp(`^/(${locales.join('|')})/`);
  return pathname.replace(localePattern, '/');
}

/**
 * Next.js internationalized routing
 * specify the routes the middleware applies to
 */
export const config = {
  matcher: [
    // Match all pathnames except for
    // - if they start with `/api`, `/_next` or `/_vercel`
    // - if they contain a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
