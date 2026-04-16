import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — Infogiph',
  description:
    'Infogiph cookie policy. Learn what cookies and local storage we use, why, and how to manage your preferences.',
  openGraph: {
    title: 'Infogiph Cookie Policy',
    description: 'How Infogiph uses cookies and browser storage.',
  },
};

export default function CookiePolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 prose prose-neutral prose-headings:font-semibold prose-headings:tracking-tight">
      <h1>Cookie Policy</h1>
      <p className="lead">
        Last updated: April 15, 2026
      </p>

      <p>
        This policy explains how Infogiph uses cookies and similar
        technologies when you visit infogiph.com.
      </p>

      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files stored in your browser. They help
        websites remember your preferences and maintain sessions.
      </p>

      <h2>2. Cookies we use</h2>

      <h3>Essential cookies</h3>
      <p>
        Required for authentication and session management. These cannot be
        disabled without breaking the sign-in flow.
      </p>
      <ul>
        <li>
          <strong>Session cookie</strong> — identifies your logged-in session
          (HTTP-only, secure, expires on browser close or after 30 days).
        </li>
        <li>
          <strong>CSRF token</strong> — protects form submissions against
          cross-site request forgery.
        </li>
      </ul>

      <h3>Functional storage</h3>
      <p>
        We use <code>localStorage</code> (not cookies) to remember canvas
        preferences such as the last-used template, aspect ratio, and
        auto-generate inputs. This data never leaves your browser.
      </p>

      <h3>Analytics</h3>
      <p>
        We use privacy-friendly, cookie-free analytics (Plausible or
        equivalent). No tracking cookies are set for analytics purposes.
      </p>

      <h2>3. Third-party cookies</h2>
      <p>
        We do not set third-party advertising cookies. OAuth providers (Google,
        GitHub) may set their own cookies during the sign-in flow, governed by
        their own privacy policies.
      </p>

      <h2>4. Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings. Blocking
        essential cookies will prevent you from signing in. Clearing
        <code>localStorage</code> will reset your canvas preferences.
      </p>

      <h2>5. Changes</h2>
      <p>
        We may update this policy when we change how we use cookies. The
        &quot;last updated&quot; date at the top reflects the latest revision.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:support@infogiph.com">support@infogiph.com</a> or
        visit our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
    </article>
  );
}
