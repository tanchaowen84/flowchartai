'use client';

import {
  Bot,
  Cloud,
  Database,
  Share2,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  AirflowIcon,
  AlgoliaIcon,
  Auth0Icon,
  CloudflareIcon,
  DbtIcon,
  GitHubIcon,
  GoogleAnalyticsIcon,
  GoogleDriveIcon,
  InstagramIcon,
  LetterIcon,
  MailchimpIcon,
  NotionIcon,
  OpenAIIcon,
  PineconeIcon,
  PostgresIcon,
  RedisIcon,
  SalesforceIcon,
  ShopifyIcon,
  SlackIcon,
  SnowflakeIcon,
  StripeIcon,
  TableauIcon,
  TikTokIcon,
  UPSIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from '@/components/canvas/brand-icons';
import type { PreviewSpec } from './animated-preview';

// Per-template preview specs. Each picks a layout and a mode that suit the
// template's structure; the home cards collectively showcase all four layouts
// and all four animation modes. Accents and backgrounds are tuned per-template
// for brand-appropriate visual identity.
export const templatePreviews: Record<string, PreviewSpec> = {
  chatbot: {
    layout: 'hub-lr',
    mode: 'beams',
    accent: '#8b5cf6',
    bg: 'linear-gradient(135deg,#faf5ff 0%,#fdf2f8 100%)',
    left: [
      { key: 'wa', icon: <WhatsAppIcon className="w-full h-full" style={{ color: '#25D366' }} /> },
      { key: 'sl', icon: <SlackIcon className="w-full h-full" /> },
      { key: 'ig', icon: <InstagramIcon className="w-full h-full" style={{ color: '#E4405F' }} /> },
    ],
    right: [
      { key: 'ai', icon: <OpenAIIcon className="w-full h-full" /> },
      { key: 'nt', icon: <NotionIcon className="w-full h-full" /> },
      { key: 'crm', icon: <SalesforceIcon className="w-full h-full" /> },
    ],
    center: { key: 'bot', icon: <Bot className="w-full h-full text-white" /> },
  },

  saas: {
    layout: 'hub-lr',
    mode: 'dots',
    accent: '#0ea5e9',
    bg: 'linear-gradient(135deg,#f0f9ff 0%,#ecfeff 100%)',
    left: [
      { key: 'st', icon: <StripeIcon className="w-full h-full" style={{ color: '#635BFF' }} /> },
      { key: 'a0', icon: <Auth0Icon className="w-full h-full" /> },
      { key: 'pg', icon: <PostgresIcon className="w-full h-full" /> },
    ],
    right: [
      { key: 'gd', icon: <GoogleDriveIcon className="w-full h-full" /> },
      { key: 'gh', icon: <GitHubIcon className="w-full h-full" /> },
      { key: 'nt', icon: <NotionIcon className="w-full h-full" /> },
    ],
    center: { key: 'cloud', icon: <Cloud className="w-full h-full text-white" /> },
  },

  ecommerce: {
    layout: 'radial',
    mode: 'pulses',
    accent: '#f97316',
    bg: 'linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%)',
    center: { key: 'shop', icon: <ShoppingBag className="w-full h-full text-white" /> },
    satellites: [
      { key: 'sh', icon: <ShopifyIcon className="w-full h-full" style={{ color: '#95BF47' }} /> },
      { key: 'st', icon: <StripeIcon className="w-full h-full" style={{ color: '#635BFF' }} /> },
      { key: 'mc', icon: <MailchimpIcon className="w-full h-full" /> },
      { key: 'up', icon: <UPSIcon className="w-full h-full" /> },
      { key: 'ga', icon: <GoogleAnalyticsIcon className="w-full h-full" /> },
      { key: 'pg', icon: <PostgresIcon className="w-full h-full" /> },
    ],
  },

  'data-pipeline': {
    layout: 'pipeline',
    mode: 'arrows',
    accent: '#14b8a6',
    bg: 'linear-gradient(135deg,#f0fdfa 0%,#f0f9ff 100%)',
    nodes: [
      { key: 'sn', icon: <SnowflakeIcon className="w-full h-full" /> },
      { key: 'dbt', icon: <DbtIcon className="w-full h-full" /> },
      { key: 'db', icon: <Database className="w-full h-full text-white" /> },
      { key: 'ai', icon: <OpenAIIcon className="w-full h-full" /> },
      { key: 'tab', icon: <TableauIcon className="w-full h-full" /> },
    ],
  },

  'social-media': {
    layout: 'hub-lr',
    mode: 'dots',
    accent: '#ec4899',
    bg: 'linear-gradient(135deg,#fdf2f8 0%,#fff1f2 100%)',
    left: [
      { key: 'ig', icon: <InstagramIcon className="w-full h-full" style={{ color: '#E4405F' }} /> },
      { key: 'tt', icon: <TikTokIcon className="w-full h-full" /> },
      { key: 'yt', icon: <YouTubeIcon className="w-full h-full" style={{ color: '#FF0000' }} /> },
    ],
    right: [
      { key: 'wa', icon: <WhatsAppIcon className="w-full h-full" style={{ color: '#25D366' }} /> },
      { key: 'cdn', icon: <CloudflareIcon className="w-full h-full" /> },
      { key: 'alg', icon: <AlgoliaIcon className="w-full h-full" /> },
    ],
    center: { key: 'feed', icon: <Share2 className="w-full h-full text-white" /> },
  },

  'ai-agent': {
    layout: 'radial',
    mode: 'beams',
    accent: '#6366f1',
    bg: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)',
    center: { key: 'agent', icon: <Sparkles className="w-full h-full text-white" /> },
    satellites: [
      { key: 'ai', icon: <OpenAIIcon className="w-full h-full" /> },
      { key: 'pc', icon: <PineconeIcon className="w-full h-full" /> },
      { key: 'gh', icon: <GitHubIcon className="w-full h-full" /> },
      { key: 'gd', icon: <GoogleDriveIcon className="w-full h-full" /> },
      { key: 'nt', icon: <NotionIcon className="w-full h-full" /> },
      { key: 'rd', icon: <RedisIcon className="w-full h-full" /> },
    ],
  },

  'org-chart': {
    layout: 'tree',
    mode: 'pulses',
    accent: '#f59e0b',
    bg: 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)',
    root: {
      key: 'ceo',
      icon: <Users className="w-full h-full text-white" />,
      children: [
        {
          key: 'cmo',
          icon: <LetterIcon className="w-full h-full" letter="M" color="#ff6b9d" />,
        },
        {
          key: 'cto',
          icon: <LetterIcon className="w-full h-full" letter="T" color="#c74bb5" />,
          children: [
            {
              key: 'eng1',
              icon: <LetterIcon className="w-full h-full" letter="E" color="#f5c84b" />,
            },
            {
              key: 'eng2',
              icon: <LetterIcon className="w-full h-full" letter="E" color="#f5c84b" />,
            },
          ],
        },
        {
          key: 'coo',
          icon: <LetterIcon className="w-full h-full" letter="O" color="#ff8a5c" />,
        },
      ],
    },
  },
};
