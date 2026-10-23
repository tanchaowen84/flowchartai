import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/en.json';
const fixture = vi.hoisted(() => ({
  callback: '/canvas/fixture?panel=ai#draft',
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ callbackUrl: fixture.callback }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: keyof typeof messages.AuthPage.login) =>
    messages.AuthPage.login[key],
}));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));
vi.mock('@/components/layout/logo', () => ({ Logo: () => <span>Logo</span> }));
vi.mock('@/i18n/navigation', () => ({
  LocaleLink: ({
    href,
    children,
  }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

describe('shared verified email entry', () => {
  it('registers through email verification without first collecting name/password', () => {
    const html = renderToStaticMarkup(<RegisterForm />);
    expect(html).toContain('Create an account');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('Continue with email');
    expect(html).toContain('after you verify');
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain('name="password"');
    expect(html).toContain('Use password instead');
    expect(html).toContain(
      '/auth/login?callbackUrl=%2Fcanvas%2Ffixture%3Fpanel%3Dai%23draft'
    );
  });
  it('preserves the same destination when switching from login to registration', () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toContain(
      '/auth/register?callbackUrl=%2Fcanvas%2Ffixture%3Fpanel%3Dai%23draft'
    );
    fixture.callback = 'https://evil.test/';
    expect(renderToStaticMarkup(<LoginForm />)).toContain(
      '/auth/register?callbackUrl=%2Fdashboard'
    );
    fixture.callback = '/canvas/fixture?panel=ai#draft';
  });
});
