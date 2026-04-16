'use client';

import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

export type PreviewMode = 'dots' | 'beams' | 'pulses' | 'arrows';

export interface PreviewNode {
  key: string;
  icon: ReactNode;
  label?: string;
}

export interface TreeNode extends PreviewNode {
  children?: TreeNode[];
}

interface SpecBase {
  mode: PreviewMode;
  bg?: string;
  accent?: string;
}

export type PreviewSpec =
  | (SpecBase & {
      layout: 'hub-lr';
      left: PreviewNode[];
      right: PreviewNode[];
      center: PreviewNode;
    })
  | (SpecBase & {
      layout: 'tree';
      root: TreeNode;
    })
  | (SpecBase & {
      layout: 'pipeline';
      nodes: PreviewNode[];
    })
  | (SpecBase & {
      layout: 'radial';
      center: PreviewNode;
      satellites: PreviewNode[];
    });

interface PositionedTile {
  key: string;
  icon: ReactNode;
  label?: string;
  x: number;
  y: number;
  size: number;
  center?: boolean;
}

type EdgeKind = 'curve-h' | 'line' | 'bracket-v' | 'cubic';

interface Edge {
  key: string;
  from: string;
  to: string;
  kind: EdgeKind;
}

interface Dims {
  W: number;
  H: number;
  tileBase: number;
  tileLarge: number;
  margin: number;
  labelSize: number;
}

const HOME_DIMS: Dims = {
  W: 240,
  H: 320,
  tileBase: 22,
  tileLarge: 32,
  margin: 52,
  labelSize: 0,
};

const CANVAS_DIMS: Dims = {
  W: 960,
  H: 540,
  tileBase: 44,
  tileLarge: 72,
  margin: 130,
  labelSize: 13,
};

function hubLRLayout(spec: Extract<PreviewSpec, { layout: 'hub-lr' }>, d: Dims) {
  const tiles: PositionedTile[] = [];
  const edges: Edge[] = [];
  const cx = d.W / 2;
  const cy = d.H / 2;
  const leftX = d.margin + d.tileBase / 2;
  const rightX = d.W - d.margin - d.tileBase / 2;

  const place = (nodes: PreviewNode[], x: number) => {
    const top = d.margin;
    const bottom = d.H - d.margin;
    const gap = (bottom - top) / (nodes.length + 1);
    return nodes.map((n, i) => ({ ...n, x, y: top + gap * (i + 1) }));
  };

  const L = place(spec.left, leftX);
  const R = place(spec.right, rightX);

  for (const n of [...L, ...R]) {
    edges.push({ key: `e-${n.key}`, from: n.key, to: spec.center.key, kind: 'curve-h' });
    tiles.push({ key: n.key, icon: n.icon, label: n.label, x: n.x, y: n.y, size: d.tileBase });
  }
  tiles.push({
    key: spec.center.key,
    icon: spec.center.icon,
    label: spec.center.label,
    x: cx,
    y: cy,
    size: d.tileLarge,
    center: true,
  });
  return { tiles, edges };
}

function pipelineLayout(spec: Extract<PreviewSpec, { layout: 'pipeline' }>, d: Dims) {
  const tiles: PositionedTile[] = [];
  const edges: Edge[] = [];
  const y = d.H / 2;
  const n = spec.nodes.length;
  const usable = d.W - d.margin * 2;
  const gap = usable / Math.max(n - 1, 1);
  const points = spec.nodes.map((node, i) => ({
    ...node,
    x: d.margin + gap * i,
    y,
  }));
  const midIdx = Math.floor((points.length - 1) / 2);
  for (let i = 0; i < points.length - 1; i++) {
    edges.push({
      key: `pipe-${i}`,
      from: points[i].key,
      to: points[i + 1].key,
      kind: 'line',
    });
  }
  points.forEach((p, i) => {
    tiles.push({
      key: p.key,
      icon: p.icon,
      label: p.label,
      x: p.x,
      y: p.y,
      size: i === midIdx ? d.tileLarge : d.tileBase,
      center: i === midIdx,
    });
  });
  return { tiles, edges };
}

function radialLayout(spec: Extract<PreviewSpec, { layout: 'radial' }>, d: Dims) {
  const tiles: PositionedTile[] = [];
  const edges: Edge[] = [];
  const cx = d.W / 2;
  const cy = d.H / 2;
  const rx = d.W * 0.36;
  const ry = d.H * 0.34;
  const n = spec.satellites.length;
  for (let i = 0; i < n; i++) {
    const sat = spec.satellites[i];
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    edges.push({ key: `r-${sat.key}`, from: spec.center.key, to: sat.key, kind: 'cubic' });
    tiles.push({ key: sat.key, icon: sat.icon, label: sat.label, x, y, size: d.tileBase });
  }
  tiles.push({
    key: spec.center.key,
    icon: spec.center.icon,
    label: spec.center.label,
    x: cx,
    y: cy,
    size: d.tileLarge,
    center: true,
  });
  return { tiles, edges };
}

function treeLayout(spec: Extract<PreviewSpec, { layout: 'tree' }>, d: Dims) {
  const tiles: PositionedTile[] = [];
  const edges: Edge[] = [];
  const root = spec.root;
  const rootX = d.W / 2;
  const rootY = d.margin * 0.6 + d.tileLarge / 2;
  const level1 = root.children || [];
  const l1Y = d.H * 0.52;
  const l1Usable = d.W - d.margin * 0.6 * 2;
  const l1Gap = l1Usable / (level1.length + 1);

  tiles.push({
    key: root.key,
    icon: root.icon,
    label: root.label,
    x: rootX,
    y: rootY,
    size: d.tileLarge,
    center: true,
  });

  level1.forEach((child, i) => {
    const x = d.margin * 0.6 + l1Gap * (i + 1);
    const y = l1Y;
    edges.push({ key: `t1-${child.key}`, from: root.key, to: child.key, kind: 'bracket-v' });
    tiles.push({ key: child.key, icon: child.icon, label: child.label, x, y, size: d.tileBase });

    const l2 = child.children || [];
    if (l2.length) {
      const l2Y = d.H - d.margin - d.tileBase / 2;
      const l2Gap = d.tileBase + 20;
      const startX = x - ((l2.length - 1) * l2Gap) / 2;
      l2.forEach((gc, j) => {
        const gx = startX + l2Gap * j;
        edges.push({
          key: `t2-${gc.key}`,
          from: child.key,
          to: gc.key,
          kind: 'bracket-v',
        });
        tiles.push({
          key: gc.key,
          icon: gc.icon,
          label: gc.label,
          x: gx,
          y: l2Y,
          size: d.tileBase * 0.9,
        });
      });
    }
  });
  return { tiles, edges };
}

function computeLayout(spec: PreviewSpec, d: Dims) {
  switch (spec.layout) {
    case 'hub-lr':
      return hubLRLayout(spec, d);
    case 'pipeline':
      return pipelineLayout(spec, d);
    case 'radial':
      return radialLayout(spec, d);
    case 'tree':
      return treeLayout(spec, d);
  }
}

function pathFor(edge: Edge, byKey: Record<string, { x: number; y: number }>): string {
  const a = byKey[edge.from];
  const b = byKey[edge.to];
  if (!a || !b) return '';
  switch (edge.kind) {
    case 'curve-h': {
      const cp = (a.x + b.x) / 2;
      return `M ${a.x} ${a.y} Q ${cp} ${b.y}, ${b.x} ${b.y}`;
    }
    case 'line':
      return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    case 'bracket-v': {
      const midY = (a.y + b.y) / 2;
      return `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;
    }
    case 'cubic': {
      const cp1x = a.x + (b.x - a.x) * 0.5;
      return `M ${a.x} ${a.y} C ${cp1x} ${a.y}, ${cp1x} ${b.y}, ${b.x} ${b.y}`;
    }
  }
}

export interface AnimatedPreviewProps {
  variant?: 'home' | 'canvas';
  modeOverride?: PreviewMode;
  showModeChip?: boolean;
  editable?: boolean;
  speed?: number;
  positionOverrides?: Record<string, { x: number; y: number }>;
  labelOverrides?: Record<string, string>;
  onPositionChange?: (key: string, x: number, y: number) => void;
  onLabelChange?: (key: string, label: string) => void;
}

export function AnimatedPreview(
  props: PreviewSpec & AnimatedPreviewProps,
) {
  const {
    variant = 'home',
    modeOverride,
    showModeChip = true,
    editable = false,
    speed = 1,
    positionOverrides = {},
    labelOverrides = {},
    onPositionChange,
    onLabelChange,
    ...specProps
  } = props as any;
  const spec = specProps as PreviewSpec;

  const dims = variant === 'canvas' ? CANVAS_DIMS : HOME_DIMS;
  const layout = computeLayout(spec, dims);

  // Apply position overrides on top of computed layout
  const tiles = layout.tiles.map((t) => {
    const ov = positionOverrides[t.key];
    return ov ? { ...t, x: ov.x, y: ov.y } : t;
  });

  const byKey: Record<string, { x: number; y: number }> = {};
  for (const t of tiles) byKey[t.key] = { x: t.x, y: t.y };

  const mode = (modeOverride ?? spec.mode) as PreviewMode;
  const accent = spec.accent || '#ff5b8a';
  const gradId = `beam-grad-${variant}-${mode}-${spec.layout}`;

  const sm = (s: number) => `${(s / Math.max(speed, 0.05)).toFixed(2)}s`;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragKey = useRef<string | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const toSvg = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * dims.W,
      y: ((clientY - rect.top) / rect.height) * dims.H,
    };
  };

  const beginDrag = (key: string) => (e: PointerEvent<HTMLDivElement>) => {
    if (!editable || !onPositionChange) return;
    e.preventDefault();
    const tile = tiles.find((t) => t.key === key);
    if (!tile) return;
    const p = toSvg(e.clientX, e.clientY);
    dragOffset.current = { dx: p.x - tile.x, dy: p.y - tile.y };
    dragKey.current = key;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragKey.current || !onPositionChange) return;
    const p = toSvg(e.clientX, e.clientY);
    onPositionChange(
      dragKey.current,
      p.x - dragOffset.current.dx,
      p.y - dragOffset.current.dy,
    );
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragKey.current) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragKey.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={
        variant === 'canvas'
          ? 'relative w-full h-full overflow-hidden rounded-xl select-none'
          : 'absolute inset-0 overflow-hidden'
      }
      style={{
        background:
          spec.bg ||
          (variant === 'canvas'
            ? 'transparent'
            : 'linear-gradient(135deg,#fafafa 0%,#ffffff 100%)'),
      }}
    >
      <svg
        viewBox={`0 0 ${dims.W} ${dims.H}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,107,157,0)" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgba(255,107,157,0)" />
          </linearGradient>
        </defs>

        {layout.edges.map((e, i) => {
          const d = pathFor(e, byKey);
          const dotR = variant === 'canvas' ? 5 : 3.2;
          const beamW = variant === 'canvas' ? 4 : 3;
          const beamDash = variant === 'canvas' ? '120 520' : '60 260';
          const beamOffset = variant === 'canvas' ? 640 : 320;
          const arrowScale = variant === 'canvas' ? 1.8 : 1;
          const pulseMax = variant === 'canvas' ? 14 : 7;
          const pulseEnd = variant === 'canvas' ? 6 : 3;

          return (
            <g key={e.key}>
              <path
                d={d}
                stroke="rgba(15,42,62,0.14)"
                strokeWidth={variant === 'canvas' ? 1.6 : 1.1}
                strokeDasharray={variant === 'canvas' ? '6 6' : '3 4'}
                fill="none"
              />

              {mode === 'beams' && (
                <path
                  d={d}
                  stroke={`url(#${gradId})`}
                  strokeWidth={beamW}
                  strokeDasharray={beamDash}
                  fill="none"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from={beamOffset}
                    to={0}
                    dur={sm(2.4)}
                    begin={`${i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                </path>
              )}

              {mode === 'dots' &&
                [0, 0.35, 0.7].map((offset) => (
                  <circle key={`${e.key}-dot-${offset}`} r={dotR} fill={accent}>
                    <animateMotion
                      dur={sm(2.6)}
                      repeatCount="indefinite"
                      path={d}
                      begin={`${offset + i * 0.15}s`}
                    />
                  </circle>
                ))}

              {mode === 'arrows' && (
                <path
                  d={`M ${-5 * arrowScale},${-3 * arrowScale} L ${5 * arrowScale},0 L ${-5 * arrowScale},${3 * arrowScale} Z`}
                  fill={accent}
                >
                  <animateMotion
                    dur={sm(2.2)}
                    repeatCount="indefinite"
                    path={d}
                    rotate="auto"
                    begin={`${i * 0.15}s`}
                  />
                </path>
              )}

              {mode === 'pulses' &&
                [0, 0.8].map((offset) => (
                  <circle
                    key={`${e.key}-pulse-${offset}`}
                    r="0"
                    fill={accent}
                    fillOpacity="0.25"
                    stroke={accent}
                    strokeWidth="1.5"
                    opacity="0"
                  >
                    <animateMotion
                      dur={sm(2.4)}
                      repeatCount="indefinite"
                      path={d}
                      begin={`${offset + i * 0.15}s`}
                    />
                    <animate
                      attributeName="r"
                      values={`0;${pulseMax};${pulseEnd}`}
                      dur={sm(2.4)}
                      begin={`${offset + i * 0.15}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.95;0"
                      dur={sm(2.4)}
                      begin={`${offset + i * 0.15}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
            </g>
          );
        })}
      </svg>

      <div
        className="absolute inset-0"
        onPointerMove={editable ? moveDrag : undefined}
        onPointerUp={editable ? endDrag : undefined}
        onPointerCancel={editable ? endDrag : undefined}
      >
        {tiles.map((t) => (
          <Tile
            key={t.key}
            tile={t}
            dims={dims}
            variant={variant}
            editable={editable}
            label={labelOverrides[t.key] ?? t.label}
            onLabelChange={onLabelChange}
            onPointerDown={beginDrag(t.key)}
          />
        ))}
      </div>

      {showModeChip ? (
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/85 backdrop-blur border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-foreground/70 shadow-sm">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: accent }}
          />
          {mode}
        </span>
      ) : null}
    </div>
  );
}

function Tile({
  tile,
  dims,
  variant,
  editable,
  label,
  onLabelChange,
  onPointerDown,
}: {
  tile: PositionedTile;
  dims: Dims;
  variant: 'home' | 'canvas';
  editable: boolean;
  label?: string;
  onLabelChange?: (key: string, label: string) => void;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  const leftPct = (tile.x / dims.W) * 100;
  const topPct = (tile.y / dims.H) * 100;
  const padding = variant === 'canvas' ? 22 : 16;
  const tilePx = tile.size + padding;
  const iconPadding = Math.round(tilePx * 0.22);
  const iconPx = tilePx - iconPadding * 2;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label || '');
  useEffect(() => setDraft(label || ''), [label]);

  const commit = () => {
    if (onLabelChange && draft !== label) onLabelChange(tile.key, draft);
    setEditing(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') {
      setDraft(label || '');
      setEditing(false);
    }
  };

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      <div
        onPointerDown={onPointerDown}
        className={
          'flex items-center justify-center rounded-2xl border ' +
          (editable ? 'cursor-grab active:cursor-grabbing ' : '') +
          (tile.center
            ? 'bg-foreground text-background border-foreground shadow-[0_12px_28px_-8px_rgba(0,0,0,0.3)]'
            : 'bg-white border-border/80 shadow-[0_6px_16px_-6px_rgba(15,42,62,0.18)]')
        }
        style={{ width: tilePx, height: tilePx, touchAction: 'none' }}
      >
        <div
          className="flex items-center justify-center pointer-events-none"
          style={{ width: iconPx, height: iconPx }}
        >
          {tile.icon}
        </div>
      </div>
      {variant === 'canvas' ? (
        editing ? (
          <input
            value={draft}
            autoFocus
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            className="mt-2 text-[13px] font-medium text-foreground/90 bg-white border border-border rounded px-1.5 py-0.5 outline-none focus:border-foreground/50 text-center min-w-20 max-w-44"
          />
        ) : (
          <button
            type="button"
            onClick={() => editable && setEditing(true)}
            className={
              'mt-2 text-[13px] font-medium text-foreground/75 whitespace-nowrap ' +
              (editable ? 'hover:text-foreground hover:underline cursor-text' : '')
            }
          >
            {label || ' '}
          </button>
        )
      ) : null}
    </div>
  );
}
