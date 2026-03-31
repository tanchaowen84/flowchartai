import { getBaseUrl } from '../../lib/urls/urls';

const disallowRules = [
  'Disallow: /api/',
  'Disallow: /_next/',
  'Disallow: /static/',
  'Disallow: /404',
  'Disallow: /500',
  'Disallow: /*.json$',
  'Disallow: /auth/',
  'Disallow: /settings/',
  'Disallow: /dashboard/',
  'Disallow: /admin/',
  'Disallow: /canvas/',
];

const aiAgents = [
  'GPTBot',
  'Claude-Web',
  'Anthropic-AI',
  'PerplexityBot',
  'GoogleOther',
  'DuckAssistBot',
];

export function GET(): Response {
  const baseUrl = getBaseUrl().replace(/\/$/, '');

  const lines: string[] = ['# Crawl rules'];

  // Default rule: allow everything except user/system areas
  lines.push('User-agent: *', 'Allow: /', ...disallowRules, '');

  // AI-focused crawlers: same rules with LLM content pointers
  for (const agent of aiAgents) {
    lines.push(`User-agent: ${agent}`, 'Allow: /', ...disallowRules, '');
  }

  // Metadata for AI discovery
  lines.push(
    `LLM-Content: ${baseUrl}/llms.txt`,
    `LLM-Full-Content: ${baseUrl}/llms-full.txt`,
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`
  );

  const body = lines.join('\n');

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
