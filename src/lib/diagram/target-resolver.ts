import type {
  DiagramDocument,
  FlowchartAiMetadata,
  MermaidDiagramRecord,
} from './contracts';
import { isPatchableFlowchart } from './flowchart-parser';

interface TargetElement {
  id: string;
  customData?: {
    aiGenerated?: boolean;
    diagramId?: string;
    originalMermaid?: string;
    generatedAt?: number;
    [key: string]: unknown;
  };
}

interface ResolveDiagramTargetInput {
  elements: TargetElement[];
  selectedElementIds: Record<string, boolean>;
  metadata: FlowchartAiMetadata;
}

export type DiagramTargetResolution =
  | { status: 'none' }
  | { status: 'ambiguous'; diagramIds: string[] }
  | {
      status: 'resolved';
      diagramId: string;
      document?: DiagramDocument;
      mermaidDiagram?: MermaidDiagramRecord;
      patchable: boolean;
      legacy?: boolean;
      sourceMermaid?: string;
      elementIds?: string[];
    };

interface LegacyDiagramGroup {
  diagramId: string;
  elements: TargetElement[];
  source: string;
}

function legacyDiagramId(source: string, generationKey?: number): string {
  const identity =
    generationKey === undefined ? source : `${source}\n${generationKey}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `legacy-${(hash >>> 0).toString(36)}`;
}

function resolveManaged(
  diagramId: string,
  metadata: FlowchartAiMetadata
): DiagramTargetResolution {
  const document = metadata.diagrams[diagramId];
  const mermaidDiagram = metadata.mermaidDiagrams?.[diagramId];
  const source = document?.sourceMermaid || mermaidDiagram?.sourceMermaid || '';
  return {
    status: 'resolved',
    diagramId,
    document,
    mermaidDiagram,
    patchable: Boolean(document && isPatchableFlowchart(source)),
  };
}

function groupLegacyElements(elements: TargetElement[]): LegacyDiagramGroup[] {
  const bySource = new Map<string, TargetElement[]>();
  for (const element of elements) {
    const source = element.customData?.originalMermaid;
    if (
      !element.customData?.aiGenerated ||
      element.customData?.diagramId ||
      !source
    ) {
      continue;
    }
    bySource.set(source, [...(bySource.get(source) || []), element]);
  }

  const groups: LegacyDiagramGroup[] = [];
  for (const [source, sourceElements] of bySource) {
    const withoutGeneration = sourceElements.filter(
      (element) => !Number.isFinite(element.customData?.generatedAt)
    );
    if (withoutGeneration.length > 0) {
      groups.push({
        diagramId: legacyDiagramId(source),
        elements: withoutGeneration,
        source,
      });
    }

    const timestamped = sourceElements
      .filter((element) => Number.isFinite(element.customData?.generatedAt))
      .sort(
        (left, right) =>
          (left.customData?.generatedAt || 0) -
          (right.customData?.generatedAt || 0)
      );
    let cluster: TargetElement[] = [];
    let clusterStart: number | undefined;
    let previousTimestamp: number | undefined;
    const flush = () => {
      if (cluster.length === 0 || clusterStart === undefined) return;
      groups.push({
        diagramId: legacyDiagramId(source, clusterStart),
        elements: cluster,
        source,
      });
      cluster = [];
      clusterStart = undefined;
      previousTimestamp = undefined;
    };
    for (const element of timestamped) {
      const timestamp = element.customData?.generatedAt as number;
      if (
        previousTimestamp !== undefined &&
        timestamp - previousTimestamp > 1_000
      ) {
        flush();
      }
      clusterStart ??= timestamp;
      cluster.push(element);
      previousTimestamp = timestamp;
    }
    flush();
  }
  return groups;
}

function resolveLegacy(group: LegacyDiagramGroup): DiagramTargetResolution {
  return {
    status: 'resolved',
    diagramId: group.diagramId,
    patchable: false,
    legacy: true,
    sourceMermaid: group.source,
    elementIds: group.elements.map((element) => element.id),
  };
}

export function resolveDiagramTarget({
  elements,
  selectedElementIds,
  metadata,
}: ResolveDiagramTargetInput): DiagramTargetResolution {
  const selected = elements.filter((element) => selectedElementIds[element.id]);
  const selectedManagedIds = [
    ...new Set(
      selected
        .map((element) => element.customData?.diagramId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (selectedManagedIds.length === 1) {
    return resolveManaged(selectedManagedIds[0], metadata);
  }
  if (selectedManagedIds.length > 1) {
    return { status: 'ambiguous', diagramIds: selectedManagedIds.sort() };
  }

  const legacy = groupLegacyElements(elements);
  const selectedLegacy = legacy.filter((group) =>
    group.elements.some((element) => selectedElementIds[element.id])
  );
  if (selectedLegacy.length === 1) {
    return resolveLegacy(selectedLegacy[0]);
  }
  if (selectedLegacy.length > 1) {
    return {
      status: 'ambiguous',
      diagramIds: selectedLegacy.map((group) => group.diagramId).sort(),
    };
  }

  const managedIds = [
    ...new Set(
      elements
        .map((element) => element.customData?.diagramId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const candidateIds = [
    ...managedIds,
    ...legacy.map((group) => group.diagramId),
  ];

  if (candidateIds.length === 0) return { status: 'none' };
  if (candidateIds.length > 1) {
    return { status: 'ambiguous', diagramIds: candidateIds.sort() };
  }
  if (managedIds.length === 1) {
    return resolveManaged(managedIds[0], metadata);
  }

  return resolveLegacy(legacy[0]);
}
