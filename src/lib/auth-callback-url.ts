export function withAuthCallbackUrl(
  authPath: string,
  callbackUrl?: string | null
): string {
  if (!callbackUrl) return authPath;

  const separator = authPath.includes('?') ? '&' : '?';
  return `${authPath}${separator}callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
