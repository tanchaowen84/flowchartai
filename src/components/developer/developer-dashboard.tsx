'use client';
import { SCOPES } from '@/developer/scopes';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Credential = {
  id: string;
  kind: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  dailyCredits: number;
  dailyRequests: number;
  rateLimit: number;
  usage?: { credits: number; requests: number };
};
type Data = {
  credentials: Credential[];
  settings: { dailyCredits: number; dailyRequests: number };
  usage: { credits: number; reserved: number; requests: number };
  tasks: Array<{
    id: string;
    state: string;
    operation: string;
    charged_credits: number;
    created_at: string;
  }>;
};
const field = 'rounded-lg border bg-background px-3 py-2 w-full';
const button =
  'inline-flex items-center justify-center rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50';
export function DeveloperDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string[]>([...SCOPES]);
  async function load() {
    const response = await fetch('/api/developer/management', {
      cache: 'no-store',
    });
    if (response.status === 401) {
      setLogin(true);
      return;
    }
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message || 'Could not load developer access.'
      );
    setData(body);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function action(body: unknown) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/developer/management', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || 'The request failed.');
      if (result.key) setRevealed(result.key);
      await load();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  }
  const keys = data?.credentials.filter((c) => c.kind === 'key') || [];
  const connections = data?.credentials.filter((c) => c.kind === 'oauth') || [];
  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            FlowchartAI developers
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Keys, connections and usage
          </h1>
          <p className="mt-3 text-muted-foreground">
            Control access to your diagrams and existing AI allowance.
          </p>
        </div>
        <Link
          href="/developers/docs"
          className="text-sm underline underline-offset-4"
        >
          Read the documentation →
        </Link>
      </div>
      {error && (
        <p
          role="alert"
          className="my-6 rounded-xl border border-destructive p-4 text-destructive"
        >
          {error}
        </p>
      )}
      {login ? (
        <div className="my-10 rounded-2xl border p-8">
          <h2 className="text-xl font-medium">Sign in to create a key</h2>
          <p className="mt-2 mb-5 text-muted-foreground">
            Use the same account as your saved flowcharts.
          </p>
          <Link className={button} href="/auth/login?callbackUrl=%2Fdevelopers">
            Sign in
          </Link>
        </div>
      ) : !data ? (
        <output className="my-10 block">Loading developer access…</output>
      ) : (
        <>
          {revealed && (
            <section
              className="mt-8 rounded-2xl border border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 p-5"
              aria-label="New API key"
            >
              <h2 className="font-semibold">Copy your key now</h2>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">
                This is the only time the full key is shown. Keep it in your
                server's secret store.
              </p>
              <code className="block break-all rounded-lg border bg-background p-3 text-sm">
                {revealed}
              </code>
              <div className="mt-3 flex gap-3">
                <button
                  className={button}
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(revealed)
                      .catch(() =>
                        setError(
                          'Copy is unavailable here. Select and copy the displayed key.'
                        )
                      );
                  }}
                >
                  Copy key
                </button>
                <button
                  className="px-3 text-sm underline"
                  type="button"
                  onClick={() => setRevealed('')}
                >
                  I saved it · dismiss
                </button>
              </div>
            </section>
          )}
          <section
            className="mt-10 grid gap-4 sm:grid-cols-3"
            aria-label="Today’s developer usage"
          >
            {[
              ['Credits spent', data.usage.credits],
              ['Credits reserved', data.usage.reserved],
              ['AI requests', data.usage.requests],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-5">
                <p className="text-sm text-muted-foreground">{label} today</p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </section>
          <section className="mt-10 rounded-2xl border p-5 sm:p-7">
            <h2 className="text-xl font-semibold">Account daily budget</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Shared across all API keys and MCP connections. Resets at 00:00
              UTC. Website usage uses your usual allowance.
            </p>
            <form
              className="mt-5 flex flex-wrap items-end gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action({
                  action: 'settings',
                  input: {
                    daily_credits: Number(f.get('credits')),
                    daily_requests: Number(f.get('requests')),
                  },
                });
              }}
            >
              <label className="grow text-sm">
                Credits per day
                <input
                  className={`${field} mt-2`}
                  name="credits"
                  type="number"
                  min="1"
                  max="1000000"
                  defaultValue={data.settings.dailyCredits}
                  required
                />
              </label>
              <label className="grow text-sm">
                AI requests per day
                <input
                  className={`${field} mt-2`}
                  name="requests"
                  type="number"
                  min="1"
                  max="10000"
                  defaultValue={data.settings.dailyRequests}
                  required
                />
              </label>
              <button type="submit" className={button} disabled={busy}>
                Save budget
              </button>
            </form>
          </section>
          <section className="mt-12">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">API keys</h2>
              <button
                type="button"
                className={button}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? 'Close form' : 'Create key'}
              </button>
            </div>
            {showForm && (
              <form
                className="mt-5 rounded-2xl border p-5 sm:p-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action({
                    action: 'create',
                    input: {
                      name: String(f.get('name')),
                      scopes: selected,
                      expires_in_days: Number(f.get('days')),
                      daily_credits: Number(f.get('credits')),
                      daily_requests: Number(f.get('requests')),
                      requests_per_minute: Number(f.get('rpm')),
                    },
                  }).then((r) => {
                    if (r) setShowForm(false);
                  });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Key name
                    <input
                      name="name"
                      className={`${field} mt-2`}
                      placeholder="Documentation automation"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label className="text-sm">
                    Expires in days
                    <input
                      name="days"
                      className={`${field} mt-2`}
                      type="number"
                      defaultValue="90"
                      min="1"
                      max="365"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    Credits per day
                    <input
                      name="credits"
                      className={`${field} mt-2`}
                      type="number"
                      defaultValue={Math.min(1000, data.settings.dailyCredits)}
                      min="1"
                      max="1000000"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    AI requests per day
                    <input
                      name="requests"
                      className={`${field} mt-2`}
                      type="number"
                      defaultValue="100"
                      min="1"
                      max="10000"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    Requests per minute
                    <input
                      name="rpm"
                      className={`${field} mt-2`}
                      type="number"
                      defaultValue="60"
                      min="1"
                      max="120"
                      required
                    />
                  </label>
                </div>
                <fieldset className="my-5">
                  <legend className="mb-3 text-sm font-medium">
                    Permissions
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SCOPES.map((scope) => (
                      <label
                        key={scope}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(scope)}
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked
                                ? [...old, scope]
                                : old.filter((s) => s !== scope)
                            )
                          }
                        />
                        <code>{scope}</code>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  type="submit"
                  className={button}
                  disabled={busy || !selected.length}
                >
                  Create API key
                </button>
              </form>
            )}
            <div className="mt-5 space-y-3">
              {keys.length ? (
                keys.map((c) => (
                  <CredentialRow
                    key={c.id}
                    credential={c}
                    busy={busy}
                    action={action}
                  />
                ))
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No API keys yet. Create one for your server or MCP client.
                </p>
              )}
            </div>
          </section>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">MCP connections</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Revoking a connection immediately blocks its access and refresh
              tokens.
            </p>
            <div className="mt-5 space-y-3">
              {connections.length ? (
                connections.map((c) => (
                  <CredentialRow
                    key={c.id}
                    credential={c}
                    busy={busy}
                    action={action}
                  />
                ))
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Connect an OAuth MCP client using{' '}
                  <code className="break-all">
                    https://flowchartai.org/api/mcp
                  </code>
                  .
                </p>
              )}
            </div>
          </section>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Recent tasks</h2>
            <div className="mt-5 overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {['Task', 'Action', 'Status', 'Credits'].map((h) => (
                      <th className="px-4 py-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map((t) => (
                    <tr className="border-t" key={t.id}>
                      <td className="px-4 py-3">
                        <code>{t.id.slice(0, 8)}</code>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">{t.operation}</td>
                      <td className="px-4 py-3">{t.state}</td>
                      <td className="px-4 py-3">{t.charged_credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.tasks.length && (
                <p className="p-5 text-muted-foreground">
                  Your API and MCP operations will appear here.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function CredentialRow({
  credential: c,
  busy,
  action,
}: {
  credential: Credential;
  busy: boolean;
  action: (body: unknown) => Promise<unknown>;
}) {
  const inactive = !!c.revokedAt || new Date(c.expiresAt) < new Date();
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5">
      <div className="min-w-0">
        <h3 className="font-medium">
          {c.name}{' '}
          <span className="text-xs font-normal text-muted-foreground">
            {c.revokedAt ? 'Revoked' : inactive ? 'Expired' : 'Active'}
          </span>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {c.kind === 'key' ? `${c.prefix}… · ` : ''}Expires{' '}
          {new Date(c.expiresAt).toLocaleDateString()}
        </p>
        <p className="mt-2 break-words text-xs text-muted-foreground">
          {c.scopes.join(' · ')}
        </p>
        <p className="mt-2 text-xs">
          {c.dailyCredits} credits/day · {c.dailyRequests} AI requests/day ·{' '}
          {c.rateLimit} requests/min
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Today: {c.usage?.credits || 0} credits · {c.usage?.requests || 0} AI
          requests. Last used:{' '}
          {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : 'Never'}
        </p>
      </div>
      {!inactive && (
        <div className="flex gap-3">
          {c.kind === 'key' && (
            <button
              type="button"
              className="text-sm underline"
              disabled={busy}
              aria-label={`Rotate ${c.name}`}
              onClick={() => void action({ action: 'rotate', id: c.id })}
            >
              Rotate
            </button>
          )}
          <button
            type="button"
            className="text-sm text-destructive underline"
            disabled={busy}
            aria-label={`Revoke ${c.name}`}
            onClick={() => void action({ action: 'revoke', id: c.id })}
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}
