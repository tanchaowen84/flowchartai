import {
  type ReconcilerElement,
  reconcileDiagramElements,
} from './canvas-reconciler';
import {
  type CanvasCommand,
  type DiagramDocument,
  type FlowchartAiMetadata,
  type MermaidDiagramRecord,
  canvasCommandSchema,
  flowchartAiMetadataSchema,
} from './contracts';
import { materializeDefaultCreateTheme } from './default-theme';
import { renderDiagramDocument } from './diagram-renderer';
import { isDiagramSceneSemanticallyAligned } from './diagram-scene-alignment';
import {
  isPatchableFlowchart,
  parseFlowchartMermaid,
} from './flowchart-parser';
import { applyDiagramPatch } from './patch-engine';
import type { DiagramTargetResolution } from './target-resolver';

interface RenderedMermaid<T extends ReconcilerElement> {
  elements: T[];
  files?: Record<string, unknown>;
}

interface PrepareCanvasCommandInput<T extends ReconcilerElement> {
  command: CanvasCommand;
  currentElements: T[];
  metadata: FlowchartAiMetadata;
  targetResolution: DiagramTargetResolution;
  renderFlowchart?: (document: DiagramDocument) => Promise<T[]>;
  renderMermaid?: (source: string) => Promise<RenderedMermaid<T>>;
}

export interface PreparedCanvasCommand<T extends ReconcilerElement> {
  nextElements: T[];
  focusElements: T[];
  files: Record<string, unknown>;
  nextMetadata: FlowchartAiMetadata;
  operation: 'create' | 'replace' | 'patch';
  diagramId: string;
  sourceMermaid: string;
}

function copyMetadata(metadata: FlowchartAiMetadata): FlowchartAiMetadata {
  const parsed = flowchartAiMetadataSchema.parse(metadata);
  return {
    schemaVersion: 1,
    diagrams: { ...parsed.diagrams },
    mermaidDiagrams: { ...(parsed.mermaidDiagrams || {}) },
  };
}

function requireTarget(
  resolution: DiagramTargetResolution,
  diagramId: string
): Extract<DiagramTargetResolution, { status: 'resolved' }> {
  if (resolution.status === 'ambiguous') {
    throw new Error('Diagram target is ambiguous; select one diagram first');
  }
  if (resolution.status !== 'resolved') {
    throw new Error('No diagram is available for this edit');
  }
  if (resolution.diagramId !== diagramId) {
    throw new Error(
      `Canvas command targets ${diagramId}, but the resolved target is ${resolution.diagramId}`
    );
  }
  return resolution;
}

function entityTypeForElement(element: ReconcilerElement): string {
  if (element.type === 'arrow' || element.type === 'line') return 'edge';
  if (element.type === 'text') return 'label';
  return 'node';
}

function annotateMermaidElements<T extends ReconcilerElement>(
  elements: T[],
  record: MermaidDiagramRecord
): T[] {
  const generatedAt = Date.now();
  return elements.map((element, index) => ({
    ...element,
    customData: {
      ...element.customData,
      aiGenerated: true,
      diagramId: record.diagramId,
      semanticId: `full:${element.type || 'element'}:${index}`,
      entityType: entityTypeForElement(element),
      diagramType: record.diagramType,
      revision: record.revision,
      generatedAt,
    },
  }));
}

function attachMetadataCarrier<T extends ReconcilerElement>(
  elements: T[],
  diagramId: string,
  diagramType: string,
  revision: number,
  sourceMermaid: string
): T[] {
  const target = elements
    .filter((element) => element.customData?.diagramId === diagramId)
    .sort((left, right) => {
      const leftRank = left.customData?.entityType === 'node' ? 0 : 1;
      const rightRank = right.customData?.entityType === 'node' ? 0 : 1;
      return leftRank - rightRank || left.id.localeCompare(right.id);
    });
  const carrierId = target[0]?.id;
  if (!carrierId) return elements;

  return elements.map((element) => {
    if (element.customData?.diagramId !== diagramId) return element;
    const { originalMermaid: _duplicateSource, ...customData } =
      element.customData || {};

    return element.id === carrierId
      ? ({
          ...element,
          version: Math.max(element.version || 1, 1) + 1,
          versionNonce:
            element.versionNonce === 2_147_483_646
              ? 1
              : (element.versionNonce || 0) + 1,
          updated: Math.max(Date.now(), (element.updated || 0) + 1),
          customData: {
            ...customData,
            aiGenerated: true,
            diagramId,
            diagramType,
            originalMermaid: sourceMermaid,
            revision,
          },
        } as T)
      : 'originalMermaid' in (element.customData || {})
        ? ({ ...element, customData } as T)
        : element;
  });
}

function boundsOrigin(
  elements: ReconcilerElement[]
): { x: number; y: number } | null {
  if (elements.length === 0) return null;
  return {
    x: Math.min(...elements.map((element) => element.x || 0)),
    y: Math.min(...elements.map((element) => element.y || 0)),
  };
}

function alignToCurrentDiagram<T extends ReconcilerElement>(
  rendered: T[],
  current: T[],
  diagramId: string,
  legacyElementIds: string[] = []
): T[] {
  const currentTarget = current.filter(
    (element) =>
      element.customData?.diagramId === diagramId ||
      legacyElementIds.includes(element.id)
  );
  if (currentTarget.length === 0 || rendered.length === 0) return rendered;

  const currentBySemanticKey = new Map(
    currentTarget
      .filter((element) => element.customData?.semanticId)
      .map((element) => [
        `${element.customData?.entityType}:${element.customData?.semanticId}`,
        element,
      ])
  );
  const anchor = rendered.find((element) =>
    currentBySemanticKey.has(
      `${element.customData?.entityType}:${element.customData?.semanticId}`
    )
  );
  const currentAnchor = anchor
    ? currentBySemanticKey.get(
        `${anchor.customData?.entityType}:${anchor.customData?.semanticId}`
      )
    : undefined;
  const from =
    anchor && currentAnchor
      ? { x: anchor.x || 0, y: anchor.y || 0 }
      : boundsOrigin(rendered);
  const to =
    anchor && currentAnchor
      ? { x: currentAnchor.x || 0, y: currentAnchor.y || 0 }
      : boundsOrigin(currentTarget);
  if (!from || !to) return rendered;

  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  return rendered.map((element) => ({
    ...element,
    x: (element.x || 0) + deltaX,
    y: (element.y || 0) + deltaY,
  }));
}

function changedSemanticIdsForPatch(
  command: Extract<CanvasCommand, { kind: 'patch-diagram' }>
): Set<string> {
  const changed = new Set<string>();
  for (const operation of command.patch.operations) {
    if ('semanticId' in operation) changed.add(operation.semanticId);
    if ('node' in operation) changed.add(operation.node.semanticId);
    if ('edge' in operation) changed.add(operation.edge.semanticId);
  }

  return changed;
}

function patchChangesTopology(
  command: Extract<CanvasCommand, { kind: 'patch-diagram' }>
): boolean {
  return command.patch.operations.some((operation) =>
    ['addNode', 'removeNode', 'addEdge', 'removeEdge'].includes(operation.type)
  );
}

async function defaultRenderMermaid<T extends ReconcilerElement>(
  source: string
): Promise<RenderedMermaid<T>> {
  const { convertMermaidToExcalidraw } = await import('../mermaid-converter');
  const result = await convertMermaidToExcalidraw(source);
  if (!result.success) {
    const error = new Error(result.error || 'Failed to render Mermaid');
    (error as Error & { details?: string }).details = result.details;
    throw error;
  }
  return {
    elements: result.elements as T[],
    files: result.files as Record<string, unknown>,
  };
}

export async function prepareCanvasCommand<T extends ReconcilerElement>({
  command: commandInput,
  currentElements,
  metadata: metadataInput,
  targetResolution,
  renderFlowchart = renderDiagramDocument as (
    document: DiagramDocument
  ) => Promise<T[]>,
  renderMermaid = defaultRenderMermaid,
}: PrepareCanvasCommandInput<T>): Promise<PreparedCanvasCommand<T>> {
  const command = canvasCommandSchema.parse(commandInput);
  const nextMetadata = copyMetadata(metadataInput);

  if (targetResolution.status === 'ambiguous') {
    throw new Error('Diagram target is ambiguous; select one diagram first');
  }

  if (command.kind === 'patch-diagram') {
    const target = requireTarget(targetResolution, command.patch.diagramId);
    if (!target.document || !target.patchable) {
      throw new Error('The selected diagram cannot be locally patched in V1');
    }
    if (!isDiagramSceneSemanticallyAligned(target.document, currentElements)) {
      throw new Error(
        'The selected diagram scene does not match its semantic document; use an explicit targeted replacement before local patching.'
      );
    }

    const nextDocument = applyDiagramPatch(target.document, command.patch);
    const changesTopology = patchChangesTopology(command);
    const rendered = alignToCurrentDiagram(
      await renderFlowchart(nextDocument),
      currentElements,
      nextDocument.diagramId
    );
    const reconciledElements = reconcileDiagramElements({
      currentElements,
      nextElements: rendered,
      diagramId: nextDocument.diagramId,
      changedSemanticIds: changedSemanticIdsForPatch(command),
      mode: changesTopology ? 'replace' : 'patch',
    });
    const nextElements = attachMetadataCarrier(
      reconciledElements,
      nextDocument.diagramId,
      nextDocument.diagramType,
      nextDocument.revision,
      nextDocument.sourceMermaid
    );

    nextMetadata.diagrams[nextDocument.diagramId] = nextDocument;
    delete nextMetadata.mermaidDiagrams?.[nextDocument.diagramId];
    return {
      nextElements,
      focusElements: nextElements.filter(
        (element) => element.customData?.diagramId === nextDocument.diagramId
      ),
      files: {},
      nextMetadata,
      operation: 'patch',
      diagramId: nextDocument.diagramId,
      sourceMermaid: nextDocument.sourceMermaid,
    };
  }

  const diagramId = command.diagramId;
  if (command.operation === 'create' && targetResolution.status !== 'none') {
    throw new Error('A diagram target already exists; create is not valid');
  }
  if (
    command.operation === 'replace' &&
    command.targetDiagramId !== diagramId
  ) {
    throw new Error(
      'Replace command diagram id must match its explicit target'
    );
  }
  const target =
    command.operation === 'replace'
      ? requireTarget(targetResolution, command.targetDiagramId || diagramId)
      : null;
  const previousRevision =
    target?.document?.revision ?? target?.mermaidDiagram?.revision ?? -1;
  const revision = previousRevision + 1;
  const legacyIds = target?.legacy ? target.elementIds || [] : [];
  const currentWithoutLegacy = currentElements.filter(
    (element) => !legacyIds.includes(element.id)
  );

  let rendered: T[];
  let files: Record<string, unknown> = {};
  let effectiveSourceMermaid = command.mermaidCode;
  if (isPatchableFlowchart(command.mermaidCode)) {
    const parsedDocument = parseFlowchartMermaid(command.mermaidCode, {
      diagramId,
      revision,
    });
    const document =
      command.operation === 'create'
        ? materializeDefaultCreateTheme(parsedDocument)
        : parsedDocument;
    effectiveSourceMermaid = document.sourceMermaid;
    rendered = await renderFlowchart(document);
    nextMetadata.diagrams[diagramId] = document;
    delete nextMetadata.mermaidDiagrams?.[diagramId];
  } else {
    const record: MermaidDiagramRecord = {
      diagramId,
      diagramType: command.diagramType,
      revision,
      sourceMermaid: command.mermaidCode,
    };
    const converted = await renderMermaid(command.mermaidCode);
    rendered = annotateMermaidElements(converted.elements, record);
    files = converted.files || {};
    delete nextMetadata.diagrams[diagramId];
    nextMetadata.mermaidDiagrams = {
      ...(nextMetadata.mermaidDiagrams || {}),
      [diagramId]: record,
    };
  }

  const aligned =
    command.operation === 'replace'
      ? alignToCurrentDiagram(rendered, currentElements, diagramId, legacyIds)
      : rendered;
  const reconciledElements = reconcileDiagramElements({
    currentElements: currentWithoutLegacy,
    nextElements: aligned,
    diagramId,
    changedSemanticIds: new Set(),
    mode: 'replace',
  });
  const nextElements = attachMetadataCarrier(
    reconciledElements,
    diagramId,
    command.diagramType,
    revision,
    effectiveSourceMermaid
  );

  return {
    nextElements,
    focusElements: nextElements.filter(
      (element) => element.customData?.diagramId === diagramId
    ),
    files,
    nextMetadata,
    operation: command.operation,
    diagramId,
    sourceMermaid: effectiveSourceMermaid,
  };
}
