import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Infogiph',
  description:
    'Infogiph privacy policy. Learn how we collect, use, and protect your personal data when you use our AI infographic generator.',
  openGraph: {
    title: 'Infogiph Privacy Policy',
    description: 'How Infogiph handles your data.',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 prose prose-neutral prose-headings:font-semibold prose-headings:tracking-tight">
      <h1>Privacy Policy</h1>
      <p className="lead">
        Last updated: April 15, 2026
      </p>

      <p>
        Infogiph (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the infogiph.com
        website and AI infographic generation service. This policy explains
        what data we collect, why, and how we protect it.
      </p>

      <h2>1. Information we collect</h2>
      <h3>Account data</h3>
      <p>
        When you sign up via Google or GitHub OAuth, we receive your name,
        email address, and profile picture. We do not receive or store your
        password.
      </p>
      <h3>Usage data</h3>
      <p>
        We log AI generation requests (prompt text, model used, timestamp) to
        enforce usage limits and improve the service. Prompts are not shared
        with third parties.
      </p>
      <h3>Uploaded images</h3>
      <p>
        Images you upload for AI vision analysis are sent to our AI provider
        (OpenRouter / Google Gemini) for processing. They are not stored on
        our servers after the request completes.
      </p>
      <h3>Analytics</h3>
      <p>
        We use privacy-friendly analytics (Plausible or equivalent) that do
        not use cookies and do not track individuals across sites.
      </p>

      <h2>2. How we use your data</h2>
      <ul>
        <li>Authenticate your account and manage sessions</li>
        <li>Enforce free-tier and paid-tier usage limits</li>
        <li>Save your flowcharts and diagrams</li>
        <li>Improve the AI generation quality</li>
        <li>Send transactional emails (account, billing)</li>
      </ul>

      <h2>3. Data sharing</h2>
      <p>
        We do not sell your personal data. We share data only with:
      </p>
      <ul>
        <li>
          <strong>AI providers</strong> (OpenRouter / Google) — prompt text and
          uploaded images to generate diagrams.
        </li>
        <li>
          <strong>Infrastructure providers</strong> (Vercel, Cloudflare,
          Supabase) — hosting, storage, and database.
        </li>
        <li>
          <strong>Payment processors</strong> (Stripe) — if you upgrade to a
          paid plan.
        </li>
      </ul>

      <h2>4. Data retention</h2>
      <p>
        Account data and saved diagrams are retained while your account is
        active. You can delete your account and all associated data by
        contacting{' '}
        <a href="mailto:support@infogiph.com">support@infogiph.com</a>.
      </p>

      <h2>5. Security</h2>
      <p>
        All traffic is encrypted via HTTPS. Database credentials are stored in
        environment variables, never in source code. OAuth tokens are managed
        by Better Auth with secure HTTP-only cookies.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Depending on your jurisdiction (GDPR, CCPA), you may have the right
        to access, correct, delete, or export your data. Contact{' '}
        <a href="mailto:support@infogiph.com">support@infogiph.com</a> to
        exercise these rights.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        communicated via email or a banner on the site.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about this policy? Email{' '}
        <a href="mailto:support@infogiph.com">support@infogiph.com</a> or
        visit our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
    </article>
  );
}
