'use client';
import { useState } from 'react';
export function DeveloperConsent({
  client,
  scopes,
  redirectOrigin,
  query,
}: {
  client: string;
  scopes: string[];
  redirectOrigin: string;
  query: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function respond(approved: boolean) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/developer/management', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'consent', query, approved }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || 'Could not authorize this client.'
        );
      window.location.assign(data.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed.');
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto my-16 max-w-xl rounded-2xl border p-6 sm:p-9">
      <p className="text-sm text-muted-foreground">
        FlowchartAI · connection request
      </p>
      <h1 className="mt-3 break-words text-2xl font-semibold">
        Connect {client}?
      </h1>
      <p className="mt-4 text-muted-foreground">
        This app will access your FlowchartAI account with the permissions
        below. AI generation and edits can spend your existing allowance, within
        your developer daily budget.
      </p>
      <ul className="my-6 space-y-2">
        {scopes.map((scope) => (
          <li key={scope} className="rounded-lg bg-muted px-3 py-2 text-sm">
            <code>{scope}</code>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        You will return to{' '}
        <span className="break-all font-medium text-foreground">
          {redirectOrigin}
        </span>
        . You can revoke this connection in your developer dashboard.
      </p>
      {error && (
        <p role="alert" className="mt-5 text-destructive">
          {error}
        </p>
      )}
      <div className="mt-7 flex gap-3">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-foreground px-5 py-2 text-background disabled:opacity-50"
          onClick={() => void respond(true)}
        >
          {busy ? 'Connecting…' : 'Allow connection'}
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border px-5 py-2"
          onClick={() => void respond(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
