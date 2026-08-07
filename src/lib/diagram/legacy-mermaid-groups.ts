export interface LegacyMermaidElement {
  id: string;
  customData?: {
    aiGenerated?: boolean;
    diagramId?: string;
    originalMermaid?: string;
    generatedAt?: number;
    [key: string]: unknown;
  };
}

export interface LegacyMermaidGroup<T extends LegacyMermaidElement> {
  elements: T[];
  source: string;
  generationKey?: number;
}

/**
 * The storage cleanup and runtime target resolver must share this exact legacy
 * grouping rule. Otherwise cleanup could remove a carrier the editor still
 * treats as a separate diagram.
 */
export function groupLegacyMermaidElements<T extends LegacyMermaidElement>(
  elements: T[]
): LegacyMermaidGroup<T>[] {
  const bySource = new Map<string, T[]>();
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

  const groups: LegacyMermaidGroup<T>[] = [];
  for (const [source, sourceElements] of bySource) {
    const withoutGeneration = sourceElements.filter(
      (element) => !Number.isFinite(element.customData?.generatedAt)
    );
    if (withoutGeneration.length > 0) {
      groups.push({ elements: withoutGeneration, source });
    }

    const timestamped = sourceElements
      .filter((element) => Number.isFinite(element.customData?.generatedAt))
      .sort(
        (left, right) =>
          (left.customData?.generatedAt || 0) -
          (right.customData?.generatedAt || 0)
      );
    let cluster: T[] = [];
    let clusterStart: number | undefined;
    let previousTimestamp: number | undefined;
    const flush = () => {
      if (cluster.length === 0 || clusterStart === undefined) return;
      groups.push({
        elements: cluster,
        source,
        generationKey: clusterStart,
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
