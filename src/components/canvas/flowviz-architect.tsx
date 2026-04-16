'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  EXPORT_PRESETS,
  type ExportPreset,
  useFlowchartExport,
} from '@/hooks/use-export';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { useFlowchart } from '@/hooks/use-flowchart';
import { useLocalePathname } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bot,
  CircleDot,
  Cloud,
  Database,
  Download,
  Edit,
  ChevronLeft,
  Globe,
  HardDrive,
  Layers,
  LayoutGrid,
  LineChart,
  Loader2,
  Mail,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  User,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
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
} from './brand-icons';
import {
  AnimatedPreview,
  type PreviewMode,
  type PreviewSpec,
} from '@/components/blocks/infogiph-home/animated-preview';

// Best-effort mapping of a free-text satellite label to a recognisable icon
// tile. Tries the brand SVGs first, then falls back to a tinted letter tile.
const iconForLabel = (label: string): React.ReactNode => {
  const n = (label || '').toLowerCase();
  if (/whatsapp|whats\s?app/.test(n))
    return <WhatsAppIcon className="w-full h-full" style={{ color: '#25D366' }} />;
  if (/slack/.test(n)) return <SlackIcon className="w-full h-full" />;
  if (/github|git\b/.test(n)) return <GitHubIcon className="w-full h-full" />;
  if (/notion/.test(n)) return <NotionIcon className="w-full h-full" />;
  if (/openai|gpt|llm|claude|anthropic/.test(n))
    return <OpenAIIcon className="w-full h-full" />;
  if (/stripe|billing|payment|pay\b/.test(n))
    return <StripeIcon className="w-full h-full" style={{ color: '#635BFF' }} />;
  if (/instagram|insta/.test(n))
    return <InstagramIcon className="w-full h-full" style={{ color: '#E4405F' }} />;
  if (/tiktok|tik\s?tok/.test(n)) return <TikTokIcon className="w-full h-full" />;
  if (/youtube|you\s?tube/.test(n))
    return <YouTubeIcon className="w-full h-full" style={{ color: '#FF0000' }} />;
  if (/drive|gdrive|google\s?drive/.test(n))
    return <GoogleDriveIcon className="w-full h-full" />;
  if (/shopify|shop\b/.test(n))
    return <ShopifyIcon className="w-full h-full" style={{ color: '#95BF47' }} />;
  const palette = ['#e63946', '#1AC6FF', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9'];
  const color = palette[Math.abs(hashCode(label)) % palette.length];
  const letter = (label || '?').trim().charAt(0).toUpperCase() || '?';
  return <LetterIcon className="w-full h-full" letter={letter} color={color} />;
};

const hashCode = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
};

// Rebuild a PreviewSpec from an AI result using the active template's layout
// so the output stays in the same animated-beam visual style the user picked.
const buildPreviewFromAI = (
  result: any,
  base: (typeof TEMPLATES)[number] | null,
): PreviewSpec | null => {
  if (!result || !base) return null;
  const spec = base.preview;
  const centerLabel = result.center?.label || (spec as any).center?.label || base.label;
  const centerIcon =
    (spec as any).center?.icon ||
    <Sparkles className="w-full h-full text-white" />;
  const center = { key: 'center', label: centerLabel, icon: centerIcon };
  const sats: any[] = result.satellites || [];
  const satNodes = sats.map((s, i) => ({
    key: `sat-${i}`,
    label: s.label,
    icon: iconForLabel(s.label),
  }));

  switch (spec.layout) {
    case 'hub-lr': {
      const mid = Math.ceil(satNodes.length / 2);
      return {
        layout: 'hub-lr',
        mode: spec.mode,
        bg: spec.bg,
        left: satNodes.slice(0, mid),
        right: satNodes.slice(mid),
        center,
      };
    }
    case 'radial':
      return {
        layout: 'radial',
        mode: spec.mode,
        bg: spec.bg,
        center,
        satellites: satNodes,
      };
    case 'pipeline': {
      const mid = Math.floor(satNodes.length / 2);
      const nodes = [...satNodes];
      nodes.splice(mid, 0, center);
      return { layout: 'pipeline', mode: spec.mode, bg: spec.bg, nodes };
    }
    case 'tree': {
      const children = satNodes.slice(0, 3).map((n, i) => ({
        ...n,
        children: i === 1 ? satNodes.slice(3, 5) : undefined,
      }));
      return {
        layout: 'tree',
        mode: spec.mode,
        bg: spec.bg,
        root: { ...center, children },
      };
    }
  }
};

const getIcon = (name: string, size = 24) => {
  if (!name) return <Layers size={size} />;
  const n = name.toLowerCase();
  if (n.includes('db') || n.includes('database') || n.includes('sql'))
    return <Database size={size} />;
  if (n.includes('cloud')) return <Cloud size={size} />;
  if (n.includes('web') || n.includes('globe') || n.includes('internet'))
    return <Globe size={size} />;
  if (n.includes('msg') || n.includes('chat') || n.includes('whatsapp') || n.includes('messenger'))
    return <MessageSquare size={size} />;
  if (n.includes('ai') || n.includes('bot') || n.includes('gpt'))
    return <Bot size={size} />;
  if (n.includes('drive') || n.includes('storage'))
    return <HardDrive size={size} />;
  if (n.includes('mobile') || n.includes('app') || n.includes('phone'))
    return <Smartphone size={size} />;
  if (n.includes('mail') || n.includes('email')) return <Mail size={size} />;
  if (n.includes('search')) return <Search size={size} />;
  if (n.includes('process') || n.includes('logic'))
    return <Workflow size={size} />;
  if (n.includes('zapier') || n.includes('automation'))
    return <Zap size={size} />;
  if (n.includes('social') || n.includes('share')) return <Share2 size={size} />;
  return <Layers size={size} />;
};

const TEMPLATES: Array<{
  id: string;
  label: string;
  icon: React.ReactNode;
  topic: string;
  data: any;
  preview: PreviewSpec;
}> = [
  {
    id: 'chatbot',
    label: 'Chatbot Architecture',
    icon: <MessageSquare size={18} />,
    topic: 'Chatbot Architecture with NLP, Dialog Manager, and integrations',
    data: {
      center: { label: 'Chatbot', icon: 'bot' },
      satellites: [
        { label: 'NLP Engine', icon: 'ai' },
        { label: 'Knowledge Base', icon: 'database' },
        { label: 'WhatsApp', icon: 'chat' },
        { label: 'Web Widget', icon: 'web' },
        { label: 'Analytics', icon: 'search' },
        { label: 'CRM', icon: 'layers' },
      ],
    },
    preview: {
      layout: 'hub-lr',
      mode: 'beams',
      accent: '#8b5cf6',
      left: [
        { key: 'wa', label: 'WhatsApp', icon: <WhatsAppIcon className="w-full h-full" style={{ color: '#25D366' }} /> },
        { key: 'sl', label: 'Slack', icon: <SlackIcon className="w-full h-full" /> },
        { key: 'ig', label: 'Instagram', icon: <InstagramIcon className="w-full h-full" style={{ color: '#E4405F' }} /> },
      ],
      right: [
        { key: 'ai', label: 'OpenAI', icon: <OpenAIIcon className="w-full h-full" /> },
        { key: 'nt', label: 'Notion', icon: <NotionIcon className="w-full h-full" /> },
        { key: 'crm', label: 'Salesforce', icon: <SalesforceIcon className="w-full h-full" /> },
      ],
      center: { key: 'bot', label: 'Chatbot', icon: <Bot className="w-full h-full text-white" /> },
    },
  },
  {
    id: 'saas',
    label: 'SaaS Platform',
    icon: <Cloud size={18} />,
    topic: 'SaaS platform with auth, billing, and microservices',
    data: {
      center: { label: 'API Gateway', icon: 'cloud' },
      satellites: [
        { label: 'Auth Service', icon: 'process' },
        { label: 'User DB', icon: 'database' },
        { label: 'Billing', icon: 'zap' },
        { label: 'Dashboard', icon: 'web' },
        { label: 'Email', icon: 'email' },
        { label: 'Storage', icon: 'drive' },
      ],
    },
    preview: {
      layout: 'hub-lr',
      mode: 'dots',
      accent: '#0ea5e9',
      left: [
        { key: 'st', label: 'Stripe', icon: <StripeIcon className="w-full h-full" style={{ color: '#635BFF' }} /> },
        { key: 'a0', label: 'Auth0', icon: <Auth0Icon className="w-full h-full" /> },
        { key: 'pg', label: 'Postgres', icon: <PostgresIcon className="w-full h-full" /> },
      ],
      right: [
        { key: 'gd', label: 'Drive', icon: <GoogleDriveIcon className="w-full h-full" /> },
        { key: 'mail', label: 'Email', icon: <Mail className="w-full h-full text-[#EA4335]" /> },
        { key: 'gh', label: 'GitHub', icon: <GitHubIcon className="w-full h-full" /> },
      ],
      center: { key: 'cloud', label: 'API Gateway', icon: <Cloud className="w-full h-full text-white" /> },
    },
  },
  {
    id: 'ecommerce',
    label: 'E-Commerce Flow',
    icon: <LayoutGrid size={18} />,
    topic: 'E-Commerce system with cart, payment, and fulfillment',
    data: {
      center: { label: 'Store', icon: 'web' },
      satellites: [
        { label: 'Product DB', icon: 'database' },
        { label: 'Cart Service', icon: 'process' },
        { label: 'Payments', icon: 'zap' },
        { label: 'Shipping', icon: 'share' },
        { label: 'Notifications', icon: 'email' },
        { label: 'Analytics', icon: 'search' },
      ],
    },
    preview: {
      layout: 'radial',
      mode: 'pulses',
      accent: '#f97316',
      center: { key: 'shop', label: 'Store', icon: <LayoutGrid className="w-full h-full text-white" /> },
      satellites: [
        { key: 'sh', label: 'Shopify', icon: <ShopifyIcon className="w-full h-full" style={{ color: '#95BF47' }} /> },
        { key: 'st', label: 'Stripe', icon: <StripeIcon className="w-full h-full" style={{ color: '#635BFF' }} /> },
        { key: 'mc', label: 'Mailchimp', icon: <MailchimpIcon className="w-full h-full" /> },
        { key: 'up', label: 'UPS', icon: <UPSIcon className="w-full h-full" /> },
        { key: 'ga', label: 'Analytics', icon: <GoogleAnalyticsIcon className="w-full h-full" /> },
        { key: 'pg', label: 'Products', icon: <PostgresIcon className="w-full h-full" /> },
      ],
    },
  },
  {
    id: 'data-pipeline',
    label: 'Data Pipeline',
    icon: <Database size={18} />,
    topic: 'ETL data pipeline with ingestion, processing, and warehouse',
    data: {
      center: { label: 'Data Lake', icon: 'database' },
      satellites: [
        { label: 'Ingestion', icon: 'zap' },
        { label: 'Transform', icon: 'process' },
        { label: 'ML Models', icon: 'ai' },
        { label: 'Dashboard', icon: 'web' },
        { label: 'Alerts', icon: 'email' },
        { label: 'API', icon: 'cloud' },
      ],
    },
    preview: {
      layout: 'pipeline',
      mode: 'arrows',
      accent: '#14b8a6',
      nodes: [
        { key: 'sn', label: 'Snowflake', icon: <SnowflakeIcon className="w-full h-full" /> },
        { key: 'dbt', label: 'dbt', icon: <DbtIcon className="w-full h-full" /> },
        { key: 'db', label: 'Data Lake', icon: <Database className="w-full h-full text-white" /> },
        { key: 'ai', label: 'ML', icon: <OpenAIIcon className="w-full h-full" /> },
        { key: 'tab', label: 'Tableau', icon: <TableauIcon className="w-full h-full" /> },
      ],
    },
  },
  {
    id: 'social-media',
    label: 'Social Platform',
    icon: <Share2 size={18} />,
    topic: 'Social media platform architecture',
    data: {
      center: { label: 'Feed Engine', icon: 'social' },
      satellites: [
        { label: 'User Profiles', icon: 'database' },
        { label: 'Messaging', icon: 'chat' },
        { label: 'Media CDN', icon: 'cloud' },
        { label: 'Search', icon: 'search' },
        { label: 'Notifications', icon: 'email' },
        { label: 'Analytics', icon: 'search' },
      ],
    },
    preview: {
      layout: 'hub-lr',
      mode: 'dots',
      accent: '#ec4899',
      left: [
        { key: 'ig', label: 'Instagram', icon: <InstagramIcon className="w-full h-full" style={{ color: '#E4405F' }} /> },
        { key: 'tt', label: 'TikTok', icon: <TikTokIcon className="w-full h-full" /> },
        { key: 'yt', label: 'YouTube', icon: <YouTubeIcon className="w-full h-full" style={{ color: '#FF0000' }} /> },
      ],
      right: [
        { key: 'wa', label: 'Messaging', icon: <WhatsAppIcon className="w-full h-full" style={{ color: '#25D366' }} /> },
        { key: 'cdn', label: 'CDN', icon: <CloudflareIcon className="w-full h-full" /> },
        { key: 'alg', label: 'Search', icon: <AlgoliaIcon className="w-full h-full" /> },
      ],
      center: { key: 'feed', label: 'Feed Engine', icon: <Share2 className="w-full h-full text-white" /> },
    },
  },
  {
    id: 'ai-agent',
    label: 'AI Agent System',
    icon: <Sparkles size={18} />,
    topic: 'AI agent with tools, memory, and orchestration',
    data: {
      center: { label: 'AI Agent', icon: 'bot' },
      satellites: [
        { label: 'LLM', icon: 'ai' },
        { label: 'Vector DB', icon: 'database' },
        { label: 'Tools', icon: 'zap' },
        { label: 'Memory', icon: 'drive' },
        { label: 'Web Search', icon: 'search' },
        { label: 'API Calls', icon: 'cloud' },
      ],
    },
    preview: {
      layout: 'radial',
      mode: 'beams',
      accent: '#6366f1',
      center: { key: 'agent', label: 'AI Agent', icon: <Sparkles className="w-full h-full text-white" /> },
      satellites: [
        { key: 'ai', label: 'OpenAI', icon: <OpenAIIcon className="w-full h-full" /> },
        { key: 'pc', label: 'Pinecone', icon: <PineconeIcon className="w-full h-full" /> },
        { key: 'gh', label: 'GitHub', icon: <GitHubIcon className="w-full h-full" /> },
        { key: 'gd', label: 'Drive', icon: <GoogleDriveIcon className="w-full h-full" /> },
        { key: 'nt', label: 'Notion', icon: <NotionIcon className="w-full h-full" /> },
        { key: 'rd', label: 'Memory', icon: <RedisIcon className="w-full h-full" /> },
      ],
    },
  },
  {
    id: 'org-chart',
    label: 'Org Chart',
    icon: <Users size={18} />,
    topic: 'Company org chart with CEO, CTO, CMO, COO, and engineers',
    data: {
      layout: 'tree',
      root: {
        label: 'CEO', icon: 'process', tool: 'Claude',
        children: [
          { label: 'CMO', icon: 'social', tool: 'OpenClaw' },
          {
            label: 'CTO', icon: 'process', tool: 'Cursor',
            children: [
              { label: 'CodexCoder', icon: 'automation', role: 'Engineer', tool: 'Codex' },
              { label: 'ClaudeCoder', icon: 'automation', role: 'Engineer', tool: 'Claude' },
            ],
          },
          { label: 'COO', icon: 'process', tool: 'Claude' },
        ],
      },
    },
    preview: {
      layout: 'tree',
      mode: 'pulses',
      accent: '#f59e0b',
      root: {
        key: 'ceo',
        label: 'CEO',
        icon: <Users className="w-full h-full text-white" />,
        children: [
          {
            key: 'cmo',
            label: 'CMO',
            icon: <LetterIcon className="w-full h-full" letter="M" color="#ff6b9d" />,
          },
          {
            key: 'cto',
            label: 'CTO',
            icon: <LetterIcon className="w-full h-full" letter="T" color="#c74bb5" />,
            children: [
              {
                key: 'eng1',
                label: 'Engineer',
                icon: <LetterIcon className="w-full h-full" letter="E" color="#f5c84b" />,
              },
              {
                key: 'eng2',
                label: 'Engineer',
                icon: <LetterIcon className="w-full h-full" letter="E" color="#f5c84b" />,
              },
            ],
          },
          {
            key: 'coo',
            label: 'COO',
            icon: <LetterIcon className="w-full h-full" letter="O" color="#ff8a5c" />,
          },
        ],
      },
    },
  },
];

export default function FlowVizArchitect({
  flowchartId,
}: { flowchartId?: string }) {
  const router = useRouter();
  const {
    user: currentUser,
    isLoading: authLoading,
    isAuthenticated,
  } = useCurrentUserWithStatus();
  const currentPath = useLocalePathname();
  const {
    flowchart,
    loading: flowchartLoading,
    error: flowchartError,
  } = useFlowchart(flowchartId);

  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationType, setAnimationType] = useState<PreviewMode>('dots');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [diagramData, setDiagramData] = useState<any>({
    center: { label: 'AI Engine', icon: 'bot' },
    satellites: [
      { label: 'Google Drive', icon: 'drive' },
      { label: 'Notion', icon: 'layers' },
      { label: 'WhatsApp', icon: 'chat' },
      { label: 'Google Docs', icon: 'mail' },
      { label: 'Zapier', icon: 'zap' },
      { label: 'Messenger', icon: 'chat' },
    ],
  });
  const [activePreview, setActivePreview] = useState<PreviewSpec | null>(
    TEMPLATES[0].preview,
  );
  const [activeTemplate, setActiveTemplate] = useState<
    (typeof TEMPLATES)[number] | null
  >(TEMPLATES[0]);
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>(
    {},
  );
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [exportPreset, setExportPreset] = useState<ExportPreset>('original');
  const [sidebarImage, setSidebarImage] = useState<string | null>(null);
  const sidebarFileRef = useRef<HTMLInputElement>(null);

  const [currentTitle, setCurrentTitle] = useState<string>('Untitled');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('Untitled');
  const [isSaving, setIsSaving] = useState(false);
  const [localFlowchartId, setLocalFlowchartId] = useState<string | undefined>(flowchartId);
  const autoGenerateTriggered = useRef(false);

  const exportContainerRef = useRef<HTMLDivElement>(null);
  const { exportPNG, exportSVG, exportGIF, exportMP4, isExporting, exportProgress } =
    useFlowchartExport(exportContainerRef);

  useEffect(() => {
    if (flowchart) {
      setCurrentTitle(flowchart.title || 'Untitled');
      setTempTitle(flowchart.title || 'Untitled');
      if (flowchart.content) {
        try {
          const parsed = JSON.parse(flowchart.content);
          if (parsed && typeof parsed === 'object' && parsed.center && parsed.satellites) {
            setDiagramData(parsed);
            setActivePreview(null);
          }
        } catch (e) {
          console.error('Failed to parse existing flowchart content');
        }
      }
    }
  }, [flowchart]);

  useEffect(() => {
    if (typeof window === 'undefined' || autoGenerateTriggered.current) return;
    const autoGenerate = localStorage.getItem('flowchart_auto_generate');
    const autoInput = localStorage.getItem('flowchart_auto_input');
    const autoImage = localStorage.getItem('flowchart_image');
    const autoAspect = localStorage.getItem('flowchart_aspect');
    if (autoGenerate !== 'true' || (!autoInput && !autoImage)) return;
    if (authLoading) return;
    if (autoInput) setTopic(autoInput);
    if (autoAspect) setExportPreset(autoAspect as ExportPreset);
    autoGenerateTriggered.current = true;
    generateDiagram(undefined, autoInput || undefined, autoImage || undefined);
    localStorage.removeItem('flowchart_image');
    localStorage.removeItem('flowchart_aspect');
  }, [authLoading, isAuthenticated]);

  const handleTitleChange = async (newTitle: string) => {
    setCurrentTitle(newTitle);
    const idToUse = localFlowchartId || flowchartId;
    if (idToUse) {
      try {
        await fetch(`/api/flowcharts/${idToUse}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
      } catch (error) {
        console.error('Error updating title:', error);
      }
    }
  };

  const saveFlowchart = async (dataToSave: any, customTitle?: string) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const content = JSON.stringify(dataToSave);
      const titleToSave = currentTitle !== 'Untitled' ? currentTitle : customTitle || topic || 'Untitled';
      const idToUse = localFlowchartId || flowchartId;
      if (idToUse) {
        await fetch(`/api/flowcharts/${idToUse}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, title: titleToSave }),
        });
        toast.success('Flowchart saved successfully');
      } else {
        const response = await fetch(`/api/flowcharts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, title: titleToSave }),
        });
        if (response.ok) {
          const newFlowchart = await response.json();
          toast.success('Created new flowchart');
          if (newFlowchart.id) {
            setLocalFlowchartId(newFlowchart.id);
            window.history.replaceState(null, '', `/canvas/${newFlowchart.id}`);
          }
        }
      }
    } catch (err) {
      toast.error('Failed to save flowchart');
    } finally {
      setIsSaving(false);
    }
  };

  const generateDiagram = async (
    e?: React.FormEvent,
    customTopic?: string,
    imageBase64?: string,
  ) => {
    if (e) e.preventDefault();
    const userPrompt = (customTopic || topic).trim();
    if (!userPrompt && !imageBase64) return;
    const activeTopic =
      activeTemplate && userPrompt
        ? `${activeTemplate.topic}. Additional requirements: ${userPrompt}`
        : userPrompt;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (activeTopic) body.topic = activeTopic;
      if (imageBase64) body.image = imageBase64;
      const response = await fetch('/api/ai/flowviz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        toast.error('Please sign in to use this feature');
        setLoading(false);
        return;
      }
      if (response.status === 429) {
        const data = await response.json();
        toast.error(data.message || 'Usage limit exceeded');
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Generation failed');
      const result = await response.json();
      setDiagramData(result);
      // Keep the active template's layout/mode; swap icons + labels using the
      // AI-generated satellites so the animated-beam preview stays consistent.
      const nextPreview = buildPreviewFromAI(result, activeTemplate);
      setActivePreview(nextPreview);
      setPositionOverrides({});
      setLabelOverrides({});
      localStorage.removeItem('flowchart_auto_generate');
      localStorage.removeItem('flowchart_auto_input');
      if (currentTitle === 'Untitled') {
        setCurrentTitle(userPrompt);
        setTempTitle(userPrompt);
      }
      saveFlowchart(result, userPrompt);
    } catch (err: any) {
      setError('Failed to generate diagram.');
      toast.error(err.message || 'Failed to generate diagram');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: (typeof TEMPLATES)[number]) => {
    setTopic('');
    setDiagramData(template.data);
    setActivePreview(template.preview);
    setActiveTemplate(template);
    setPositionOverrides({});
    setLabelOverrides({});
    if (currentTitle === 'Untitled') {
      setCurrentTitle(template.label);
      setTempTitle(template.label);
    }
  };

  const handleManualSave = () => {
    saveFlowchart(diagramData);
  };

  if (flowchartId && flowchartLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
          <p className="text-muted-foreground">Loading your architecture...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="infogiph-home h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to home"
            className="h-9 w-9 rounded-lg border border-border hover:bg-[#fafafa]"
            onClick={() => router.push('/')}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle templates"
            className="h-9 w-9 rounded-lg hover:bg-[#fafafa]"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </Button>
          {currentUser ? (
            <div className="flex items-center gap-1.5">
              {isEditingTitle ? (
                <Input
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleTitleChange(tempTitle); setIsEditingTitle(false); }
                    else if (e.key === 'Escape') { setTempTitle(currentTitle); setIsEditingTitle(false); }
                  }}
                  onBlur={() => { handleTitleChange(tempTitle); setIsEditingTitle(false); }}
                  className="h-9 px-3 text-sm font-semibold w-56 rounded-lg"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setTempTitle(currentTitle); setIsEditingTitle(true); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold max-w-56 hover:bg-[#fafafa] transition-colors"
                >
                  <span className="truncate">{currentTitle}</span>
                  <Edit className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              )}
            </div>
          ) : (
            <span className="font-semibold text-sm px-2">Infogiph</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={animationType}
            onValueChange={(v) => v && setAnimationType(v as PreviewMode)}
            variant="outline"
            size="sm"
            className="rounded-lg bg-white border border-border p-0.5"
          >
            <ToggleGroupItem value="dots" className="gap-1.5 text-xs px-2.5 rounded-md data-[state=on]:bg-foreground data-[state=on]:text-background">
              <CircleDot size={14} /> Dots
            </ToggleGroupItem>
            <ToggleGroupItem value="beams" className="gap-1.5 text-xs px-2.5 rounded-md data-[state=on]:bg-foreground data-[state=on]:text-background">
              <LineChart size={14} /> Beams
            </ToggleGroupItem>
            <ToggleGroupItem value="pulses" className="gap-1.5 text-xs px-2.5 rounded-md data-[state=on]:bg-foreground data-[state=on]:text-background">
              <Activity size={14} /> Pulses
            </ToggleGroupItem>
            <ToggleGroupItem value="arrows" className="gap-1.5 text-xs px-2.5 rounded-md data-[state=on]:bg-foreground data-[state=on]:text-background">
              <ArrowRight size={14} /> Arrows
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Speed
            </span>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-20 accent-foreground"
            />
            <span className="text-[11px] font-semibold tabular-nums text-foreground/80 w-8 text-right">
              {animationSpeed.toFixed(1)}x
            </span>
          </div>

          <div className="mx-1 h-6 w-px bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg border-border hover:bg-[#fafafa]">
                <LayoutGrid className="h-3.5 w-3.5" />
                {EXPORT_PRESETS[exportPreset].label.split(' (')[0]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(Object.keys(EXPORT_PRESETS) as ExportPreset[]).map((k) => (
                <DropdownMenuItem
                  key={k}
                  onClick={() => setExportPreset(k)}
                  className={
                    exportPreset === k
                      ? 'bg-accent text-accent-foreground'
                      : ''
                  }
                >
                  <span className="flex items-center gap-2 w-full">
                    <span
                      className={
                        'h-1.5 w-1.5 rounded-full ' +
                        (exportPreset === k ? 'bg-foreground' : 'bg-border')
                      }
                    />
                    {EXPORT_PRESETS[k].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting} className="gap-1.5 text-xs rounded-lg border-border hover:bg-[#fafafa]">
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export{isExporting && exportProgress > 0 ? ` ${exportProgress}%` : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => exportPNG(currentTitle, exportPreset)}
              >
                Download as PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportSVG(currentTitle, exportPreset)}
              >
                Download as SVG
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportGIF(currentTitle, exportPreset)}
              >
                Download as GIF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportMP4(currentTitle, exportPreset)}
              >
                Download as MP4
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="text-xs rounded-lg border-border hover:bg-[#fafafa]" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>

          {currentUser && (
            <Button
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving}
              className="text-xs gap-1.5 rounded-lg bg-foreground text-background hover:bg-neutral-800"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          )}

          <Button
            size="sm"
            className="ig-gradient text-xs gap-1.5 rounded-lg text-white shadow-[0_2px_10px_rgba(255,107,157,0.35)] hover:opacity-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade
          </Button>

          {currentUser ? (
            <UserButton user={currentUser} />
          ) : (
            <LoginWrapper mode="modal" asChild callbackUrl={currentPath}>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 rounded-lg hover:bg-[#fafafa]">
                <User className="h-3.5 w-3.5" /> Sign In
              </Button>
            </LoginWrapper>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Template Picker */}
        {sidebarOpen && (
          <div className="w-[260px] border-r border-border bg-[#fafafa] flex flex-col shrink-0">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Templates
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a template or describe your own
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-3 pb-3 space-y-1.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className="group w-full flex items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 text-left text-sm transition-all hover:border-border hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground/70 group-hover:text-foreground transition-colors">
                      {template.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate text-foreground">
                        {template.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {template.data.satellites?.length ||
                          template.data.root?.children?.length ||
                          0}{' '}
                        nodes
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  generateDiagram(undefined, undefined, sidebarImage || undefined);
                }}
                className="space-y-2"
              >
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Describe your system..."
                  className="text-xs h-9 rounded-lg border-border bg-white focus-visible:ring-0 focus-visible:border-foreground/40"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={sidebarFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 4 * 1024 * 1024) {
                        toast.error('Image must be under 4 MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setSidebarImage(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 rounded-lg border-border hover:bg-[#fafafa] shrink-0"
                    onClick={() => sidebarFileRef.current?.click()}
                  >
                    {sidebarImage ? '✓ Image' : '+ Image'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || (!topic.trim() && !sidebarImage)}
                    className="flex-1 gap-2 text-xs h-9 rounded-lg bg-foreground text-background hover:bg-neutral-800 disabled:opacity-50"
                    size="sm"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Generate
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-white">
          <div className="h-full flex items-center justify-center p-6">
            <div
              className="relative rounded-xl border border-border bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(15,42,62,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,42,62,0.06) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 0 0',
                ...(EXPORT_PRESETS[exportPreset].w && EXPORT_PRESETS[exportPreset].h
                  ? {
                      aspectRatio: `${EXPORT_PRESETS[exportPreset].w} / ${EXPORT_PRESETS[exportPreset].h}`,
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: '100%',
                    }
                  : {
                      width: '100%',
                      height: '100%',
                    }),
              }}
            >
              <div
                ref={exportContainerRef}
                className="w-full h-full flex items-center justify-center p-8"
              >
                {activePreview ? (
                  <AnimatedPreview
                    {...(activePreview as any)}
                    variant="canvas"
                    modeOverride={animationType}
                    showModeChip={false}
                    editable
                    speed={animationSpeed}
                    positionOverrides={positionOverrides}
                    labelOverrides={labelOverrides}
                    onPositionChange={(key, x, y) =>
                      setPositionOverrides((p) => ({ ...p, [key]: { x, y } }))
                    }
                    onLabelChange={(key, label) =>
                      setLabelOverrides((p) => ({ ...p, [key]: label }))
                    }
                  />
                ) : (
                  <DiagramRenderer data={diagramData} mode={animationType} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiagramRenderer({ data, mode }: { data: any; mode: string }) {
  if (data.layout === 'tree' && data.root) {
    return <TreeDiagramRenderer data={data} />;
  }
  return <RadialDiagramRenderer data={data} mode={mode} />;
}

function TreeDiagramRenderer({ data }: { data: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!dims.width) return <div ref={containerRef} className="w-full h-full" />;

  const { width, height } = dims;
  const nw = Math.min(160, width * 0.18);
  const nh = 56;
  const accent = '#d4a017';

  type NodePos = { x: number; y: number; node: any; level: number };
  const nodes: NodePos[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  const root = data.root;
  const levelGap = Math.min(height * 0.3, 120);

  // Level 0: root
  const rootX = width / 2;
  const rootY = height * 0.12;
  nodes.push({ x: rootX, y: rootY, node: root, level: 0 });

  // Level 1: children
  const children = root.children || [];
  const l1Y = rootY + levelGap;
  const l1Spacing = Math.min(width / (children.length + 1), width * 0.3);
  const l1Start = width / 2 - ((children.length - 1) * l1Spacing) / 2;

  children.forEach((child: any, i: number) => {
    const x = l1Start + i * l1Spacing;
    nodes.push({ x, y: l1Y, node: child, level: 1 });
    lines.push({ x1: rootX, y1: rootY + nh / 2, x2: x, y2: l1Y - nh / 2 });

    // Level 2: grandchildren
    if (child.children) {
      const l2Y = l1Y + levelGap;
      const gcCount = child.children.length;
      const l2Spacing = Math.min(nw + 40, width * 0.22);
      const l2Start = x - ((gcCount - 1) * l2Spacing) / 2;
      child.children.forEach((gc: any, j: number) => {
        const gx = l2Start + j * l2Spacing;
        nodes.push({ x: gx, y: l2Y, node: gc, level: 2 });
        lines.push({ x1: x, y1: l1Y + nh / 2, x2: gx, y2: l2Y - nh / 2 });
      });
    }
  });

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="tree-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.08" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Bracket-style connections */}
        {lines.map((line, i) => {
          const midY = (line.y1 + line.y2) / 2;
          const pathD = `M ${line.x1} ${line.y1} L ${line.x1} ${midY} L ${line.x2} ${midY} L ${line.x2} ${line.y2}`;
          return (
            <React.Fragment key={i}>
              <motion.path
                d={pathD}
                fill="none"
                stroke="#c8c8c8"
                strokeWidth="2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
              />
              <motion.circle
                r="3"
                fill={accent}
                initial={{ '--offset-distance': '0%' } as any}
                animate={{ '--offset-distance': '100%' } as any}
                transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: 'linear', delay: i * 0.3 }}
                style={{ offsetPath: `path("${pathD}")`, offsetDistance: 'var(--offset-distance)' } as React.CSSProperties}
              />
            </React.Fragment>
          );
        })}

        {/* Card nodes */}
        {nodes.map((np, i) => (
          <motion.g
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, delay: 0.3 + i * 0.07 }}
          >
            <rect
              x={np.x - nw / 2}
              y={np.y - nh / 2}
              width={nw}
              height={nh}
              rx="12"
              fill="white"
              filter="url(#tree-shadow)"
              stroke="#e5e5e5"
              strokeWidth="1"
            />
            <foreignObject x={np.x - nw / 2} y={np.y - nh / 2} width={nw} height={nh}>
              <div className="w-full h-full flex items-center gap-2.5 px-3 pointer-events-none">
                <div className="flex-shrink-0 p-1.5 rounded-lg bg-gray-100 text-gray-500">
                  {getIcon(np.node.icon || np.node.label, 18)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-800 leading-tight truncate">{np.node.label}</div>
                  {np.node.role && <div className="text-[10px] text-gray-500 leading-tight">{np.node.role}</div>}
                  {np.node.tool && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                      <span className="text-[10px] text-gray-500">{np.node.tool}</span>
                    </div>
                  )}
                </div>
              </div>
            </foreignObject>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

function RadialDiagramRenderer({ data, mode }: { data: any; mode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (!dimensions.width)
    return <div ref={containerRef} className="w-full h-full" />;

  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = Math.min(width * 0.35, 400);
  const radiusY = Math.min(height * 0.35, 250);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient id="nodeGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.1" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
            <stop offset="50%" stopColor="rgba(59, 130, 246, 0.8)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
          </linearGradient>
        </defs>

        <AnimatePresence mode="wait">
          <g key={`${JSON.stringify(data)}-${mode}`}>
            {data.satellites &&
              data.satellites.map((sat: any, i: number) => {
                const angle = (i / data.satellites.length) * 2 * Math.PI;
                const x = centerX + radiusX * Math.cos(angle);
                const y = centerY + radiusY * Math.sin(angle);
                const cp1X = centerX + (x - centerX) * 0.5;
                const cp1Y = centerY;
                const cp2X = centerX + (x - centerX) * 0.5;
                const cp2Y = y;
                const pathD = `M ${centerX} ${centerY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${x} ${y}`;

                return (
                  <React.Fragment key={i}>
                    <motion.path d={pathD} fill="none" stroke="#e2e8f0" strokeWidth="2"
                      initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 1, delay: i * 0.1 }} />

                    {mode === 'dots' && [0, 0.3, 0.6].map((offset) => (
                      <motion.circle key={offset} r="3" fill="#3b82f6"
                        initial={{ '--offset-distance': '0%' } as any} animate={{ '--offset-distance': '100%' } as any}
                        transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: 'linear', delay: offset + i * 0.2 }}
                        style={{ offsetPath: `path("${pathD}")`, offsetDistance: 'var(--offset-distance)' } as React.CSSProperties} />
                    ))}

                    {mode === 'beams' && (
                      <motion.path d={pathD} fill="none" stroke="url(#beamGradient)" strokeWidth="4" strokeDasharray="50, 150"
                        initial={{ strokeDashoffset: 200 }} animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'linear', delay: i * 0.15 }} />
                    )}

                    {mode === 'pulses' && (
                      <motion.circle cx={centerX} cy={centerY} r="10" stroke="#3b82f6" strokeWidth="2" fill="none"
                        initial={{ opacity: 0.8, scale: 0, '--offset-distance': '0%' } as any}
                        animate={{ opacity: 0, scale: 10, '--offset-distance': '100%' } as any}
                        transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeOut', delay: i * 0.4 }}
                        style={{ offsetPath: `path("${pathD}")`, offsetDistance: 'var(--offset-distance)' } as React.CSSProperties} />
                    )}

                    {mode === 'arrows' && (
                      <motion.path d="M -5,-3 L 5,0 L -5,3 Z" fill="#3b82f6"
                        initial={{ '--offset-distance': '0%' } as any} animate={{ '--offset-distance': '100%' } as any}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'linear', delay: i * 0.1 }}
                        style={{ offsetPath: `path("${pathD}")`, offsetDistance: 'var(--offset-distance)', offsetRotate: 'auto' } as React.CSSProperties} />
                    )}

                    <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', damping: 12, delay: 0.5 + i * 0.1 }}>
                      <circle cx={x} cy={y} r="40" fill="url(#nodeGradient)" filter="url(#shadow)" className="stroke-slate-200 stroke-1" />
                      <foreignObject x={x - 40} y={y - 40} width="80" height="80">
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                          <div className="text-blue-500 mb-1">{getIcon(sat.icon || sat.label)}</div>
                          <span className="text-[10px] font-bold text-slate-600 leading-tight uppercase tracking-tighter line-clamp-2">{sat.label}</span>
                        </div>
                      </foreignObject>
                    </motion.g>
                  </React.Fragment>
                );
              })}

            {data.center && (
              <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <circle cx={centerX} cy={centerY} r="50" fill="white" filter="url(#shadow)" className="stroke-blue-200 stroke-2" />
                <foreignObject x={centerX - 50} y={centerY - 50} width="100" height="100">
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                    <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg mb-1">{getIcon(data.center.icon || data.center.label)}</div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-2">{data.center.label}</span>
                  </div>
                </foreignObject>
              </motion.g>
            )}
          </g>
        </AnimatePresence>
      </svg>
    </div>
  );
}
