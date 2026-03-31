'use client';

import {
  Bot,
  Briefcase,
  Cloud,
  Code2,
  Database,
  Globe,
  HardDrive,
  Home,
  Layers,
  Mail,
  MessageSquare,
  Search,
  Settings,
  Share2,
  Smartphone,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

const getIcon = (name: string, size = 16) => {
  const n = name.toLowerCase();
  if (n.includes('db') || n.includes('database')) return <Database size={size} />;
  if (n.includes('cloud') || n.includes('api')) return <Cloud size={size} />;
  if (n.includes('web') || n.includes('globe')) return <Globe size={size} />;
  if (n.includes('chat') || n.includes('msg')) return <MessageSquare size={size} />;
  if (n.includes('ai') || n.includes('bot') || n.includes('llm')) return <Bot size={size} />;
  if (n.includes('drive') || n.includes('storage') || n.includes('memory')) return <HardDrive size={size} />;
  if (n.includes('mobile') || n.includes('app')) return <Smartphone size={size} />;
  if (n.includes('mail') || n.includes('email') || n.includes('notify')) return <Mail size={size} />;
  if (n.includes('search') || n.includes('analytics')) return <Search size={size} />;
  if (n.includes('process') || n.includes('auth') || n.includes('billing')) return <Workflow size={size} />;
  if (n.includes('zap') || n.includes('auto') || n.includes('tools')) return <Zap size={size} />;
  if (n.includes('social') || n.includes('share') || n.includes('ship')) return <Share2 size={size} />;
  return <Layers size={size} />;
};

interface DiagramData {
  center: { label: string; icon: string };
  satellites: { label: string; icon: string }[];
}

interface GalleryDiagramProps {
  data: DiagramData;
  accentColor?: string;
  label: string;
}

export const GALLERY_DIAGRAMS: { data: DiagramData; accentColor: string; label: string }[] = [
  {
    label: 'AI Agent System',
    accentColor: '#8b5cf6',
    data: {
      center: { label: 'AI Agent', icon: 'bot' },
      satellites: [
        { label: 'LLM', icon: 'ai' },
        { label: 'Vector DB', icon: 'database' },
        { label: 'Tools', icon: 'tools' },
        { label: 'Memory', icon: 'memory' },
        { label: 'Search', icon: 'search' },
      ],
    },
  },
  {
    label: 'E-Commerce Flow',
    accentColor: '#f59e0b',
    data: {
      center: { label: 'Store', icon: 'web' },
      satellites: [
        { label: 'Products', icon: 'database' },
        { label: 'Cart', icon: 'process' },
        { label: 'Payments', icon: 'zap' },
        { label: 'Shipping', icon: 'ship' },
        { label: 'Notify', icon: 'notify' },
      ],
    },
  },
  {
    label: 'SaaS Architecture',
    accentColor: '#3b82f6',
    data: {
      center: { label: 'API', icon: 'cloud' },
      satellites: [
        { label: 'Auth', icon: 'auth' },
        { label: 'Users DB', icon: 'database' },
        { label: 'Billing', icon: 'billing' },
        { label: 'Dashboard', icon: 'web' },
        { label: 'Email', icon: 'email' },
      ],
    },
  },
];

// Org chart types and data
interface OrgNode {
  label: string;
  role?: string;
  tool?: string;
  icon: React.ReactNode;
  children?: OrgNode[];
}

export const ORG_CHART_DATA: OrgNode = {
  label: 'CEO',
  tool: 'Claude',
  icon: <Home size={12} />,
  children: [
    { label: 'CMO', tool: 'OpenClaw', icon: <Globe size={12} /> },
    {
      label: 'CTO',
      tool: 'Cursor',
      icon: <Settings size={12} />,
      children: [
        { label: 'CodexCoder', role: 'Engineer', tool: 'Codex', icon: <Code2 size={12} /> },
        { label: 'ClaudeCoder', role: 'Engineer', tool: 'Claude', icon: <Code2 size={12} /> },
      ],
    },
    { label: 'COO', tool: 'Claude', icon: <Briefcase size={12} /> },
  ],
};

export function OrgChartDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!dims.w) return <div ref={containerRef} className="w-full h-full" />;

  const { w, h } = dims;
  const nodeW = 72;
  const nodeH = 38;
  const accent = '#d4a017';

  // Layout positions
  const ceoX = w / 2;
  const ceoY = 28;

  const level1Y = ceoY + 64;
  const l1Positions = [w * 0.18, w * 0.5, w * 0.82];

  const level2Y = level1Y + 68;
  const l2Positions = [w * 0.35, w * 0.65];

  type NodePos = { x: number; y: number; node: OrgNode };
  const nodes: NodePos[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // CEO
  nodes.push({ x: ceoX, y: ceoY, node: ORG_CHART_DATA });

  // Level 1
  ORG_CHART_DATA.children?.forEach((child, i) => {
    const x = l1Positions[i];
    nodes.push({ x, y: level1Y, node: child });
    lines.push({ x1: ceoX, y1: ceoY + nodeH / 2, x2: x, y2: level1Y - nodeH / 2 });

    // Level 2 (CTO children)
    if (child.children) {
      child.children.forEach((grandchild, j) => {
        const gx = l2Positions[j];
        nodes.push({ x: gx, y: level2Y, node: grandchild });
        lines.push({ x1: x, y1: level1Y + nodeH / 2, x2: gx, y2: level2Y - nodeH / 2 });
      });
    }
  });

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      <div className="absolute top-3 left-3 z-10">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Org Chart</span>
      </div>

      <svg className="w-full h-full" viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <filter id="org-sh" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.06" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines with animation */}
        {lines.map((line, i) => {
          const midY = (line.y1 + line.y2) / 2;
          const pathD = `M ${line.x1} ${line.y1} L ${line.x1} ${midY} L ${line.x2} ${midY} L ${line.x2} ${line.y2}`;
          return (
            <React.Fragment key={i}>
              <motion.path
                d={pathD}
                fill="none"
                stroke="#d1d5db"
                strokeWidth="1.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              />
              <motion.circle
                r="2"
                fill={accent}
                initial={{ '--offset-distance': '0%' } as any}
                animate={{ '--offset-distance': '100%' } as any}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: i * 0.3 }}
                style={{ offsetPath: `path("${pathD}")`, offsetDistance: 'var(--offset-distance)' } as React.CSSProperties}
              />
            </React.Fragment>
          );
        })}

        {/* Nodes */}
        {nodes.map((np, i) => (
          <motion.g
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, delay: 0.3 + i * 0.06 }}
          >
            <rect
              x={np.x - nodeW / 2}
              y={np.y - nodeH / 2}
              width={nodeW}
              height={nodeH}
              rx="8"
              fill="white"
              filter="url(#org-sh)"
              className="stroke-gray-200 stroke-1"
            />
            <foreignObject x={np.x - nodeW / 2} y={np.y - nodeH / 2} width={nodeW} height={nodeH}>
              <div className="w-full h-full flex items-center gap-1.5 px-2 pointer-events-none">
                <div className="flex-shrink-0 p-1 rounded bg-gray-100 text-gray-500">
                  {np.node.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[7px] font-bold text-gray-800 leading-tight truncate">{np.node.label}</div>
                  {np.node.tool && (
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                      <span className="text-[6px] text-gray-500 truncate">{np.node.tool}</span>
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

export function GalleryDiagram({ data, accentColor = '#3b82f6', label }: GalleryDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!dims.w) return <div ref={containerRef} className="w-full h-full" />;

  const cx = dims.w / 2;
  const cy = dims.h / 2;
  const rx = Math.min(dims.w * 0.34, 130);
  const ry = Math.min(dims.h * 0.34, 90);

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      {/* Label */}
      <div className="absolute top-3 left-3 z-10">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>

      <svg className="w-full h-full" viewBox={`0 0 ${dims.w} ${dims.h}`}>
        <defs>
          <radialGradient id={`ng-${label}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </radialGradient>
          <filter id={`sh-${label}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.08" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`beam-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`${accentColor}00`} />
            <stop offset="50%" stopColor={`${accentColor}cc`} />
            <stop offset="100%" stopColor={`${accentColor}00`} />
          </linearGradient>
        </defs>

        {data.satellites.map((sat, i) => {
          const angle = (i / data.satellites.length) * 2 * Math.PI - Math.PI / 2;
          const x = cx + rx * Math.cos(angle);
          const y = cy + ry * Math.sin(angle);
          const cpx = cx + (x - cx) * 0.5;
          const pathD = `M ${cx} ${cy} C ${cpx} ${cy}, ${cpx} ${y}, ${x} ${y}`;

          return (
            <React.Fragment key={i}>
              <motion.path
                d={pathD}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
              {/* Animated dots */}
              {[0, 0.35].map((offset) => (
                <motion.circle
                  key={offset}
                  r="2"
                  fill={accentColor}
                  initial={{ '--offset-distance': '0%' } as any}
                  animate={{ '--offset-distance': '100%' } as any}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: offset + i * 0.25 }}
                  style={{ offsetPath: `path("${pathD}")`, offsetDistance: 'var(--offset-distance)' } as React.CSSProperties}
                />
              ))}
              {/* Satellite node */}
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, delay: 0.4 + i * 0.08 }}
              >
                <circle cx={x} cy={y} r="26" fill={`url(#ng-${label})`} filter={`url(#sh-${label})`} className="stroke-slate-200 stroke-1" />
                <foreignObject x={x - 26} y={y - 26} width="52" height="52">
                  <div className="w-full h-full flex flex-col items-center justify-center text-center pointer-events-none">
                    <div style={{ color: accentColor }} className="mb-0.5">{getIcon(sat.icon || sat.label)}</div>
                    <span className="text-[7px] font-bold text-slate-500 leading-tight uppercase tracking-tighter line-clamp-1">
                      {sat.label}
                    </span>
                  </div>
                </foreignObject>
              </motion.g>
            </React.Fragment>
          );
        })}

        {/* Center node */}
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <circle cx={cx} cy={cy} r="32" fill="white" filter={`url(#sh-${label})`} stroke={accentColor} strokeWidth="2" strokeOpacity="0.3" />
          <foreignObject x={cx - 32} y={cy - 32} width="64" height="64">
            <div className="w-full h-full flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="p-1.5 rounded-lg shadow-sm mb-0.5" style={{ backgroundColor: accentColor, color: 'white' }}>
                {getIcon(data.center.icon || data.center.label, 14)}
              </div>
              <span className="text-[7px] font-black text-slate-700 uppercase tracking-tight line-clamp-1">
                {data.center.label}
              </span>
            </div>
          </foreignObject>
        </motion.g>
      </svg>
    </div>
  );
}
