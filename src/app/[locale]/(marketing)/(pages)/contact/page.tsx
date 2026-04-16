import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Infogiph — Support, Feedback & Partnerships',
  description:
    'Get in touch with the Infogiph team. Report bugs, request features, ask about pricing, or explore partnership opportunities for AI-powered infographics.',
  openGraph: {
    title: 'Contact Infogiph',
    description:
      'Reach the Infogiph team for support, feedback, or partnerships.',
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-4xl font-bold tracking-tight mb-6">Contact us</h1>

      <p className="text-lg text-muted-foreground leading-relaxed mb-10">
        We read every message. Whether you have a bug report, feature request,
        pricing question, or partnership idea — we want to hear from you.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 mb-12">
        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold mb-2">General support</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Questions about your account, exports, templates, or the canvas
            editor.
          </p>
          <a
            href="mailto:support@infogiph.com"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            support@infogiph.com
          </a>
        </div>

        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold mb-2">Partnerships</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Interested in integrating Infogiph into your product, content
            pipeline, or classroom?
          </p>
          <a
            href="mailto:hello@infogiph.com"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            hello@infogiph.com
          </a>
        </div>

        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold mb-2">Bug reports</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Found something broken? Open an issue on GitHub or email us
            directly.
          </p>
          <a
            href="mailto:bugs@infogiph.com"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            bugs@infogiph.com
          </a>
        </div>

        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold mb-2">Social</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Follow us for product updates, tips, and community highlights.
          </p>
          <span className="text-sm font-medium text-foreground">
            @infogiph on X
          </span>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4">
        Frequently asked questions
      </h2>
      <p className="text-muted-foreground mb-6">
        Before reaching out, check our{' '}
        <Link href="/" className="underline underline-offset-4 font-medium">
          homepage FAQ section
        </Link>{' '}
        — your question may already be answered.
      </p>

      <Link
        href="/canvas"
        className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Try Infogiph free
      </Link>
    </div>
  );
}
