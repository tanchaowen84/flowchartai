import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('@/components/auth/login-form', () => ({
  LoginForm: ({
    callbackUrl,
    embedded,
  }: {
    callbackUrl?: string;
    embedded?: boolean;
  }) => (
    <div
      data-login-form
      data-callback-url={callbackUrl}
      data-embedded={embedded || undefined}
    />
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

import { LoginDialogContent } from './login-dialog-content';

describe('LoginDialogContent', () => {
  it('uses the flowchart continuation title by default', () => {
    const markup = renderToStaticMarkup(<LoginDialogContent />);

    expect(markup).toContain('Continue to your flowchart');
    expect(markup).not.toContain('Continue to FlowChart AI');
  });

  it('uses the dialog as the only auth surface', () => {
    const markup = renderToStaticMarkup(
      <LoginDialogContent
        callbackUrl="/canvas/flow-1"
        title="Continue to your flowchart"
        description="Your draft is saved."
      />
    );

    expect(markup).toContain('Continue to your flowchart');
    expect(markup).toContain('Your draft is saved.');
    expect(markup).toContain('data-embedded="true"');
    expect(markup).toContain('data-callback-url="/canvas/flow-1"');
    expect(markup).not.toContain('Welcome back');
    expect(markup).not.toContain('logo');
  });
});
