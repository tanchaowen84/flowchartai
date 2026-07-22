import {
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  type DiagramPatch,
  diagramDocumentSchema,
  diagramPatchSchema,
} from './contracts';
import {
  isPatchableFlowchart,
  parseFlowchartMermaid,
} from './flowchart-parser';
import { serializeDiagramToMermaid } from './serializer';

function findBySemanticId<T extends { semanticId: string }>(
  values: T[],
  semanticId: string,
  entityName: string
): T {
  const value = values.find((candidate) => candidate.semanticId === semanticId);
  if (!value) {
    throw new Error(`${entityName} ${semanticId} does not exist`);
  }
  return value;
}

function addUnique<T extends { semanticId: string }>(
  values: T[],
  value: T,
  entityName: string
): void {
  if (values.some((candidate) => candidate.semanticId === value.semanticId)) {
    throw new Error(`${entityName} ${value.semanticId} already exists`);
  }
  values.push(value);
}

export function applyDiagramPatch(
  documentInput: DiagramDocument,
  patchInput: DiagramPatch
): DiagramDocument {
  if (patchInput.diagramId !== documentInput.diagramId) {
    throw new Error(
      `Patch targets diagram ${patchInput.diagramId}, not ${documentInput.diagramId}`
    );
  }
  if (patchInput.baseRevision !== documentInput.revision) {
    throw new Error(
      `Revision conflict: expected ${documentInput.revision}, received ${patchInput.baseRevision}`
    );
  }

  const current = diagramDocumentSchema.parse(documentInput);
  if (current.groups.length > 0) {
    throw new Error(
      'Local patching for subgraph/group diagrams is not supported in V1; replace the explicit target diagram instead.'
    );
  }
  const patch = diagramPatchSchema.parse(patchInput);
  const draft: DiagramDocument = {
    ...current,
    nodes: current.nodes.map((node) => ({ ...node })),
    edges: current.edges.map((edge) => ({ ...edge })),
    groups: current.groups.map((group) => ({
      ...group,
      nodeSemanticIds: [...group.nodeSemanticIds],
    })),
  };

  for (const operation of patch.operations) {
    switch (operation.type) {
      case 'addNode':
        addUnique(draft.nodes, { ...operation.node }, 'Node');
        break;
      case 'updateNode': {
        const node = findBySemanticId(
          draft.nodes,
          operation.semanticId,
          'Node'
        );
        Object.assign(node, operation.changes as Partial<DiagramNode>);
        break;
      }
      case 'removeNode':
        findBySemanticId(draft.nodes, operation.semanticId, 'Node');
        draft.nodes = draft.nodes.filter(
          (node) => node.semanticId !== operation.semanticId
        );
        draft.groups = draft.groups.map((group) => ({
          ...group,
          nodeSemanticIds: group.nodeSemanticIds.filter(
            (nodeId) => nodeId !== operation.semanticId
          ),
        }));
        break;
      case 'addEdge':
        addUnique(draft.edges, { ...operation.edge }, 'Edge');
        break;
      case 'updateEdge': {
        const edge = findBySemanticId(
          draft.edges,
          operation.semanticId,
          'Edge'
        );
        Object.assign(edge, operation.changes as Partial<DiagramEdge>);
        break;
      }
      case 'removeEdge':
        findBySemanticId(draft.edges, operation.semanticId, 'Edge');
        draft.edges = draft.edges.filter(
          (edge) => edge.semanticId !== operation.semanticId
        );
        break;
    }
  }

  const candidate = {
    ...draft,
    revision: current.revision + 1,
    sourceMermaid: '',
  };
  candidate.sourceMermaid = serializeDiagramToMermaid(candidate);
  if (!isPatchableFlowchart(candidate.sourceMermaid)) {
    throw new Error(
      'Patch validation failed: the resulting Mermaid is outside the shared patchable flowchart capability profile'
    );
  }

  const result = diagramDocumentSchema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0]?.message || 'Invalid diagram patch';
    throw new Error(`Patch validation failed: ${issue}`);
  }

  return parseFlowchartMermaid(result.data.sourceMermaid, {
    diagramId: result.data.diagramId,
    revision: result.data.revision,
  });
}
