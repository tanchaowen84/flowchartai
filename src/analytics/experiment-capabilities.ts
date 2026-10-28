import type { Capability } from '@site-insights/sdk/contracts';

export const homeModules = [
  'hero',
  'demo',
  'features',
  'ai-capabilities',
  'use-cases',
  'tutorials',
  'pricing',
  'faq',
  'call-to-action',
];
export const experimentCapabilities: Capability[] = [
  { target: 'homepage-headline', kind: 'text' },
  {
    target: 'homepage-layout',
    kind: 'page',
    modules: homeModules,
    required_modules: homeModules,
  },
  { target: 'credit-pack-price', kind: 'pricing', offer_keys: ['pack_small'] },
];
