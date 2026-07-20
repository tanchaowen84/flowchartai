import {
  type CanvasCommand,
  canvasCommandSchema,
  diagramPatchSchema,
} from '../diagram/contracts';
import { getMermaidDiagramType } from '../diagram/flowchart-parser';

export interface CanvasToolInput {
  action: 'create' | 'patch' | 'replace';
  targetDiagramId?: string;
  mermaidCode?: string;
  patch?: unknown;
  description: string;
}

function defaultDiagramId(): string {
  return globalThis.crypto?.randomUUID?.() || `diagram-${Date.now()}`;
}

export function createCanvasCommand(
  input: CanvasToolInput,
  createDiagramId: () => string = defaultDiagramId
): CanvasCommand {
  if (input.action === 'patch') {
    const patch = diagramPatchSchema.parse(input.patch);
    return canvasCommandSchema.parse({
      kind: 'patch-diagram',
      patch,
      description: input.description,
    });
  }

  const mermaidCode = input.mermaidCode?.trim();
  if (!mermaidCode) {
    throw new Error('Create and replace commands require Mermaid code');
  }
  if (input.action === 'replace' && !input.targetDiagramId) {
    throw new Error('Replace commands require an explicit target diagram id');
  }

  const mermaidType = getMermaidDiagramType(mermaidCode) || 'unknown';
  const normalizedType =
    mermaidType.toLowerCase() === 'flowchart' ||
    mermaidType.toLowerCase() === 'graph'
      ? 'flowchart'
      : mermaidType;
  const diagramId =
    input.action === 'replace'
      ? (input.targetDiagramId as string)
      : createDiagramId();

  return canvasCommandSchema.parse({
    kind: 'render-mermaid',
    operation: input.action,
    diagramId,
    targetDiagramId:
      input.action === 'replace' ? input.targetDiagramId : undefined,
    diagramType: normalizedType,
    mermaidCode,
    description: input.description,
  });
}
