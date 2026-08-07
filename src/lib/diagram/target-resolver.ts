import type {
  DiagramDocument,
  FlowchartAiMetadata,
  MermaidDiagramRecord,
} from './contracts';
import { isDiagramSceneSemanticallyAligned } from './diagram-scene-alignment';
import {
  isPatchableFlowchart,
  parseFlowchartMermaid,
} from './flowchart-parser';
import { groupLegacyMermaidElements } from './legacy-mermaid-groups';

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
      patchBlockReason?:
        | 'unsupported-flowchart-syntax'
        | 'scene-semantic-id-mismatch'
        | 'missing-diagram-document'
        | 'legacy-scene-requires-targeted-replace';
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
  metadata: FlowchartAiMetadata,
  elements: TargetElement[]
): DiagramTargetResolution {
  const storedDocument = metadata.diagrams[diagramId];
  const mermaidDiagram = metadata.mermaidDiagrams?.[diagramId];
  const source =
    storedDocument?.sourceMermaid || mermaidDiagram?.sourceMermaid || '';
  const sourceIsPatchable = isPatchableFlowchart(source);
  const derivedDocument =
    !storedDocument && mermaidDiagram && sourceIsPatchable
      ? parseFlowchartMermaid(source, {
          diagramId,
          revision: mermaidDiagram.revision,
        })
      : undefined;
  const candidateDocument = storedDocument || derivedDocument;
  const sceneIsAligned = Boolean(
    candidateDocument &&
      isDiagramSceneSemanticallyAligned(candidateDocument, elements)
  );
  const document =
    storedDocument || (sceneIsAligned ? derivedDocument : undefined);
  const patchable = Boolean(document && sourceIsPatchable && sceneIsAligned);

  return {
    status: 'resolved',
    diagramId,
    document,
    mermaidDiagram,
    patchable,
    patchBlockReason: patchable
      ? undefined
      : !sourceIsPatchable
        ? 'unsupported-flowchart-syntax'
        : candidateDocument && !sceneIsAligned
          ? 'scene-semantic-id-mismatch'
          : 'missing-diagram-document',
  };
}

function groupLegacyElements(elements: TargetElement[]): LegacyDiagramGroup[] {
  return groupLegacyMermaidElements(elements).map((group) => ({
    diagramId: legacyDiagramId(group.source, group.generationKey),
    elements: group.elements,
    source: group.source,
  }));
}

function resolveLegacy(group: LegacyDiagramGroup): DiagramTargetResolution {
  return {
    status: 'resolved',
    diagramId: group.diagramId,
    patchable: false,
    legacy: true,
    sourceMermaid: group.source,
    elementIds: group.elements.map((element) => element.id),
    patchBlockReason: 'legacy-scene-requires-targeted-replace',
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
    return resolveManaged(selectedManagedIds[0], metadata, elements);
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
    return resolveManaged(managedIds[0], metadata, elements);
  }

  return resolveLegacy(legacy[0]);
}
