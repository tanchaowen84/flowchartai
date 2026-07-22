export function buildRobotsTxt(
  baseUrl: string,
  marketingAllows: readonly string[],
  userAreas: readonly string[],
  aiAgents: readonly string[]
): string {
  const lines: string[] = ['# Crawl rules'];

  lines.push('User-agent: *', ...marketingAllows, ...userAreas, '');

  aiAgents.forEach((agent) => {
    lines.push(`User-agent: ${agent}`, ...marketingAllows, ...userAreas, '');
  });

  lines.push('User-agent: Googlebot', ...marketingAllows, ...userAreas, '');
  lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);

  return lines.join('\n');
}
