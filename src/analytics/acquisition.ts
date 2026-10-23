/** First-party source observation. No URL queries or identity leave this module. */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
export const ACQUISITION_COOKIE = 'flowchart_acquisition';
const MAX_AGE = 30 * 86400000;
export interface Acquisition {
  captureKey: string;
  kind: 'direct_observed' | 'campaign' | 'referral' | 'unknown';
  entry: string;
  source: string | null;
  medium: string | null;
  referrer: string | null;
  capturedAt: number;
}
function label(value: string | null): string | null {
  return value && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value) ? value : null;
}
export function captureAcquisition(
  url: string,
  referrer: string,
  now = Date.now()
): Acquisition {
  const page = new URL(url);
  const path =
    page.pathname.replace(/^\/(en|zh|ja|es|fr|de)(?=\/|$)/, '') || '/';
  const entry = path.startsWith('/canvas/')
    ? '/canvas/:id'
    : /^\/(auth|settings)\//.test(path)
      ? `/${path.split('/')[1]}/:page`
      : path === '/' || /^\/[a-z-]{1,64}$/.test(path)
        ? path
        : '/other';
  let host: string | null = null;
  try {
    const ref = new URL(referrer);
    if (ref.origin !== page.origin && /^https?:$/.test(ref.protocol))
      host = ref.hostname.slice(0, 253);
  } catch {}
  const source = label(page.searchParams.get('utm_source'));
  const medium = label(page.searchParams.get('utm_medium'));
  return {
    captureKey: randomUUID(),
    kind: source
      ? 'campaign'
      : host
        ? 'referral'
        : !referrer &&
            ![...page.searchParams.keys()].some((key) =>
              /^utm_|^(gclid|fbclid|msclkid)$/.test(key)
            )
          ? 'direct_observed'
          : 'unknown',
    entry,
    source,
    medium,
    referrer: host,
    capturedAt: now,
  };
}
export function sealAcquisition(value: Acquisition, secret: string): string {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function openAcquisition(
  token: string,
  secret: string,
  now = Date.now()
): Acquisition | null {
  try {
    if (token.length > 2000) return null;
    const [body, sig, extra] = token.split('.');
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (
      extra ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      return null;
    const value = JSON.parse(Buffer.from(body, 'base64url').toString());
    return Number.isFinite(value.capturedAt) &&
      value.capturedAt <= now &&
      value.capturedAt >= now - MAX_AGE
      ? value
      : null;
  } catch {
    return null;
  }
}
export function registrationAcquisition(
  value: Acquisition | null,
  registeredAt: number
): Acquisition {
  return value && value.capturedAt <= registeredAt
    ? value
    : {
        captureKey: '',
        kind: 'unknown',
        entry: '/unknown',
        source: null,
        medium: null,
        referrer: null,
        capturedAt: registeredAt,
      };
}
