import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Infogiph Changelog — Product Updates & New Features',
  description:
    'See what is new in Infogiph. Latest releases, new templates, export improvements, AI model upgrades, and canvas editor enhancements.',
  openGraph: {
    title: 'Infogiph Changelog',
    description:
      'Latest product updates for the AI infographic generator.',
  },
};

const releases = [
  {
    version: '0.5.0',
    date: 'April 2026',
    title: 'Canva-like editor, image-to-diagram, multi-size export',
    items: [
      'Drag-and-drop editing — reposition any node on the canvas',
      'Click-to-edit labels — rename nodes inline',
      'Animation speed slider (0.3x to 3.0x)',
      'Image upload with AI vision — upload a photo and Infogiph builds a diagram from it',
      'Export size presets: 1:1 Square, 9:16 Story, 4:5 Portrait, 16:9 Landscape, 4:3 Widescreen',
      'Canvas aspect ratio preview — see the final export shape before downloading',
      'infogiph.com watermark on all exports',
      'Deterministic SMIL-based frame capture for smoother GIF and MP4 exports',
      'Fixed MP4 AVC level auto-selection for high-resolution presets',
    ],
  },
  {
    version: '0.4.0',
    date: 'April 2026',
    title: 'Animated beam previews and real brand icons',
    items: [
      'Hub-and-spoke, radial, pipeline, and tree diagram layouts',
      'Four animation modes: dots, beams, pulses, arrows',
      'Real brand SVG icons: WhatsApp, Slack, OpenAI, GitHub, Notion, Stripe, Shopify, Instagram, TikTok, YouTube, Google Drive, and 12 more',
      'Per-template accent colors and cohesive backgrounds',
      'Canvas grid-paper background for precise positioning',
    ],
  },
  {
    version: '0.3.0',
    date: 'March 2026',
    title: 'Homepage redesign and template showcase',
    items: [
      'New landing page with AppShell layout (Geist font, clean visual style)',
      'Homepage template selector with animated previews',
      'AI prompt bar with template and aspect ratio pickers',
      '7 built-in templates: Chatbot, SaaS, E-Commerce, Data Pipeline, Social Platform, AI Agent, Org Chart',
      'Features section, FAQ, and footer with SEO-optimized links',
    ],
  },
  {
    version: '0.2.0',
    date: 'March 2026',
    title: 'FlowViz Architect and export pipeline',
    items: [
      'AI-powered diagram generation from text prompts via OpenRouter and Gemini Flash',
      'Radial and tree SVG renderers with framer-motion animations',
      'Export to PNG, SVG, GIF, and MP4',
      'Flowchart save/load with PostgreSQL via Drizzle ORM',
      'Authentication via Better Auth (Google, GitHub OAuth)',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-4xl font-bold tracking-tight mb-4">Changelog</h1>
      <p className="text-lg text-muted-foreground mb-12">
        What&apos;s new in Infogiph — features, fixes, and improvements.
      </p>

      <div className="space-y-14">
        {releases.map((r) => (
          <article key={r.version}>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="inline-flex items-center rounded-full bg-foreground text-background px-2.5 py-0.5 text-xs font-semibold">
                v{r.version}
              </span>
              <span className="text-sm text-muted-foreground">{r.date}</span>
            </div>
            <h2 className="text-xl font-semibold mb-3">{r.title}</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground text-sm">
              {r.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-border">
        <p className="text-muted-foreground mb-4">
          Want to request a feature or report a bug?
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
