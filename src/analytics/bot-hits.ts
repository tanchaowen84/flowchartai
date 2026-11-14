/**
 * Site Insights bot-hit counter (docs/BOT-HITS.md in the site-insights repo).
 * Vercel gives us no readable server logs, so middleware forwards AI and search
 * bot page requests to Insights, which verifies the IP against each vendor's
 * published ranges and keeps counts only.
 */
export const BOT_UA =
  /OAI-SearchBot|ChatGPT-User|GPTBot|PerplexityBot|Perplexity-User|Claude-SearchBot|Claude-User|ClaudeBot|bingbot|Googlebot|Applebot/i;

/**
 * Returns the background POST for a bot request, or null for everyone else.
 * Never throws and never rejects, so callers can hand it to waitUntil.
 */
export function reportBotHit(request: Request): Promise<void> | null {
  const ua = request.headers.get('user-agent') || '';
  const key = process.env.SITE_INSIGHTS_WRITE_KEY;
  if (!key || !BOT_UA.test(ua)) return null;
  // Vercel sets x-real-ip itself; x-forwarded-for / cf-connecting-ip can be faked by visitors.
  const ip = request.headers.get('x-real-ip') || '';
  const endpoint =
    process.env.SITE_INSIGHTS_ENDPOINT || 'https://myplausible.app/insights';
  return fetch(`${endpoint}/api/v1/bot-hits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      site_id: process.env.SITE_INSIGHTS_SITE_ID || 'flowchart',
      hits: [{ ua, ip, path: new URL(request.url).pathname }],
    }),
    signal: AbortSignal.timeout(5000),
  }).then(
    () => undefined,
    () => undefined
  );
}
