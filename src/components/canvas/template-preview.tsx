'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface PreviewNode {
  key: string;
  icon: ReactNode;
  bg?: string;
  label?: string;
}

// Magic-UI "animated beam" style mini preview: satellite icons on the left
// and right, a center icon in the middle, animated beams flowing between them.
export function TemplatePreview({
  left,
  right,
  center,
}: {
  left: PreviewNode[];
  right: PreviewNode[];
  center: PreviewNode;
}) {
  const width = 240;
  const height = 120;
  const leftX = 32;
  const rightX = width - 32;
  const centerX = width / 2;
  const centerY = height / 2;

  const placements = (nodes: PreviewNode[], x: number) => {
    const count = Math.max(nodes.length, 1);
    const gap = (height - 24) / (count + 1);
    return nodes.map((n, i) => ({
      ...n,
      x,
      y: 12 + gap * (i + 1),
    }));
  };

  const leftP = placements(left, leftX);
  const rightP = placements(right, rightX);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-white">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="tpl-beam" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(26,198,255,0)" />
            <stop offset="50%" stopColor="rgba(26,198,255,0.9)" />
            <stop offset="100%" stopColor="rgba(26,198,255,0)" />
          </linearGradient>
        </defs>

        {/* Beam paths */}
        {[...leftP, ...rightP].map((p, i) => {
          const cp = (p.x + centerX) / 2;
          const d = `M ${p.x} ${p.y} Q ${cp} ${centerY}, ${centerX} ${centerY}`;
          return (
            <g key={p.key}>
              <path d={d} stroke="#e5e5e5" strokeWidth="1.2" fill="none" />
              <motion.path
                d={d}
                stroke="url(#tpl-beam)"
                strokeWidth="2"
                strokeDasharray="24 140"
                fill="none"
                initial={{ strokeDashoffset: 160 }}
                animate={{ strokeDashoffset: -0 }}
                transition={{
                  duration: 2.2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'linear',
                  delay: i * 0.18,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Icon tiles overlaid on the SVG coordinate space */}
      <div className="absolute inset-0">
        {[...leftP, ...rightP].map((p) => (
          <IconTile key={p.key} node={p} width={width} height={height} size={22} />
        ))}
        <IconTile
          node={{ key: 'center', icon: center.icon, bg: center.bg, x: centerX, y: centerY } as any}
          width={width}
          height={height}
          size={30}
          center
        />
      </div>
    </div>
  );
}

// Full-canvas variant — renders the same animated-beam composition at a
// generous size. Icons get labels underneath, beams are thicker, rows spread
// to fill the container.
export function BeamDiagram({
  left,
  right,
  center,
}: {
  left: PreviewNode[];
  right: PreviewNode[];
  center: PreviewNode;
}) {
  const width = 960;
  const height = 540;
  const leftX = 120;
  const rightX = width - 120;
  const centerX = width / 2;
  const centerY = height / 2;

  const placements = (nodes: PreviewNode[], x: number) => {
    const count = Math.max(nodes.length, 1);
    const gap = (height - 80) / (count + 1);
    return nodes.map((n, i) => ({
      ...n,
      x,
      y: 40 + gap * (i + 1),
    }));
  };

  const leftP = placements(left, leftX);
  const rightP = placements(right, rightX);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="relative"
        style={{ width: '100%', maxWidth: width, aspectRatio: `${width} / ${height}` }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(26,198,255,0)" />
              <stop offset="50%" stopColor="rgba(26,198,255,0.95)" />
              <stop offset="100%" stopColor="rgba(26,198,255,0)" />
            </linearGradient>
            <linearGradient id="beam-grad-r" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,107,157,0)" />
              <stop offset="50%" stopColor="rgba(255,107,157,0.95)" />
              <stop offset="100%" stopColor="rgba(255,107,157,0)" />
            </linearGradient>
          </defs>

          {[...leftP, ...rightP].map((p, i) => {
            const isLeft = p.x < centerX;
            const cp = (p.x + centerX) / 2;
            const d = `M ${p.x} ${p.y} Q ${cp} ${centerY}, ${centerX} ${centerY}`;
            return (
              <g key={p.key}>
                <path
                  d={d}
                  stroke="#e5e5e5"
                  strokeWidth="1.8"
                  fill="none"
                />
                <motion.path
                  d={d}
                  stroke={`url(#${isLeft ? 'beam-grad' : 'beam-grad-r'})`}
                  strokeWidth="3"
                  strokeDasharray="80 400"
                  fill="none"
                  initial={{ strokeDashoffset: 480 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'linear',
                    delay: i * 0.25,
                  }}
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-0">
          {[...leftP, ...rightP].map((p) => (
            <BeamTile
              key={p.key}
              node={p}
              width={width}
              height={height}
              size={44}
            />
          ))}
          <BeamTile
            node={
              {
                key: 'center',
                icon: center.icon,
                bg: center.bg,
                label: center.label,
                x: centerX,
                y: centerY,
              } as any
            }
            width={width}
            height={height}
            size={72}
            center
          />
        </div>
      </div>
    </div>
  );
}

function BeamTile({
  node,
  width,
  height,
  size,
  center = false,
}: {
  node: PreviewNode & { x: number; y: number };
  width: number;
  height: number;
  size: number;
  center?: boolean;
}) {
  const leftPct = (node.x / width) * 100;
  const topPct = (node.y / height) * 100;
  const tileSize = size + 18;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
        className={
          'flex items-center justify-center rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.08)] ' +
          (center
            ? 'bg-foreground text-background border-foreground'
            : 'bg-white border-border')
        }
        style={{
          width: tileSize,
          height: tileSize,
          background: node.bg,
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {node.icon}
        </div>
      </motion.div>
      {node.label ? (
        <span className="mt-2 text-[11px] font-medium text-foreground/80 whitespace-nowrap">
          {node.label}
        </span>
      ) : null}
    </div>
  );
}

function IconTile({
  node,
  width,
  height,
  size,
  center = false,
}: {
  node: PreviewNode & { x: number; y: number };
  width: number;
  height: number;
  size: number;
  center?: boolean;
}) {
  const leftPct = (node.x / width) * 100;
  const topPct = (node.y / height) * 100;
  const tileSize = size + 12;
  return (
    <div
      className={
        'absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-lg border shadow-sm ' +
        (center
          ? 'bg-foreground text-background border-foreground'
          : 'bg-white border-border')
      }
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: tileSize,
        height: tileSize,
        background: node.bg,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {node.icon}
      </div>
    </div>
  );
}
