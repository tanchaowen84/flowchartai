export type BaseUrlEnvironment = {
  NEXT_PUBLIC_BASE_URL?: string;
  PORT?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

export function resolveBaseUrl(environment: BaseUrlEnvironment): string {
  if (environment.VERCEL_ENV === 'preview' && environment.VERCEL_URL) {
    return `https://${environment.VERCEL_URL}`;
  }

  return (
    environment.NEXT_PUBLIC_BASE_URL ??
    `http://localhost:${environment.PORT ?? 3000}`
  );
}
