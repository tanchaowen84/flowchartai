import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Infogiph — AI-Powered Infographic & Diagram Generator',
  description:
    'Infogiph turns plain-text descriptions into animated, editable infographics. Learn how our AI diagram generator helps teams visualize architecture, data flows, and org charts in seconds.',
  openGraph: {
    title: 'About Infogiph — AI Infographic Generator',
    description:
      'Turn ideas into animated infographics with AI. Export as PNG, SVG, GIF, or MP4.',
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-4xl font-bold tracking-tight mb-6">
        About Infogiph
      </h1>

      <p className="text-lg text-muted-foreground leading-relaxed mb-10">
        Infogiph is an AI-powered infographic and diagram generator. Describe
        what you want in plain English and Infogiph produces a polished,
        animated diagram you can edit, customize, and export — in seconds, not
        hours.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Why we built Infogiph</h2>
      <p className="text-base text-muted-foreground leading-relaxed mb-8">
        Architecture diagrams, data-flow charts, and org charts are essential
        for communicating ideas — yet most tools require hours of manual
        layout, expensive subscriptions, or deep design skills. Infogiph
        removes those barriers. A single sentence like &quot;SaaS platform with
        auth, billing, and analytics&quot; produces a professional diagram with
        icons, labels, and animated connections. You iterate by typing, not
        dragging.
      </p>

      <h2 className="text-2xl font-semibold mb-4">What you can do</h2>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-8">
        <li>
          <strong>Generate from text</strong> — describe any system and get a
          hub-and-spoke or tree diagram instantly.
        </li>
        <li>
          <strong>Generate from images</strong> — upload a screenshot or
          whiteboard photo and let AI build a clean diagram from it.
        </li>
        <li>
          <strong>Start from templates</strong> — Chatbot, SaaS, E-Commerce,
          Data Pipeline, Social Platform, AI Agent, and Org Chart blueprints.
        </li>
        <li>
          <strong>Edit visually</strong> — drag nodes, rename labels, change
          icons, adjust animation speed.
        </li>
        <li>
          <strong>Export anywhere</strong> — PNG for decks, SVG for editors,
          GIF for social, MP4 for video. Multiple aspect ratios (1:1, 9:16,
          16:9, 4:5, 4:3).
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mb-4">Built for everyone</h2>
      <p className="text-base text-muted-foreground leading-relaxed mb-8">
        Infogiph is designed for product managers, engineers, marketers,
        educators, and founders — anyone who needs to communicate a system
        visually. No design background required. The free tier includes one AI
        generation per day; paid plans unlock hundreds of generations per
        month, premium exports, and priority support.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Open source</h2>
      <p className="text-base text-muted-foreground leading-relaxed mb-10">
        Infogiph is open source and built with Next.js, React, and Tailwind
        CSS. Contributions, feedback, and feature requests are welcome.
      </p>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/canvas"
          className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try Infogiph free
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          Get in touch
        </Link>
      </div>
    </div>
  );
}
