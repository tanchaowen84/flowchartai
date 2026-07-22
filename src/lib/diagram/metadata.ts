import {
  type FlowchartAiMetadata,
  diagramDocumentSchema,
  mermaidDiagramRecordSchema,
} from './contracts';
import {
  getMermaidDiagramType,
  isPatchableFlowchart,
  parseFlowchartMermaid,
} from './flowchart-parser';

interface MetadataSceneElement {
  id: string;
  customData?: {
    aiGenerated?: boolean;
    diagramId?: string;
    diagramType?: string;
    originalMermaid?: string;
    revision?: number;
    [key: string]: unknown;
  };
}

export function emptyFlowchartAiMetadata(): FlowchartAiMetadata {
  return { schemaVersion: 1, diagrams: {}, mermaidDiagrams: {} };
}

export function normalizeFlowchartAiMetadata(
  value: unknown
): FlowchartAiMetadata {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1
  ) {
    return emptyFlowchartAiMetadata();
  }

  const raw = value as {
    diagrams?: unknown;
    mermaidDiagrams?: unknown;
  };
  const next = emptyFlowchartAiMetadata();
  const rawMermaidDiagrams =
    raw.mermaidDiagrams &&
    typeof raw.mermaidDiagrams === 'object' &&
    !Array.isArray(raw.mermaidDiagrams)
      ? (raw.mermaidDiagrams as Record<string, unknown>)
      : {};

  for (const candidate of Object.values(rawMermaidDiagrams)) {
    const parsed = mermaidDiagramRecordSchema.safeParse(candidate);
    if (parsed.success) {
      next.mermaidDiagrams![parsed.data.diagramId] = parsed.data;
    }
  }

  const rawDiagrams =
    raw.diagrams &&
    typeof raw.diagrams === 'object' &&
    !Array.isArray(raw.diagrams)
      ? (raw.diagrams as Record<string, unknown>)
      : {};

  for (const candidate of Object.values(rawDiagrams)) {
    const parsed = diagramDocumentSchema.safeParse(candidate);
    if (parsed.success) {
      next.diagrams[parsed.data.diagramId] = parsed.data;
      delete next.mermaidDiagrams?.[parsed.data.diagramId];
      continue;
    }

    const fallback = mermaidDiagramRecordSchema.safeParse(candidate);
    if (fallback.success && !next.mermaidDiagrams?.[fallback.data.diagramId]) {
      next.mermaidDiagrams![fallback.data.diagramId] = fallback.data;
    }
  }

  return next;
}

export function parseFlowchartAiMetadata(content: string): FlowchartAiMetadata {
  try {
    const file = JSON.parse(content) as { flowchartAi?: unknown };
    return normalizeFlowchartAiMetadata(file.flowchartAi);
  } catch {
    return emptyFlowchartAiMetadata();
  }
}

export function deriveFlowchartAiMetadataFromElements(
  elements: readonly MetadataSceneElement[],
  currentMetadata: FlowchartAiMetadata
): FlowchartAiMetadata {
  const current = normalizeFlowchartAiMetadata(currentMetadata);
  const groups = new Map<string, MetadataSceneElement[]>();
  for (const element of elements) {
    const diagramId = element.customData?.diagramId;
    if (!element.customData?.aiGenerated || !diagramId) continue;
    groups.set(diagramId, [...(groups.get(diagramId) || []), element]);
  }

  const next = emptyFlowchartAiMetadata();
  for (const [diagramId, group] of groups) {
    const carrier = group
      .filter(
        (element) =>
          typeof element.customData?.originalMermaid === 'string' &&
          element.customData.originalMermaid.length > 0
      )
      .sort(
        (left, right) =>
          (right.customData?.revision || 0) - (left.customData?.revision || 0)
      )[0];
    const source = carrier?.customData?.originalMermaid;
    if (!source) {
      if (current.diagrams[diagramId]) {
        next.diagrams[diagramId] = current.diagrams[diagramId];
      } else if (current.mermaidDiagrams?.[diagramId]) {
        next.mermaidDiagrams![diagramId] = current.mermaidDiagrams[diagramId];
      }
      continue;
    }

    const revision = Number.isInteger(carrier.customData?.revision)
      ? Math.max(0, carrier.customData?.revision || 0)
      : 0;
    if (isPatchableFlowchart(source)) {
      next.diagrams[diagramId] = parseFlowchartMermaid(source, {
        diagramId,
        revision,
      });
      continue;
    }

    next.mermaidDiagrams![diagramId] = {
      diagramId,
      diagramType:
        carrier.customData?.diagramType ||
        getMermaidDiagramType(source) ||
        'unknown',
      revision,
      sourceMermaid: source,
    };
  }

  return next;
}
