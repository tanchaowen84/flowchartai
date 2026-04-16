import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Infogiph',
  description:
    'Infogiph terms of service. Rules for using our AI infographic generator, content ownership, acceptable use, and liability.',
  openGraph: {
    title: 'Infogiph Terms of Service',
    description: 'Terms governing use of the Infogiph platform.',
  },
};

export default function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 prose prose-neutral prose-headings:font-semibold prose-headings:tracking-tight">
      <h1>Terms of Service</h1>
      <p className="lead">
        Last updated: April 15, 2026
      </p>

      <p>
        By using Infogiph (&quot;the Service&quot;), you agree to these terms. If you
        do not agree, do not use the Service.
      </p>

      <h2>1. The service</h2>
      <p>
        Infogiph provides AI-powered infographic and diagram generation. You
        provide text prompts or images; we return editable, exportable
        diagrams. The Service is provided &quot;as is&quot; without warranty.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You may sign in via Google or GitHub. You are responsible for
        maintaining the security of your account. Notify us immediately if you
        suspect unauthorized access.
      </p>

      <h2>3. Content ownership</h2>
      <p>
        You own the diagrams you create. By using the Service, you grant
        Infogiph a limited license to process your content (prompts, uploaded
        images, diagrams) solely to provide and improve the Service.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service to generate illegal, harmful, or misleading content</li>
        <li>Reverse-engineer the AI models or scrape the Service</li>
        <li>Resell AI-generated outputs as a competing service</li>
        <li>Circumvent usage limits or authentication mechanisms</li>
        <li>Upload content you do not have the right to use</li>
      </ul>

      <h2>5. Usage limits</h2>
      <p>
        Free accounts are limited to 1 AI generation per day. Paid plans have
        higher limits as described on the{' '}
        <Link href="/pricing">pricing page</Link>. We reserve the right to
        throttle or suspend accounts that abuse the Service.
      </p>

      <h2>6. Payment and billing</h2>
      <p>
        Paid plans are billed monthly or annually via Stripe. Refunds are
        handled on a case-by-case basis. Contact{' '}
        <a href="mailto:support@infogiph.com">support@infogiph.com</a> for
        billing inquiries.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or terminate
        accounts that violate these terms. Upon termination, your saved
        diagrams will be deleted within 30 days.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Infogiph is not liable for
        indirect, incidental, or consequential damages arising from your use
        of the Service. Our total liability is limited to the amount you paid
        us in the 12 months preceding the claim.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. Continued use after changes constitutes
        acceptance. Material changes will be communicated via email.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Delaware, United
        States.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:support@infogiph.com">support@infogiph.com</a> or
        visit our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
    </article>
  );
}
