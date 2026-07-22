export const PATCHABLE_FLOWCHART_KEYWORDS = ['flowchart', 'graph'] as const;
export const PATCHABLE_FLOWCHART_DIRECTIONS = ['LR', 'RL', 'TD', 'BT'] as const;
export const PATCHABLE_FLOWCHART_NODE_SHAPES = [
  'rectangle',
  'rounded',
  'diamond',
  'ellipse',
  'stadium',
  'circle',
] as const;
export const PATCHABLE_FLOWCHART_EDGE_STYLES = ['solid', 'dashed'] as const;
export const PATCHABLE_FLOWCHART_NODE_STYLE_KEYS = [
  'fill',
  'stroke',
  'stroke-width',
] as const;

export const PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE = '[A-Za-z_][A-Za-z0-9_-]*';
export const PATCHABLE_FLOWCHART_SEMANTIC_ID_PATTERN = new RegExp(
  `^${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE}$`
);

export type PatchableFlowchartNodeShape =
  (typeof PATCHABLE_FLOWCHART_NODE_SHAPES)[number];
export type PatchableFlowchartNodeStyleKey =
  (typeof PATCHABLE_FLOWCHART_NODE_STYLE_KEYS)[number];

export interface PatchableFlowchartNodeStyle {
  fill?: string;
  stroke?: string;
  'stroke-width'?: string;
}

const COLOR_TOKEN_PATTERN =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z][a-z0-9-]*)$/i;
const STROKE_WIDTH_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?px$/;

export function isPatchableFlowchartSemanticId(value: string): boolean {
  return PATCHABLE_FLOWCHART_SEMANTIC_ID_PATTERN.test(value);
}

export function canonicalPatchableFlowchartEdgeSemanticId(
  sourceSemanticId: string,
  targetSemanticId: string
): string {
  return `${sourceSemanticId}__${targetSemanticId}`;
}

export function isPatchableFlowchartNodeShape(
  value: string
): value is PatchableFlowchartNodeShape {
  return (PATCHABLE_FLOWCHART_NODE_SHAPES as readonly string[]).includes(value);
}

export function isPatchableFlowchartNodeStyleKey(
  value: string
): value is PatchableFlowchartNodeStyleKey {
  return (PATCHABLE_FLOWCHART_NODE_STYLE_KEYS as readonly string[]).includes(
    value
  );
}

export function isPatchableFlowchartNodeStyleValue(
  key: PatchableFlowchartNodeStyleKey,
  value: string
): boolean {
  const normalized = value.trim();
  return key === 'stroke-width'
    ? STROKE_WIDTH_PATTERN.test(normalized)
    : COLOR_TOKEN_PATTERN.test(normalized);
}

export function parsePatchableFlowchartNodeStyle(
  styleText: string
): PatchableFlowchartNodeStyle | null {
  const entries = styleText
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;

  const style: PatchableFlowchartNodeStyle = {};
  const seen = new Set<PatchableFlowchartNodeStyleKey>();
  for (const entry of entries) {
    const separator = entry.indexOf(':');
    if (separator <= 0) return null;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (
      !isPatchableFlowchartNodeStyleKey(key) ||
      !isPatchableFlowchartNodeStyleValue(key, value) ||
      seen.has(key)
    ) {
      return null;
    }
    seen.add(key);
    style[key] = value;
  }

  return style;
}

export function orderedPatchableFlowchartNodeStyleEntries(
  style: PatchableFlowchartNodeStyle | undefined
): Array<[PatchableFlowchartNodeStyleKey, string]> {
  if (!style) return [];

  for (const key of Object.keys(style)) {
    if (!isPatchableFlowchartNodeStyleKey(key)) {
      throw new Error(`Unsupported patchable flowchart node style key: ${key}`);
    }
  }

  return PATCHABLE_FLOWCHART_NODE_STYLE_KEYS.flatMap((key) => {
    const value = style[key];
    if (value === undefined) return [];
    if (!isPatchableFlowchartNodeStyleValue(key, value)) {
      throw new Error(
        `Unsupported patchable flowchart node style value for ${key}: ${value}`
      );
    }
    return [[key, value] as [PatchableFlowchartNodeStyleKey, string]];
  });
}

export const PATCHABLE_FLOWCHART_PROMPT_RULES = `
- For an ordinary editable flowchart create or patch, use only this shared dialect: flowchart or graph; direction LR, RL, TD, or BT; stable semantic IDs beginning with a letter or underscore and containing only letters, digits, underscores, or hyphens.
- Supported node shapes are rectangle, rounded, diamond, ellipse or stadium, and circle. Supported directed edges are --> and -.->. Write edge labels only as A -->|label| B.
- Each directed source-target pair may appear only once. Its edge semantic ID is always source__target. To change endpoints, remove the old edge and add the new canonical edge; updateEdge changes only label or lineStyle.
- Node style directives may contain only fill, stroke, and stroke-width. Use hexadecimal or named colors and pixel widths such as 2px. Edge colors and edge style directives are not patchable.
- An updateNode changes.style object is a full replacement. When changing one style value, include every current allowed style key that must be retained.
- subgraph, classDef, class, :::, linkStyle, click, init directives, @{ shape: ... }, HTML, advanced arrows, and unsupported shapes are replace-only. Use an explicit targeted replace and explain the unsupported reason; never silently remove structure or style.
`.trim();
