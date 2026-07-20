import { getFlowchartModelForMode } from '@/lib/ai-models';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { canvasCommandSchema, diagramPatchSchema } from '../diagram/contracts';
import { createCanvasCommand } from './canvas-command';
import { buildGatewayModelId } from './request-builder';

export const flowchartCanvasToolInputSchema = z
  .object({
    action: z.enum(['create', 'patch', 'replace']),
    targetDiagramId: z.string().trim().min(1).optional(),
    mermaidCode: z.string().trim().min(1).optional(),
    patch: diagramPatchSchema.optional(),
    description: z.string().trim().min(1),
  })
  .superRefine((input, context) => {
    if (input.action === 'patch' && !input.patch) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Patch action requires patch data',
        path: ['patch'],
      });
    }
    if (input.action !== 'patch' && !input.mermaidCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Create and replace actions require Mermaid code',
        path: ['mermaidCode'],
      });
    }
    if (input.action === 'replace' && !input.targetDiagramId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Replace action requires targetDiagramId',
        path: ['targetDiagramId'],
      });
    }
  });

export const flowchartCanvasTool = createTool({
  id: 'generate_flowchart',
  description:
    'Create, replace, or locally patch one explicit diagram on the Excalidraw canvas. The server validates and returns a complete browser canvas command.',
  inputSchema: flowchartCanvasToolInputSchema,
  outputSchema: canvasCommandSchema,
  strict: true,
  execute: async (input) => createCanvasCommand(input),
});

export const flowchartAgent = new Agent({
  id: 'flowchart-agent',
  name: 'FlowchartAgent',
  instructions:
    'You are FlowchartAgent. Help users understand, create, and edit diagrams. Use generate_flowchart only when a canvas mutation is needed.',
  model: buildGatewayModelId(getFlowchartModelForMode('text_to_flowchart')),
  tools: {
    generate_flowchart: flowchartCanvasTool,
  },
  maxRetries: 1,
});
