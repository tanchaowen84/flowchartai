/**
 * [INPUT] Current native document, selection and existing configured model.
 * [OUTPUT] Native commands through the existing generate_flowchart SSE tool.
 * [POS] Native adapter for the single diagram assistant; no new service.
 * [UPDATE] Keep native engine, stream contracts and browser context in sync.
 */
import { randomUUID } from 'node:crypto';
import {
  type LanguageModel,
  type ModelMessage,
  ToolLoopAgent,
  tool as createTool,
  isStepCount,
} from 'ai';
import { z } from 'zod';
import { prepareDrawioCommand } from '../drawio/command';
import {
  type DrawioCommand,
  type DrawioDocument,
  drawioCommandSchema,
  drawioPatchSchema,
} from '../drawio/contracts';
import { fitDrawioPatchGroups } from '../drawio/fit-patch-groups';
import {
  compileNativeGraph,
  nativeGraphSchema,
} from '../drawio/graph-compiler';
import { layoutNewDiagram } from '../drawio/layout-new-diagram';
import { readNativeCells } from '../drawio/native-document';
import { compileRetryPolicy, retryPolicySchema } from '../drawio/retry-policy';
import { routeDrawioPatch } from '../drawio/route-patch';
import { createNativeModel } from './native-model';
import { adaptNativeStream } from './native-stream-adapter';

export const nativeToolInputSchema = z
  .object({
    action: z.enum(['create', 'patch', 'replace']),
    diagramType: z.string().min(1),
    patch: drawioPatchSchema.optional(),
    graph: nativeGraphSchema.optional(),
    retryPolicy: retryPolicySchema
      .describe(
        'Local patch shortcut for setting a maximum retry count on an existing loop. Preserves other branches; avoids writing counter XML manually.'
      )
      .optional(),
    description: z.string().min(1),
  })
  .strict();

export function nativeAgentInstructions(
  document: DrawioDocument,
  selection: string[]
): string {
  const objects = readNativeCells(document).map((cell) => ({
    ...cell,
    style: cell.style.replace(/image=[^;]+/g, 'image=[preserved image]'),
  }));
  return [
    'You are FlowchartAgent, the diagram assistant for FlowchartAI. Reply in the user language. Use generate_flowchart for requested canvas changes; answer questions without changing the canvas. Before creating, briefly name the groups/subprocesses and split/join points you will include; before editing, briefly explain the change. Report only actual tool results. Never print XML to the user.',
    'The canvas contains editable native draw.io objects. Support flowcharts, swimlanes, architecture/network, mindmaps/trees, ER, sequence, UML and timelines. Choose the family and native shapes/styles that fit the request. Follow explicit facts; clarify material ambiguity rather than inventing business rules.',
    'CREATE/REBUILD: use action create only for an empty document. Use replace for a user-requested full rebuild or diagram-type conversion, and patch for ordinary edits. Use the structured graph field (required for create/replace): nodes are {id,label,parent?,shape} with shape process/decision/terminator/group/parallel/ellipse/text/database/actor; edges are {id,source,target,label}. Use shape=group for departments and nested subprocesses, and parent=group ID for their children. Condition labels belong on edges, never as separate floating nodes. The compiler supplies correct XML and the layout engine supplies geometry. Supply x/y/width/height only for coordinate-dependent families such as sequence/ER/timeline. The compiler supplies the native XML; do not write XML for creation. Advanced native shapes use individual style keys (for example shape=umlLifeline) on graph nodes. Use edge labels rather than detached annotation text for conditions. Every creation must supply graph. Use stable IDs and plain labels. Silently inventory every requested role, step, condition, loop destination and synchronization point before calling the tool. Include all of them. Parallel approvals require an explicit fork with one outgoing edge to EACH branch and an explicit AND join labelled ALL approvals must pass. Do not connect parallel branches serially or bypass the join. A nested subprocess is a group with child nodes, not a step named subprocess. Keep success and failure paths on the corresponding result decision. Use separate process and decision nodes where required. For sequence, ER and timeline, supply purposeful coordinates and native shape/style keys; for flowchart, architecture and tree the layout engine computes positions. List department and nested subprocess groups first; a subprocess group is parented to its department and its steps are parented to that subprocess.',
    'EDIT: prefer action patch for changes to an existing diagram. For a compatible existing retry loop, use action=patch with retryPolicy {actionId,retryStepId,eligibilityId,manualHandlerId,maxRetries} instead of writing counter XML. This IS a local field-level patch, not a rebuild; it preserves other branches and places initialization outside the loop. The generic patch field is available for other changes and loops that do not match this shortcut. If the request also needs other changes, provide patch alongside retryPolicy; they are combined atomically. Copy the current baseRevision. Operations: addCell {xml}, updateCell {id,changes}, removeCell {id}. A new cell needs an mxGeometry child with as="geometry"; vertices need parent/vertex, edges need parent/edge/source/target. Changes may include value, individual style keys, removeStyleKeys, geometry {x,y,width,height}, parent, source, target, points. Modify only requested fields; preserve existing IDs, manual styling/positions and unrelated branches. Selection is context for references, not a restriction when the request spans other regions. Remove dependent edges/children explicitly. When inserting a step into an existing connection, reconnect or replace that original edge so it cannot bypass the new step. Do not duplicate unchanged connections. When inserting a branch before an existing phase, allowed paths resume at that phase entrance, never at its exit/join. Put condition labels in the edge value attribute, not only in the edge ID. When reconnecting an edge set points: [] to discard its old route. Only when the user requests bounded retries: show an explicit count=0 initialization node before the ORIGINAL main action (before its first attempt), never on a failure/eligibility path; redirect the upstream entry through initialization with no bypass, check the limit before each eligible retry, execute the retry then increment once, return without reinitializing, and preserve the other result branches. Coordinates are relative to the parent group. Place additions in available space below group headings; move existing regions only when needed for the request.',
    'Return one complete atomic command. If the tool reports a format/reference error, resend the corrected complete batch once; failed batches are discarded. After success do not call it again. Keep labels readable, spacing consistent and explicit user styling intact.',
    'CURRENT DOCUMENT: ' +
      JSON.stringify({
        documentId: document.documentId,
        revision: document.revision,
        diagramType: document.diagramType,
        pageId: document.pageId,
        selection,
        objects,
      }),
  ].join('\n\n');
}

/** Validate file integrity; layout improves presentation without vetoing an edit. */
export async function buildNativeCommand(
  document: DrawioDocument,
  input: z.infer<typeof nativeToolInputSchema>
): Promise<DrawioCommand> {
  const retryPatch =
    input.action === 'patch' && input.retryPolicy
      ? compileRetryPolicy(document, input.retryPolicy)
      : undefined;
  const patch =
    retryPatch && input.patch
      ? {
          baseRevision: input.patch.baseRevision,
          operations: [...retryPatch.operations, ...input.patch.operations],
        }
      : retryPatch || input.patch;
  const command = drawioCommandSchema.parse({
    kind: 'drawio-command',
    commandId: randomUUID(),
    documentId: document.documentId,
    baseRevision: document.revision,
    pageId: document.pageId,
    operation: input.action,
    diagramType:
      input.action === 'patch' ? document.diagramType : input.diagramType,
    xml:
      input.action !== 'patch' && input.graph
        ? compileNativeGraph(input.graph)
        : undefined,
    patch: input.action === 'patch' ? patch : undefined,
    description: input.description,
  });
  prepareDrawioCommand(document, command);
  try {
    const arranged = { ...command };
    if (arranged.operation === 'patch' && arranged.patch) {
      arranged.patch = routeDrawioPatch(
        document,
        fitDrawioPatchGroups(document, arranged.patch)
      );
    } else if (arranged.xml) {
      arranged.xml = await layoutNewDiagram(arranged.xml, arranged.diagramType);
    }
    prepareDrawioCommand(document, arranged);
    return arranged;
  } catch {
    console.warn('[native-layout] Using the valid original command');
    return command;
  }
}

export interface NativeDiagramAgent {
  stream: (
    messages: string | ModelMessage[],
    options?: {
      model?: LanguageModel;
      instructions?: string;
      maxSteps?: number;
      toolChoice?: string;
      modelSettings?: {
        temperature?: number;
        maxOutputTokens?: number;
        maxRetries?: number;
      };
      abortSignal?: AbortSignal;
    }
  ) => Promise<{ fullStream: AsyncIterable<any> }>;
}

export function createDrawioAgent(
  document: DrawioDocument,
  selection: string[]
): NativeDiagramAgent {
  const tool = createTool({
    description:
      'Create a native diagram or apply an atomic field-level patch to the current native diagram.',
    inputSchema: nativeToolInputSchema,
    outputSchema: drawioCommandSchema,
    execute: (input) => buildNativeCommand(document, input),
  });
  return {
    async stream(messages, options = {}) {
      const agent = new ToolLoopAgent({
        model: options.model || createNativeModel('text_to_flowchart'),
        instructions:
          options.instructions || nativeAgentInstructions(document, selection),
        tools: { generate_flowchart: tool },
        stopWhen: [
          isStepCount(options.maxSteps || 2),
          ({ steps }) =>
            steps
              .at(-1)
              ?.toolResults.some(
                (result) => drawioCommandSchema.safeParse(result.output).success
              ) || false,
        ],
        toolChoice: 'auto',
        ...options.modelSettings,
      });
      const output = await agent.stream({
        ...(typeof messages === 'string' ? { prompt: messages } : { messages }),
        abortSignal: options.abortSignal,
      });
      return { fullStream: adaptNativeStream(output.fullStream) };
    },
  };
}
