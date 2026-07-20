export interface ReconcilerElement {
  id: string;
  x?: number;
  y?: number;
  version?: number;
  versionNonce?: number;
  updated?: number;
  customData?: {
    diagramId?: string;
    semanticId?: string;
    entityType?: string;
    [key: string]: unknown;
  };
  [key: string]: any;
}

interface ReconcileDiagramElementsInput<T extends ReconcilerElement> {
  currentElements: T[];
  nextElements: T[];
  diagramId: string;
  changedSemanticIds: Set<string>;
  mode: 'patch' | 'replace';
}

function belongsToDiagram(
  element: ReconcilerElement,
  diagramId: string
): boolean {
  return element.customData?.diagramId === diagramId;
}

function semanticKey(element: ReconcilerElement): string | null {
  const semanticId = element.customData?.semanticId;
  if (!semanticId) return null;
  return `${element.customData?.entityType || 'element'}:${semanticId}`;
}

function remapElementReferences<T extends ReconcilerElement>(
  element: T,
  idMap: Map<string, string>
): T {
  const remapId = (id: string | null | undefined) =>
    id ? idMap.get(id) || id : id;
  const next: ReconcilerElement = { ...element };

  if (next.containerId) next.containerId = remapId(next.containerId);
  if (next.frameId) next.frameId = remapId(next.frameId);
  if (next.startBinding?.elementId) {
    next.startBinding = {
      ...next.startBinding,
      elementId: remapId(next.startBinding.elementId),
    };
  }
  if (next.endBinding?.elementId) {
    next.endBinding = {
      ...next.endBinding,
      elementId: remapId(next.endBinding.elementId),
    };
  }
  if (Array.isArray(next.boundElements)) {
    next.boundElements = next.boundElements.map(
      (binding: { id: string; type: string }) => ({
        ...binding,
        id: remapId(binding.id),
      })
    );
  }

  return next as T;
}

function mergeChangedElement<T extends ReconcilerElement>(
  current: T,
  next: T
): T {
  return {
    ...next,
    id: current.id,
    x: current.x,
    y: current.y,
    version: Math.max(current.version || 1, next.version || 1) + 1,
    versionNonce: Math.floor(Math.random() * 2_147_483_647),
    updated: Date.now(),
  };
}

export function reconcileDiagramElements<T extends ReconcilerElement>({
  currentElements,
  nextElements,
  diagramId,
  changedSemanticIds,
  mode,
}: ReconcileDiagramElementsInput<T>): T[] {
  const nextTarget = nextElements.filter((element) =>
    belongsToDiagram(element, diagramId)
  );

  if (mode === 'replace') {
    return [
      ...currentElements.filter(
        (element) => !belongsToDiagram(element, diagramId)
      ),
      ...nextTarget,
    ];
  }

  const currentByKey = new Map<string, T>();
  for (const element of currentElements) {
    if (!belongsToDiagram(element, diagramId)) continue;
    const key = semanticKey(element);
    if (key) currentByKey.set(key, element);
  }

  const nextByKey = new Map<string, T>();
  for (const element of nextTarget) {
    const key = semanticKey(element);
    if (key) nextByKey.set(key, element);
  }

  const idMap = new Map<string, string>();
  for (const [key, next] of nextByKey) {
    const current = currentByKey.get(key);
    if (current) idMap.set(next.id, current.id);
  }

  const remappedNextByKey = new Map<string, T>();
  for (const [key, element] of nextByKey) {
    remappedNextByKey.set(key, remapElementReferences(element, idMap));
  }

  const seenKeys = new Set<string>();
  const result: T[] = [];

  for (const current of currentElements) {
    if (!belongsToDiagram(current, diagramId)) {
      result.push(current);
      continue;
    }

    const key = semanticKey(current);
    const semanticId = current.customData?.semanticId;
    if (!key || !semanticId) {
      result.push(current);
      continue;
    }

    seenKeys.add(key);
    if (!changedSemanticIds.has(semanticId)) {
      result.push(current);
      continue;
    }

    const next = remappedNextByKey.get(key);
    if (next) result.push(mergeChangedElement(current, next));
  }

  for (const [key, next] of remappedNextByKey) {
    if (!seenKeys.has(key)) result.push(next);
  }

  return result;
}
