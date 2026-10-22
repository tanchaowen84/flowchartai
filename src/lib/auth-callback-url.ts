/** [INPUT] Untrusted auth destination. [OUTPUT] Local continuation URL. [POS] Shared auth redirect boundary. */
export function safeAuthCallback(
  value?: string | null,
  origin = 'https://flowchartai.org',
  fallback = '/dashboard'
): string {
  if (
    !value ||
    value.includes('\\') ||
    [...value].some((c) => c.charCodeAt(0) <= 32)
  )
    return fallback;
  try {
    const url = new URL(value, origin);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== new URL(origin).origin ||
      !/^https?:$/.test(url.protocol) ||
      decodedPath.startsWith('//') ||
      decodedPath.includes('\\') ||
      /\/(?:auth\/(?:login|register|error))\/?$/.test(decodedPath)
    )
      return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function withAuthCallbackUrl(
  authPath: string,
  callbackUrl?: string | null
): string {
  if (!callbackUrl) return authPath;

  const separator = authPath.includes('?') ? '&' : '?';
  return `${authPath}${separator}callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
