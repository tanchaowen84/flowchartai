import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ buttons: [] as any[], buy: vi.fn() }));
vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => {
    f.buttons.push(props);
    return (
      <button type="button" disabled={props.disabled}>
        {props.children}
      </button>
    );
  },
}));
vi.mock('@/components/ui/card', () => ({
  Card: (p: any) => <div>{p.children}</div>,
  CardContent: (p: any) => <div>{p.children}</div>,
  CardHeader: (p: any) => <div>{p.children}</div>,
  CardTitle: (p: any) => <div>{p.children}</div>,
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'review-owner' } } }),
  },
}));
vi.mock('@/i18n/navigation', () => ({
  useLocalePathname: () => '/pricing',
  LocaleLink: (p: any) => <a href={p.href}>{p.children}</a>,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./use-credit-checkout', () => ({
  useCreditCheckout: () => ({
    pending: null,
    error: '',
    url: '',
    buy: f.buy,
    trackHandoff: () => {},
  }),
}));
import { CreditPricing } from './credit-pricing';
it('first authenticated pricing render blocks purchase until quote resolution', () => {
  const html = renderToStaticMarkup(<CreditPricing />);
  const small = f.buttons.filter((p) => p.children === 'Buy credits')[0];

  expect(html).toContain('1,500');
  expect(small.disabled).toBe(true);
});
