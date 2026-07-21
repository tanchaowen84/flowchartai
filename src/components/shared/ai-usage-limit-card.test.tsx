// biome-ignore lint/style/useImportType: Vitest's JSX transform requires React at runtime.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

import { AIUsageLimitCard } from './ai-usage-limit-card';

describe('AIUsageLimitCard', () => {
  it('shows one accurate, simple path to the pricing modal', () => {
    const markup = renderToStaticMarkup(
      <AIUsageLimitCard
        usedCount={100}
        totalLimit={100}
        currentPlan="hobby"
        onUpgrade={() => undefined}
        onLearnMore={() => undefined}
      />
    );

    expect(markup).toContain('100 of 100 available AI requests');
    expect(markup).toContain('View plans');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).not.toContain('Upgrade to Professional Now');
    expect(markup).not.toContain('Start from just');
    expect(markup).not.toContain('Priority support');
  });
});
