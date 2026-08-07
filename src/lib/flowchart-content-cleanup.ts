import { groupLegacyMermaidElements } from './diagram/legacy-mermaid-groups';

/**
 * Contract: compact repeated Mermaid source metadata in one saved flowchart.
 *
 * Boundary: this function only transforms a content JSON string. It never
 * reads or writes a database and never changes element identity, geometry,
 * files, top-level metadata, or non-Mermaid custom data.
 *
 * State transition: duplicate originalMermaid fields -> one deterministic
 * carrier per managed source group or legacy generation cluster.
 *
 * Invariants: distinct diagram/source groups remain distinct; legacy groups
 * use the runtime resolver's one-second timestamp clustering rule; repeated
 * execution is a no-op; invalid/unrecognized content is returned untouched.
 * Callers must log before/after hashes and use optimistic locking for writes.
 * Rollback restores the exact pre-transform content captured in the backup.
 */

interface CleanupElement {
  id?: unknown;
  type?: unknown;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface CleanupDocument {
  elements: CleanupElement[];
  [key: string]: unknown;
}

export interface FlowchartContentCleanupResult {
  status: 'changed' | 'unchanged' | 'invalid';
  content: string;
  removedSourceCopies: number;
  carrierCount: number;
  beforeBytes: number;
  afterBytes: number;
  error?: string;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sourceFor(element: CleanupElement): string | null {
  const source = element.customData?.originalMermaid;
  return typeof source === 'string' && source.length > 0 ? source : null;
}

function carrierRank(element: CleanupElement, index: number): [number, string] {
  const entityType = element.customData?.entityType;
  const type = element.type;
  const looksLikeNode =
    entityType === 'node' ||
    (typeof type === 'string' && !['arrow', 'line', 'text'].includes(type));
  const id = typeof element.id === 'string' ? element.id : `~${index}`;
  return [looksLikeNode ? 0 : 1, id];
}

function chooseCarrier(elements: CleanupElement[], indexes: number[]): number {
  return [...indexes].sort((left, right) => {
    const [leftRank, leftId] = carrierRank(elements[left], left);
    const [rightRank, rightId] = carrierRank(elements[right], right);
    return leftRank - rightRank || leftId.localeCompare(rightId);
  })[0];
}

function removeDuplicateSources(
  document: CleanupDocument,
  groups: number[][]
): number {
  let removed = 0;
  for (const group of groups) {
    if (group.length < 2) continue;
    const carrier = chooseCarrier(document.elements, group);
    for (const index of group) {
      if (index === carrier) continue;
      const element = document.elements[index];
      const customData = element.customData;
      if (!customData || !('originalMermaid' in customData)) continue;
      const { originalMermaid: _removed, ...remainingCustomData } = customData;
      document.elements[index] = {
        ...element,
        customData: remainingCustomData,
      };
      removed += 1;
    }
  }
  return removed;
}

function managedGroups(elements: CleanupElement[]): number[][] {
  const groups = new Map<string, number[]>();
  elements.forEach((element, index) => {
    const diagramId = element.customData?.diagramId;
    const source = sourceFor(element);
    if (typeof diagramId !== 'string' || !diagramId || !source) return;
    const key = JSON.stringify([diagramId, source]);
    groups.set(key, [...(groups.get(key) || []), index]);
  });
  return [...groups.values()];
}

function legacyGroups(elements: CleanupElement[]): number[][] {
  const indexes = new Map(elements.map((element, index) => [element, index]));
  const eligible = elements.filter(
    (element): element is CleanupElement & { id: string } =>
      typeof element.id === 'string'
  );
  return groupLegacyMermaidElements(eligible).map((group) =>
    group.elements.map((element) => indexes.get(element) as number)
  );
}

export function compactFlowchartContent(
  content: string
): FlowchartContentCleanupResult {
  const beforeBytes = byteLength(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      status: 'invalid',
      content,
      removedSourceCopies: 0,
      carrierCount: 0,
      beforeBytes,
      afterBytes: beforeBytes,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.elements)) {
    return {
      status: 'invalid',
      content,
      removedSourceCopies: 0,
      carrierCount: 0,
      beforeBytes,
      afterBytes: beforeBytes,
      error: 'Flowchart content must contain an elements array',
    };
  }

  const document = parsed as CleanupDocument;
  if (!document.elements.every(isRecord)) {
    return {
      status: 'invalid',
      content,
      removedSourceCopies: 0,
      carrierCount: 0,
      beforeBytes,
      afterBytes: beforeBytes,
      error: 'Flowchart elements must be objects',
    };
  }

  const groups = [
    ...managedGroups(document.elements),
    ...legacyGroups(document.elements),
  ];
  const removedSourceCopies = removeDuplicateSources(document, groups);
  if (removedSourceCopies === 0) {
    return {
      status: 'unchanged',
      content,
      removedSourceCopies,
      carrierCount: groups.length,
      beforeBytes,
      afterBytes: beforeBytes,
    };
  }

  const nextContent = JSON.stringify(document);
  return {
    status: 'changed',
    content: nextContent,
    removedSourceCopies,
    carrierCount: groups.length,
    beforeBytes,
    afterBytes: byteLength(nextContent),
  };
}
