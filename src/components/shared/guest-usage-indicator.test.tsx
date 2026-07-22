import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/i18n/navigation', () => ({
  LocaleLink: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
}));

import { GuestUsageIndicator } from './guest-usage-indicator';

describe('GuestUsageIndicator', () => {
  it('shows one quiet path to continue with AI', () => {
    const markup = renderToStaticMarkup(
      <GuestUsageIndicator onContinue={() => undefined} />
    );

    expect(markup).toContain('Continue with AI');
    expect(markup).toContain(
      'Sign in or create a free account to keep generating flowcharts.'
    );
    expect(markup).toContain('Continue for free');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).not.toContain('AI Assistant Locked');
    expect(markup).not.toContain('Generate flowcharts with AI');
    expect(markup).not.toContain('Create Free Account');
    expect(markup).not.toContain('Sign In to Use AI');
  });
});
