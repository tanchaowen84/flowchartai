import { describe, expect, it } from 'vitest';
import { buildRobotsTxt } from './robots';

describe('robots.txt', () => {
  it('keeps llms files crawlable without non-standard robots directives', () => {
    const body = buildRobotsTxt(
      'https://flowchartai.org',
      ['Allow: /', 'Allow: /llms.txt', 'Allow: /llms-full.txt'],
      ['Disallow: /api/'],
      ['GPTBot']
    );

    expect(body).toContain('Allow: /llms.txt');
    expect(body).toContain('Allow: /llms-full.txt');
    expect(body).toContain('Sitemap:');
    expect(body).not.toContain('LLM-Content:');
    expect(body).not.toContain('LLM-Full-Content:');
  });
});
