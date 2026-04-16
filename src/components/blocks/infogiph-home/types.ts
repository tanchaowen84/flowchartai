export type TemplateCategory =
  | 'All'
  | 'Architecture'
  | 'Business'
  | 'Data'
  | 'People';

export type TemplateDemoKind =
  | 'chatbot'
  | 'saas'
  | 'ecommerce'
  | 'data-pipeline'
  | 'social'
  | 'ai-agent'
  | 'org-chart';

export interface TemplateItem {
  slug: string;
  title: string;
  description: string;
  category: TemplateCategory;
  demo: TemplateDemoKind;
}

export interface FeatureCard {
  title: string;
  description: string;
  tags: string[];
  icon: 'sparkle' | 'type' | 'video' | 'layers' | 'play' | 'share';
  demo: 'designer' | 'typeface' | 'text' | 'graphics' | 'animator' | 'social';
  href: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}
