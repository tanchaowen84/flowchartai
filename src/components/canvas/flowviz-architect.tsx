'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Loader2, 
  Cpu, 
  Database, 
  Globe, 
  MessageSquare, 
  Zap, 
  Share2, 
  HardDrive, 
  Cloud, 
  Smartphone,
  Mail,
  Search,
  Bot,
  Layers,
  Activity,
  Workflow,
  MousePointer2,
  CircleDot,
  ArrowRight,
  LineChart,
  Edit,
  User,
  Download
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFlowchart } from '@/hooks/use-flowchart';
import { useLocalePathname } from '@/i18n/navigation';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const getIcon = (name: string) => {
  if (!name) return <Layers size={24} />;
  const n = name.toLowerCase();
  if (n.includes('db') || n.includes('database') || n.includes('sql')) return <Database size={24} />;
  if (n.includes('cloud')) return <Cloud size={24} />;
  if (n.includes('web') || n.includes('globe') || n.includes('internet')) return <Globe size={24} />;
  if (n.includes('msg') || n.includes('chat') || n.includes('whatsapp') || n.includes('messenger')) return <MessageSquare size={24} />;
  if (n.includes('ai') || n.includes('bot') || n.includes('gpt')) return <Bot size={24} />;
  if (n.includes('drive') || n.includes('storage')) return <HardDrive size={24} />;
  if (n.includes('mobile') || n.includes('app') || n.includes('phone')) return <Smartphone size={24} />;
  if (n.includes('mail') || n.includes('email')) return <Mail size={24} />;
  if (n.includes('search')) return <Search size={24} />;
  if (n.includes('process') || n.includes('logic')) return <Workflow size={24} />;
  if (n.includes('zapier') || n.includes('automation')) return <Zap size={24} />;
  if (n.includes('social') || n.includes('share')) return <Share2 size={24} />;
  return <Layers size={24} />;
};

export default function FlowVizArchitect({ flowchartId }: { flowchartId?: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const { flowchart, loading: flowchartLoading, error: flowchartError } = useFlowchart(flowchartId);

  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationType, setAnimationType] = useState("dots"); // dots, beams, pulses, arrows
  const [diagramData, setDiagramData] = useState<any>({
    center: { label: "AI Engine", icon: "bot" },
    satellites: [
      { label: "Google Drive", icon: "drive" },
      { label: "Notion", icon: "layers" },
      { label: "WhatsApp", icon: "chat" },
      { label: "Google Docs", icon: "mail" },
      { label: "Zapier", icon: "zap" },
      { label: "Messenger", icon: "chat" }
    ]
  });

  const [currentTitle, setCurrentTitle] = useState<string>('Untitled');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('Untitled');
  const [isSaving, setIsSaving] = useState(false);

  // Load initial data if editing an existing flowchart
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
          console.error("Failed to parse existing flowchart content");
        }
      }
    }
  }, [flowchart]);

  // Handle auto-generation from landing page
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      const autoGenerate = localStorage.getItem('flowchart_auto_generate');
      const autoInput = localStorage.getItem('flowchart_auto_input');
      
      if (autoGenerate === 'true' && autoInput) {
        setTopic(autoInput);
        localStorage.removeItem('flowchart_auto_generate');
        localStorage.removeItem('flowchart_auto_input');
        
        generateDiagram(undefined, autoInput);
      }
    }
  }, [currentUser]); // Trigger once user auth is loaded so generation succeeds

  const handleTitleChange = async (newTitle: string) => {
    setCurrentTitle(newTitle);
    if (flowchartId) {
      try {
        await fetch(`/api/flowcharts/${flowchartId}`, {
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
      const titleToSave = currentTitle !== 'Untitled' ? currentTitle : (customTitle || topic || 'Untitled');
      
      if (flowchartId) {
        await fetch(`/api/flowcharts/${flowchartId}`, {
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
            router.push(`/canvas/${newFlowchart.id}`);
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

    if (!currentUser) {
      toast.error("Please sign in to generate AI flowcharts");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/flowviz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: activeTopic })
      });

      if (response.status === 401) {
        toast.error("Please sign in to use this feature");
        setLoading(false);
        return;
      }
      
      if (response.status === 429) {
        const data = await response.json();
        toast.error(data.message || "Usage limit exceeded");
        setLoading(false);
        return;
      }
      
      if (!response.ok) throw new Error('Generation failed');
      
      const result = await response.json();
      setDiagramData(result);
      
      // Auto-update title if it's currently untitled
      if (currentTitle === 'Untitled') {
        setCurrentTitle(activeTopic);
        setTempTitle(activeTopic);
      }
      
      // Auto save
      saveFlowchart(result, activeTopic);
      
    } catch (err: any) {
      setError("Failed to generate diagram.");
      toast.error(err.message || "Failed to generate diagram");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = () => {
    saveFlowchart(diagramData);
  };

  if (flowchartId && flowchartLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center relative overflow-hidden">
        {/* Animated background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 -z-10">
          <motion.div
            className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-3xl"
            animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
        </div>
        <div className="flex flex-col items-center gap-4 relative z-10">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
          <p className="text-lg text-slate-600">Loading your architecture...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 font-sans p-4 md:p-8 relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 -z-10">
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 right-0 w-80 h-80 bg-gradient-to-bl from-pink-400/30 to-orange-400/30 rounded-full blur-3xl"
          animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 w-72 h-72 bg-gradient-to-tr from-green-400/30 to-blue-400/30 rounded-full blur-3xl"
          animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 0.9, 1] }}
          transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
      </div>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Top Navigation / Controls */}
        <div className="flex justify-between items-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-slate-100">
           {currentUser ? (
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <Input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTitleChange(tempTitle);
                        setIsEditingTitle(false);
                      } else if (e.key === 'Escape') {
                        setTempTitle(currentTitle);
                        setIsEditingTitle(false);
                      }
                    }}
                    onBlur={() => {
                      handleTitleChange(tempTitle);
                      setIsEditingTitle(false);
                    }}
                    className="h-8 px-2 text-sm font-medium min-w-32 max-w-64 bg-slate-50 border-slate-200"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="font-semibold text-slate-800 text-lg max-w-64 truncate">
                      {currentTitle}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTempTitle(currentTitle);
                        setIsEditingTitle(true);
                      }}
                      className="h-6 w-6 p-0 hover:bg-slate-100"
                    >
                      <Edit className="h-4 w-4 text-slate-500" />
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="font-semibold text-slate-800 text-lg">InfoGiph</div>
            )}

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              Dashboard
            </Button>
            {currentUser && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleManualSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            )}
            {currentUser ? (
              <UserButton user={currentUser} />
            ) : (
              <LoginWrapper mode="modal" asChild callbackUrl={currentPath}>
                <Button variant="ghost" size="sm" className="h-9 flex items-center gap-2">
                  <User className="h-4 w-4" /> Sign In
                </Button>
              </LoginWrapper>
            )}
          </div>
        </div>

        <header className="text-center space-y-4 pt-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent"
          >
            InfoGiph
          </motion.h1>
          
          <form onSubmit={generateDiagram} className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto pt-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic or system (e.g. Chatbot Architecture)..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base"
            />
            <button
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send size={20} />}
              Generate
            </button>
          </form>

          {/* Animation Options Toggle */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {[
              { id: 'dots', icon: <CircleDot size={16}/>, label: 'Dots' },
              { id: 'beams', icon: <LineChart size={16}/>, label: 'Beams' },
              { id: 'pulses', icon: <Activity size={16}/>, label: 'Pulses' },
              { id: 'arrows', icon: <ArrowRight size={16}/>, label: 'Arrows' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAnimationType(option.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  animationType === option.id 
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' 
                  : 'bg-white text-slate-500 hover:bg-slate-100 shadow-sm border border-slate-100'
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <div className="relative w-full aspect-square md:aspect-[16/9] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex items-center justify-center mt-8">
          <DiagramRenderer data={diagramData} mode={animationType} />
        </div>
      </div>
    </div>
  );
}

function DiagramRenderer({ data, mode }: { data: any, mode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (!dimensions.width) return <div ref={containerRef} className="w-full h-full" />;

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
            <feComponentTransfer><feFuncA type="linear" slope="0.1" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>

          <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
            <stop offset="50%" stopColor="rgba(59, 130, 246, 0.8)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
          </linearGradient>
        </defs>

        <AnimatePresence mode="wait">
          <g key={`${JSON.stringify(data)}-${mode}`}>
            {data.satellites && data.satellites.map((sat: any, i: number) => {
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
                  <motion.path
                    d={pathD}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="2"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                  />

                  {mode === 'dots' && (
                    <>
                      {[0, 0.3, 0.6].map((offset) => (
                        <motion.circle
                          key={offset}
                          r="3"
                          fill="#3b82f6"
                          initial={{ "--offset-distance": "0%" } as any}
                          animate={{ "--offset-distance": "100%" } as any}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "linear",
                            delay: offset + (i * 0.2)
                          }}
                          style={{ offsetPath: `path("${pathD}")`, offsetDistance: "var(--offset-distance)" } as React.CSSProperties}
                        />
                      ))}
                    </>
                  )}

                  {mode === 'beams' && (
                    <motion.path
                      d={pathD}
                      fill="none"
                      stroke="url(#beamGradient)"
                      strokeWidth="4"
                      strokeDasharray="50, 150"
                      initial={{ strokeDashoffset: 200 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                        delay: i * 0.15
                      }}
                    />
                  )}

                  {mode === 'pulses' && (
                    <motion.circle
                      cx={centerX}
                      cy={centerY}
                      r="10"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      fill="none"
                      initial={{ opacity: 0.8, scale: 0, "--offset-distance": "0%" } as any}
                      animate={{ opacity: 0, scale: 10, "--offset-distance": "100%" } as any}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: i * 0.4
                      }}
                      style={{ offsetPath: `path("${pathD}")`, offsetDistance: "var(--offset-distance)" } as React.CSSProperties}
                    />
                  )}

                  {mode === 'arrows' && (
                    <motion.path
                      d="M -5,-3 L 5,0 L -5,3 Z"
                      fill="#3b82f6"
                      initial={{ "--offset-distance": "0%" } as any}
                      animate={{ "--offset-distance": "100%" } as any}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                        delay: i * 0.1
                      }}
                      style={{ 
                        offsetPath: `path("${pathD}")`, 
                        offsetDistance: "var(--offset-distance)",
                        offsetRotate: "auto"
                      } as React.CSSProperties}
                    />
                  )}

                  <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 12, delay: 0.5 + i * 0.1 }}
                  >
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
              <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
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
