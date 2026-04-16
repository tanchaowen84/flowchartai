import type {
  FaqItem,
  FeatureCard,
  FooterColumn,
  TemplateCategory,
  TemplateItem,
} from '@/components/blocks/infogiph-home/types';

export const categories: TemplateCategory[] = [
  'All',
  'Architecture',
  'Business',
  'Data',
  'People',
];

// The 7 templates mirror the in-editor sidebar picker in
// src/components/canvas/flowviz-architect.tsx. Selecting a card takes the
// user into the canvas where the same picker is available.
export const templates: TemplateItem[] = [
  {
    slug: 'chatbot',
    title: 'Chatbot Architecture',
    description: 'NLP, dialog manager, and channel integrations',
    category: 'Architecture',
    demo: 'chatbot',
  },
  {
    slug: 'saas',
    title: 'SaaS Platform',
    description: 'Auth, billing, and microservices',
    category: 'Architecture',
    demo: 'saas',
  },
  {
    slug: 'ecommerce',
    title: 'E-Commerce Flow',
    description: 'Cart, payments, fulfillment',
    category: 'Business',
    demo: 'ecommerce',
  },
  {
    slug: 'data-pipeline',
    title: 'Data Pipeline',
    description: 'ETL ingestion, transform, warehouse',
    category: 'Data',
    demo: 'data-pipeline',
  },
  {
    slug: 'social-media',
    title: 'Social Platform',
    description: 'Feed, media, messaging, analytics',
    category: 'Architecture',
    demo: 'social',
  },
  {
    slug: 'ai-agent',
    title: 'AI Agent System',
    description: 'LLM, tools, memory, and orchestration',
    category: 'Data',
    demo: 'ai-agent',
  },
  {
    slug: 'org-chart',
    title: 'Org Chart',
    description: 'Company structure with roles and reports',
    category: 'People',
    demo: 'org-chart',
  },
];

export const features: FeatureCard[] = [
  {
    title: 'AI Infographic Designer',
    description:
      'Turn a sentence into a polished, animated infographic. Infogiph handles layout, hierarchy, and flow so you focus on the message.',
    tags: ['AI infographics', 'auto layout', 'instant diagrams'],
    icon: 'sparkle',
    demo: 'designer',
    href: '/canvas',
  },
  {
    title: 'Animated Diagrams',
    description:
      'Architecture, org charts, and data flows come to life with motion that reveals relationships and sequence.',
    tags: ['animated diagrams', 'motion graphics', 'flowcharts'],
    icon: 'play',
    demo: 'animator',
    href: '/canvas',
  },
  {
    title: 'Flowchart Templates',
    description:
      'Start from chatbot, SaaS, e-commerce, data pipeline, or org chart blueprints — then remix with AI.',
    tags: ['templates', 'starter flows', 'diagram library'],
    icon: 'layers',
    demo: 'graphics',
    href: '/canvas',
  },
  {
    title: 'Export Anywhere',
    description:
      'Ship as SVG, PNG, GIF or MP4. Perfect for decks, docs, blog posts, and social — optimized for every surface.',
    tags: ['SVG', 'GIF', 'MP4', 'PNG'],
    icon: 'share',
    demo: 'social',
    href: '/canvas',
  },
  {
    title: 'Smart Labels & Types',
    description:
      'Typography tuned for readability. Auto-balanced labels, icon-matched nodes, and sensible spacing out of the box.',
    tags: ['typography', 'icon set', 'readability'],
    icon: 'type',
    demo: 'typeface',
    href: '/canvas',
  },
  {
    title: 'Text to Visual',
    description:
      'Describe a system — "payment flow from cart to confirmation" — and Infogiph builds it. Iterate with follow-ups.',
    tags: ['text to diagram', 'AI prompts', 'iteration'],
    icon: 'video',
    demo: 'text',
    href: '/canvas',
  },
];

export const faqs: FaqItem[] = [
  {
    q: 'What is Infogiph?',
    a: 'Infogiph is an AI-powered infographic and diagram generator. Describe what you want and Infogiph produces an animated, editable diagram you can export to SVG, PNG, GIF, or MP4.',
  },
  {
    q: 'How are the templates used?',
    a: 'Each template is a starting blueprint — Chatbot Architecture, SaaS Platform, E-Commerce Flow, Data Pipeline, Social Platform, AI Agent System, and Org Chart. Pick one and the canvas opens with that structure ready to edit or extend with AI.',
  },
  {
    q: 'Can I make my own diagrams from scratch?',
    a: 'Yes. Skip the templates and describe anything in the prompt — Infogiph will generate a hub-and-spoke or tree diagram that matches your description.',
  },
  {
    q: 'What export formats are supported?',
    a: 'SVG for editors, PNG for decks and docs, GIF for chat and social, and MP4 for video content. Exports preserve animation where applicable.',
  },
  {
    q: 'Do I need design experience?',
    a: 'No. Infogiph handles layout, spacing, color, and typography automatically. If you can describe a system in plain English, you can ship a professional diagram.',
  },
  {
    q: 'Is there a free tier?',
    a: 'Yes. Free accounts get one AI generation per day. Paid tiers unlock 500–1000 generations per month plus premium exports.',
  },
  {
    q: 'Can I edit a generated diagram?',
    a: 'Every diagram is fully editable on the Infogiph canvas. Move nodes, rename labels, swap icons, and re-run AI on any portion to refine.',
  },
  {
    q: 'How fast is generation?',
    a: 'Most diagrams render in 5–15 seconds. Follow-up edits apply in real time.',
  },
];

export const footerColumns: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Templates', href: '/' },
      { label: 'Canvas', href: '/canvas' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Get Started', href: '/auth/register' },
    ],
  },
  {
    heading: 'Templates',
    links: [
      { label: 'Chatbot Architecture', href: '/canvas' },
      { label: 'SaaS Platform', href: '/canvas' },
      { label: 'E-Commerce Flow', href: '/canvas' },
      { label: 'Data Pipeline', href: '/canvas' },
      { label: 'AI Agent System', href: '/canvas' },
      { label: 'Org Chart', href: '/canvas' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Docs', href: '/docs' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookie' },
    ],
  },
];

export const brandTagline =
  'AI-powered infographics and animated diagrams. Turn ideas into shareable visuals in seconds.';
