import { describe, expect, it } from 'vitest';
import { resolveBaseUrl } from './base-url';

describe('resolveBaseUrl', () => {
  it('uses the Vercel deployment URL for preview deployments', () => {
    expect(
      resolveBaseUrl({
        NEXT_PUBLIC_BASE_URL: 'https://flowchartai.org',
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'flowchartai-git-mastra.example.vercel.app',
      })
    ).toBe('https://flowchartai-git-mastra.example.vercel.app');
  });

  it('keeps the configured public URL in production', () => {
    expect(
      resolveBaseUrl({
        NEXT_PUBLIC_BASE_URL: 'https://flowchartai.org',
        VERCEL_ENV: 'production',
        VERCEL_URL: 'flowchartai-production.example.vercel.app',
      })
    ).toBe('https://flowchartai.org');
  });

  it('falls back to the local port without a configured URL', () => {
    expect(resolveBaseUrl({ PORT: '4321' })).toBe('http://localhost:4321');
  });
});
