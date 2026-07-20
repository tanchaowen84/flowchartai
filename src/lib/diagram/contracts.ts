import { z } from 'zod';

export const diagramNodeShapeSchema = z.enum([
  'rectangle',
  'rounded',
  'diamond',
  'ellipse',
  'stadium',
  'subroutine',
  'cylinder',
  'circle',
  'hexagon',
]);

const semanticIdSchema = z.string().trim().min(1);
const styleSchema = z.record(z.string()).optional();

export const diagramNodeSchema = z.object({
  semanticId: semanticIdSchema,
  label: z.string(),
  shape: diagramNodeShapeSchema.default('rectangle'),
  style: styleSchema,
});

export const diagramEdgeSchema = z.object({
  semanticId: semanticIdSchema,
  sourceSemanticId: semanticIdSchema,
  targetSemanticId: semanticIdSchema,
  label: z.string().optional(),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid').optional(),
  style: styleSchema,
});

export const diagramGroupSchema = z.object({
  semanticId: semanticIdSchema,
  label: z.string().optional(),
  nodeSemanticIds: z.array(semanticIdSchema).default([]),
});

export const diagramDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    diagramId: z.string().trim().min(1),
    diagramType: z.literal('flowchart'),
    mermaidKeyword: z.enum(['flowchart', 'graph']),
    direction: z.enum(['LR', 'RL', 'TD', 'BT']),
    revision: z.number().int().nonnegative(),
    sourceMermaid: z.string(),
    nodes: z.array(diagramNodeSchema),
    edges: z.array(diagramEdgeSchema),
    groups: z.array(diagramGroupSchema).default([]),
  })
  .superRefine((document, context) => {
    const nodeIds = new Set<string>();
    for (const node of document.nodes) {
      if (nodeIds.has(node.semanticId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node semantic id: ${node.semanticId}`,
          path: ['nodes'],
        });
      }
      nodeIds.add(node.semanticId);
    }

    const edgeIds = new Set<string>();
    for (const edge of document.edges) {
      if (edgeIds.has(edge.semanticId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate edge semantic id: ${edge.semanticId}`,
          path: ['edges'],
        });
      }
      edgeIds.add(edge.semanticId);

      if (!nodeIds.has(edge.sourceSemanticId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge ${edge.semanticId} references missing source node ${edge.sourceSemanticId}`,
          path: ['edges'],
        });
      }
      if (!nodeIds.has(edge.targetSemanticId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge ${edge.semanticId} references missing target node ${edge.targetSemanticId}`,
          path: ['edges'],
        });
      }
    }

    const groupIds = new Set<string>();
    for (const group of document.groups) {
      if (groupIds.has(group.semanticId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate group semantic id: ${group.semanticId}`,
          path: ['groups'],
        });
      }
      groupIds.add(group.semanticId);

      for (const nodeId of group.nodeSemanticIds) {
        if (!nodeIds.has(nodeId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Group ${group.semanticId} references missing node ${nodeId}`,
            path: ['groups'],
          });
        }
      }
    }
  });

const nodeChangesSchema = diagramNodeSchema
  .omit({ semanticId: true })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Node update must include at least one change',
  });

const edgeChangesSchema = diagramEdgeSchema
  .omit({ semanticId: true })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Edge update must include at least one change',
  });

export const diagramPatchOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addNode'), node: diagramNodeSchema }),
  z.object({
    type: z.literal('updateNode'),
    semanticId: semanticIdSchema,
    changes: nodeChangesSchema,
  }),
  z.object({ type: z.literal('removeNode'), semanticId: semanticIdSchema }),
  z.object({ type: z.literal('addEdge'), edge: diagramEdgeSchema }),
  z.object({
    type: z.literal('updateEdge'),
    semanticId: semanticIdSchema,
    changes: edgeChangesSchema,
  }),
  z.object({ type: z.literal('removeEdge'), semanticId: semanticIdSchema }),
]);

export const diagramPatchSchema = z.object({
  patchId: z.string().trim().min(1),
  diagramId: z.string().trim().min(1),
  baseRevision: z.number().int().nonnegative(),
  operations: z.array(diagramPatchOperationSchema).min(1),
});

export const renderMermaidCommandSchema = z.object({
  kind: z.literal('render-mermaid'),
  operation: z.enum(['create', 'replace']),
  diagramId: z.string().trim().min(1),
  targetDiagramId: z.string().trim().min(1).optional(),
  diagramType: z.string().trim().min(1),
  mermaidCode: z.string().trim().min(1),
  description: z.string().default('Generated diagram'),
});

export const patchDiagramCommandSchema = z.object({
  kind: z.literal('patch-diagram'),
  patch: diagramPatchSchema,
  description: z.string().default('Updated flowchart'),
});

export const canvasCommandSchema = z.discriminatedUnion('kind', [
  renderMermaidCommandSchema,
  patchDiagramCommandSchema,
]);

export type DiagramNode = z.infer<typeof diagramNodeSchema>;
export type DiagramEdge = z.infer<typeof diagramEdgeSchema>;
export type DiagramGroup = z.infer<typeof diagramGroupSchema>;
export type DiagramDocument = z.infer<typeof diagramDocumentSchema>;
export type DiagramPatchOperation = z.infer<typeof diagramPatchOperationSchema>;
export type DiagramPatch = z.infer<typeof diagramPatchSchema>;
export type RenderMermaidCommand = z.infer<typeof renderMermaidCommandSchema>;
export type PatchDiagramCommand = z.infer<typeof patchDiagramCommandSchema>;
export type CanvasCommand = z.infer<typeof canvasCommandSchema>;

export const mermaidDiagramRecordSchema = z.object({
  diagramId: z.string().trim().min(1),
  diagramType: z.string().trim().min(1),
  revision: z.number().int().nonnegative(),
  sourceMermaid: z.string(),
});

export const flowchartAiMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  diagrams: z.record(diagramDocumentSchema).default({}),
  mermaidDiagrams: z.record(mermaidDiagramRecordSchema).optional(),
});

export type MermaidDiagramRecord = z.infer<typeof mermaidDiagramRecordSchema>;
export type FlowchartAiMetadata = z.infer<typeof flowchartAiMetadataSchema>;
