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
import { useFlowchartExport } from '@/hooks/use-export';
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

const TEMPLATES = [
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
  const [animationType, setAnimationType] = useState('dots');
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
    if (autoGenerate !== 'true' || !autoInput) return;
    if (authLoading) return;
    setTopic(autoInput);
    autoGenerateTriggered.current = true;
    generateDiagram(undefined, autoInput);
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

  const generateDiagram = async (e?: React.FormEvent, customTopic?: string) => {
    if (e) e.preventDefault();
    const activeTopic = customTopic || topic;
    if (!activeTopic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/flowviz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: activeTopic }),
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
      localStorage.removeItem('flowchart_auto_generate');
      localStorage.removeItem('flowchart_auto_input');
      if (currentTitle === 'Untitled') {
        setCurrentTitle(activeTopic);
        setTempTitle(activeTopic);
      }
      saveFlowchart(result, activeTopic);
    } catch (err: any) {
      setError('Failed to generate diagram.');
      toast.error(err.message || 'Failed to generate diagram');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: (typeof TEMPLATES)[number]) => {
    setTopic(template.topic);
    setDiagramData(template.data);
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
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between h-14 px-4 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {currentUser ? (
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <Input
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleTitleChange(tempTitle); setIsEditingTitle(false); }
                    else if (e.key === 'Escape') { setTempTitle(currentTitle); setIsEditingTitle(false); }
                  }}
                  onBlur={() => { handleTitleChange(tempTitle); setIsEditingTitle(false); }}
                  className="h-7 px-2 text-sm font-medium w-48"
                  autoFocus
                />
              ) : (
                <>
                  <span className="font-medium text-sm max-w-48 truncate">{currentTitle}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => { setTempTitle(currentTitle); setIsEditingTitle(true); }}
                  >
                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <span className="font-semibold text-sm">InfoGiph</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={animationType}
            onValueChange={(v) => v && setAnimationType(v)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="dots" className="gap-1.5 text-xs px-2.5">
              <CircleDot size={14} /> Dots
            </ToggleGroupItem>
            <ToggleGroupItem value="beams" className="gap-1.5 text-xs px-2.5">
              <LineChart size={14} /> Beams
            </ToggleGroupItem>
            <ToggleGroupItem value="pulses" className="gap-1.5 text-xs px-2.5">
              <Activity size={14} /> Pulses
            </ToggleGroupItem>
            <ToggleGroupItem value="arrows" className="gap-1.5 text-xs px-2.5">
              <ArrowRight size={14} /> Arrows
            </ToggleGroupItem>
          </ToggleGroup>

          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting} className="gap-1.5 text-xs">
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export{isExporting && exportProgress > 0 ? ` ${exportProgress}%` : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => exportPNG(currentTitle)}>Download as PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSVG(currentTitle)}>Download as SVG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportGIF(currentTitle)}>Download as GIF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMP4(currentTitle)}>Download as MP4</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>

          {currentUser && (
            <Button
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving}
              className="text-xs gap-1.5"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          )}

          {currentUser ? (
            <UserButton user={currentUser} />
          ) : (
            <LoginWrapper mode="modal" asChild callbackUrl={currentPath}>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5">
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
          <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
            <div className="p-4 pb-2">
              <h2 className="text-sm font-semibold text-foreground">Templates</h2>
              <p className="text-xs text-muted-foreground mt-1">Pick a template or describe your own</p>
            </div>
            <Separator />
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground group-hover:text-accent-foreground transition-colors">
                      {template.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{template.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{template.data.satellites?.length || (template.data.root?.children?.length ?? 0)} nodes</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-3">
              <form onSubmit={generateDiagram} className="space-y-2">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Describe your system..."
                  className="text-xs h-9"
                />
                <Button
                  type="submit"
                  disabled={loading || !topic.trim()}
                  className="w-full gap-2 text-xs h-9"
                  size="sm"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate with AI
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Subtle animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-background to-purple-50/30 dark:from-blue-950/20 dark:via-background dark:to-purple-950/10 -z-10">
            <motion.div
              className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"
              animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-bl from-pink-400/10 to-orange-400/10 rounded-full blur-3xl"
              animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            />
          </div>

          <div className="h-full flex items-center justify-center p-6">
            <Card className="w-full h-full max-h-full border shadow-sm overflow-hidden py-0">
              <CardContent className="p-0 h-full">
                <div ref={exportContainerRef} className="w-full h-full flex items-center justify-center bg-card">
                  <DiagramRenderer data={diagramData} mode={animationType} />
                </div>
              </CardContent>
            </Card>
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
