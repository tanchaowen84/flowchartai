import { getBaseUrl } from '../../lib/urls/urls';

const marketingAllows = [
  'Allow: /',
  'Allow: /pricing',
  'Allow: /blog',
  'Allow: /llms.txt',
  'Allow: /llms-full.txt',
];

const userAreas = [
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

  // Default rule for all crawlers
  lines.push('User-agent: *', ...marketingAllows, ...userAreas, '');

  // AI-focused crawlers: allow marketing/product content, block user-generated areas
  aiAgents.forEach((agent) => {
    lines.push(`User-agent: ${agent}`, ...marketingAllows, ...userAreas, '');
  });

  // Googlebot keeps standard access to public marketing pages
  lines.push('User-agent: Googlebot', ...marketingAllows, ...userAreas, '');

  // Metadata for AI discovery
  lines.push(
    `LLM-Content: ${baseUrl}/llms.txt`,
    `LLM-Full-Content: ${baseUrl}/llms-full.txt`,
    `Sitemap: ${baseUrl}/sitemap.xml`
  );

  const body = lines.join('\n');

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
