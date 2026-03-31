import type { Locale } from 'next-intl';
import { redirect } from 'next/navigation';

interface SigninPageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SigninPage({
  params,
  searchParams,
}: SigninPageProps) {
  const { locale } = await params;
  const searchParamsResolved = await searchParams;

  // Build query string from search params
  const queryString = new URLSearchParams();
  Object.entries(searchParamsResolved).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => queryString.append(key, v));
      } else {
        queryString.append(key, value);
      }
    }
  });

  const queryStr = queryString.toString();
  const redirectUrl = queryStr
    ? `/${locale}/auth/login?${queryStr}`
    : `/${locale}/auth/login`;

  redirect(redirectUrl);
}
