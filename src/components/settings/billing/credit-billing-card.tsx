'use client';
import { CreditPricing } from '@/components/pricing/credit-pricing';
import { CustomerPortalButton } from '@/components/pricing/customer-portal-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
type Wallet = {
  balance: number;
  reserved: number;
  legacy: { plan: string; limit: number; manual?: boolean } | null;
  buckets: { source: string; remaining: number; expiresAt: string | null }[];
  subscriptions: {
    id: string;
    offerKey: string;
    status: string;
    paidThrough: string;
  }[];
  history: {
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }[];
};
export function CreditBillingCard(): React.ReactElement {
  const { data: session } = authClient.useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/wallet', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to load credits');
      setWallet(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load credits');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const refresh = () => {
      void reload();
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [reload]);
  async function manage(): Promise<void> {
    try {
      const res = await fetch('/api/billing/manage', { method: 'POST' });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || 'Unable to manage subscription');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open billing');
    }
  }
  const active = wallet?.subscriptions.find(
    (s) =>
      new Date(s.paidThrough) > new Date() &&
      ['active', 'canceling', 'canceled', 'past_due'].includes(s.status)
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {wallet?.legacy ? 'Your original plan' : 'Credits'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {wallet ? (
            <>
              {wallet.legacy && (
                <div className="space-y-2">
                  <p className="font-medium">
                    Legacy {wallet.legacy.plan} · original benefits retained
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {wallet.legacy.manual
                      ? 'Your granted membership and'
                      : 'Your original price and'}{' '}
                    original AI allowance continue while your subscription is
                    valid. AI requests included in this plan do not spend your
                    credits. After that allowance, you can choose to use your
                    credit balance.
                  </p>
                  {session && !wallet.legacy.manual && (
                    <CustomerPortalButton userId={session.user.id}>
                      Manage original subscription
                    </CustomerPortalButton>
                  )}
                </div>
              )}
              <p>
                <span className="text-3xl font-semibold">
                  {wallet.balance.toLocaleString()}
                </span>{' '}
                <span className="text-muted-foreground">credits available</span>
                {wallet.reserved > 0 && (
                  <span className="ml-3 text-sm text-muted-foreground">
                    {wallet.reserved} reserved for AI
                  </span>
                )}
              </p>
              {active && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    {active.offerKey.startsWith('pro') ? 'Pro' : 'Starter'} ·{' '}
                    {active.status === 'active'
                      ? 'Paid through'
                      : 'Renewal stopped; paid through'}{' '}
                    {new Date(active.paidThrough).toLocaleDateString()}
                  </p>
                  <Button variant="outline" size="sm" onClick={manage}>
                    Manage subscription
                  </Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Credits with the nearest expiry are used first. Your historical
                and purchased permanent credits keep their value.
              </p>
              {wallet.buckets.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer">
                    Credit allowances
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {wallet.buckets.map((b, i) => (
                      <li
                        key={`${b.source}-${i}`}
                        className="flex justify-between gap-4"
                      >
                        <span>
                          {b.source} · {b.remaining.toLocaleString()}
                        </span>
                        <span>
                          {b.expiresAt
                            ? `Expires ${new Date(b.expiresAt).toLocaleDateString()}`
                            : 'Never expires'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Loading your balance…
            </p>
          )}
        </CardContent>
      </Card>
      <CreditPricing compact legacy={Boolean(wallet?.legacy)} />
      {wallet && wallet.history.length > 0 && (
        <details className="rounded-xl border p-4 text-sm">
          <summary className="cursor-pointer">Credit history</summary>
          <ul className="mt-4 divide-y">
            {wallet.history.map((h, i) => (
              <li
                key={`${h.createdAt}-${i}`}
                className="flex justify-between gap-3 py-2"
              >
                <span>
                  {h.description} · {new Date(h.createdAt).toLocaleDateString()}
                </span>
                <span>
                  {h.type === 'add' ? '+' : '−'}
                  {h.amount}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-muted-foreground">
        For an unused first purchase within 7 days,{' '}
        <a href="mailto:support@flowchartai.org" className="underline">
          contact support
        </a>{' '}
        to request a refund. A refund and stopping renewal are separate actions.
      </p>
    </div>
  );
}
