/**
 * [INPUT] Actual checkout request headers and the existing auth secret.
 * [OUTPUT] Authenticated encrypted context, expiring after seven days.
 * [POS] Carries anonymous visitor attribution through the signed webhook.
 * [UPDATE] Sync payment conversion and tampering/expiry tests after changes.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { visitorHeaders } from './plausible-server';

const MAX_AGE = 7 * 86400000;
function contextKey(secret: string): Buffer {
  return createHash('sha256')
    .update(`flowchart-plausible-v1:${secret}`)
    .digest();
}

export function sealCheckoutContext(
  headers: Headers,
  secret = process.env.BETTER_AUTH_SECRET,
  now = Date.now()
): string | null {
  try {
    if (!secret) return null;
    const visitor = visitorHeaders(headers);
    if (!visitor) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', contextKey(secret), iv);
    const encrypted = Buffer.concat([
      cipher.update(
        JSON.stringify({ visitor, expires: now + MAX_AGE }),
        'utf8'
      ),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64url'
    );
  } catch {
    return null;
  }
}

export function openCheckoutContext(
  token: string,
  secret = process.env.BETTER_AUTH_SECRET,
  now = Date.now()
): Headers | null {
  try {
    if (!secret || token.length > 1600) return null;
    const bytes = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      contextKey(secret),
      bytes.subarray(0, 12)
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const parsed = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString('utf8')
    );
    if (
      !Number.isFinite(parsed.expires) ||
      parsed.expires < now ||
      parsed.expires > now + MAX_AGE
    )
      return null;
    const headers = new Headers(parsed.visitor);
    return visitorHeaders(headers) ? headers : null;
  } catch {
    return null;
  }
}
