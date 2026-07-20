import {
  type FlowchartAiMetadata,
  flowchartAiMetadataSchema,
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
  const parsed = flowchartAiMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyFlowchartAiMetadata();
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
