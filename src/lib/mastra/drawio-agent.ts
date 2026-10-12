/**
 * [INPUT] Current native document, selection and existing configured model.
 * [OUTPUT] Validated native commands through the existing generate_flowchart SSE tool.
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
  type DrawioDocument,
  drawioCommandSchema,
  drawioPatchSchema,
} from '../drawio/contracts';
import { checkCreationQuality } from '../drawio/creation-quality';
import {
  compileNativeGraph,
  nativeGraphSchema,
} from '../drawio/graph-compiler';
import { layoutNewDiagram } from '../drawio/layout-new-diagram';
import {
  applyDrawioPatch,
  nativeContentFingerprint,
  readNativeCells,
} from '../drawio/native-document';
import { checkPatchPlacement } from '../drawio/patch-placement';
import { placeDrawioPatch } from '../drawio/place-patch';
import { allowsNativeRebuild } from '../drawio/rebuild-intent';
import { compileRetryPolicy, retryPolicySchema } from '../drawio/retry-policy';
import { routeDrawioPatch } from '../drawio/route-patch';
import { createNativeModel } from './native-model';
import { reviewNativeMutation } from './native-semantic-review';
import { adaptNativeStream } from './native-stream-adapter';

export const nativeToolInputSchema = z
  .object({
    action: z.enum(['create', 'patch', 'replace']),
    diagramType: z.string().min(1),
    patch: drawioPatchSchema.optional(),
    graph: nativeGraphSchema.optional(),
    retryPolicy: retryPolicySchema.optional(),
    description: z.string().min(1),
  })
  .strict();

export function nativeAgentInstructions(
  document: DrawioDocument,
  selection: string[]
): string {
  const summary = readNativeCells(document).map((cell) => ({
    ...cell,
    style: cell.style.replace(/image=[^;]+/g, 'image=[preserved image]'),
  }));
  return `You are FlowchartAgent, the diagram assistant for FlowchartAI. Reply in the user's language. Read the latest request and current native objects; use generate_flowchart only for a requested diagram mutation. For questions, answer without changing the canvas. State briefly what you will do before the tool and summarize only actual tool results afterward. Never print XML to the user.

The active canvas uses native draw.io objects, NOT Mermaid or a flattened SVG. Any diagram family can use native objects: flowchart, swimlane, mindmap/tree, architecture/network, ER, sequence, UML and timelines. Choose the family that matches the user's purpose. Maintain the source's explicit facts; do not invent business rules. Expose uncertain image text or connections rather than guessing.

CREATE: use action create only for an empty document. Use the structured graph field (required for create/replace): nodes are {id,label,parent?,shape} with shape process/decision/terminator/group/parallel/ellipse/text/database/actor; edges are {id,source,target,label}. Use shape=group for departments and nested subprocesses, and parent=group ID for their children. Condition labels belong on edges, never as separate floating nodes. The compiler supplies correct XML and the layout engine supplies geometry. Supply x/y/width/height only for coordinate-dependent families such as sequence/ER/timeline. The compiler supplies the native XML; do not write XML for creation. Advanced native shapes use individual style keys (for example shape=umlLifeline) on graph nodes. Use edge labels rather than detached annotation text for conditions. Every creation must supply graph. Use stable IDs and plain labels. Silently inventory every requested role, step, condition, loop destination and synchronization point before calling the tool. Include all of them. Parallel approvals require an explicit fork with one outgoing edge to EACH branch and an explicit AND join labelled ALL approvals must pass. Do not connect parallel branches serially or bypass the join. A nested subprocess is a group with child nodes, not a step named subprocess. Keep payment success on the payment result's success branch. Use separate process and decision nodes where required. For sequence, ER and timeline, supply purposeful coordinates and native shape/style keys; for flowchart, architecture and tree the layout engine computes positions.

EDIT: For a bounded retry request, ALWAYS use action patch with retryPolicy {actionId,retryStepId,eligibilityId,manualHandlerId,parentId,maxRetries}, taking IDs from the current graph. The compiler supplies one-time initialization outside the loop, limit checking, one increment per retry, and preserves success/non-retryable/manual branches. Do not implement bounded retries with generic XML operations. For other edits use action patch with baseRevision copied exactly from CURRENT DOCUMENT. A tool error leaves the browser canvas unchanged but retains your mechanically valid patch as a WORKING DRAFT. You may send incremental corrections to that draft with the SAME baseRevision. The tool merges draft corrections and validates the whole result before one atomic canvas commit. To replace a draft entirely, resend the full batch including its added IDs. Always complete the whole requested change; never finish with only a prerequisite layout adjustment. Operations are addCell (one complete cell XML), updateCell (id plus changes), removeCell (id). updateCell changes can contain value, style (ONLY requested style keys), removeStyleKeys, geometry (ONLY changed x/y/width/height), parent, source, target, points. Preserve all unrequested properties. Never replace a whole cell to edit its label/color/font. Never regenerate the whole diagram to insert/delete/reconnect steps or change a complex loop/branch. Remove dependent edges/children explicitly when removing objects. New IDs must not collide. Reconnect explicit edges; deletion never implies reconnection. When changing edge source/target, also set points: [] to remove the old route unless the user explicitly wants that route preserved. For parallel branches, add all split edges and all join edges in the same patch. Change parent and relative geometry together when moving between groups. Keep unrelated nodes and manual adjustments. For bounded retries, initialize the count ONCE before the initial refund action, never on the repeated failure path. All failures still pass the existing retry-eligibility decision; eligible failures check the limit, retry and increment once, then return to the existing refund action. Exhausted retries and non-retryable failures can both enter the original manual handler. If new objects need room, move only the relevant region with explicit geometry operations; leave other branches untouched. Selected groups include their descendants; incident edges may be updated for reconnection. Do not modify unrelated existing objects outside a nonempty selection.

REBUILD: action replace is reserved for the user's explicit full rebuild/type conversion. For ordinary structural edits use patch even when the graph is complex. Do not choose replace just because an edit is difficult.

Return one successful atomic command per response. If the tool rejects an invalid candidate, repair its exact reported issues and retry once; never report a rejected candidate as complete. After success, do not call it again. Before creation, check that all requested steps are reachable from the entry, every conditional outcome is connected, parallel approvals have both incoming branches and an AND join, payment success is driven by the payment result, and retry substeps belong to the nested group. The tool validates IDs, references, group cycles, current revision and selection before the browser can commit. If a constraint is ambiguous, ask one concise clarification rather than making unrelated changes. Use full allowed geometry and style only on NEW cells. Prefer 14–16px readable typography, measured-looking labels, consistent spacing and restrained neutral colors; preserve explicit user styles.

CURRENT DOCUMENT: ${JSON.stringify({ documentId: document.documentId, revision: document.revision, diagramType: document.diagramType, pageId: document.pageId, selection, objects: summary })}`;
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
  selection: string[],
  requestGoal?: string,
  signal?: AbortSignal
): NativeDiagramAgent {
  let stagedPatch: z.infer<typeof drawioPatchSchema> | undefined;
  const addedId = (xml: string): string | undefined =>
    /\bid=[\"']([^\"']+)[\"']/.exec(xml)?.[1];
  const tool = createTool({
    description:
      'Create a native diagram or apply an atomic field-level patch to the current native diagram.',
    inputSchema: nativeToolInputSchema,
    outputSchema: drawioCommandSchema,
    execute: async (input) => {
      if (input.action === 'replace' && !allowsNativeRebuild(requestGoal || ''))
        throw new Error(
          'A full diagram rebuild was not explicitly requested. Use a field-level patch and preserve the current diagram.'
        );
      console.info('[native-tool-input]', {
        action: input.action,
        nodeCount: input.graph?.nodes.length,
        operationCount: input.patch?.operations.length,
      });
      let patch = input.retryPolicy
        ? compileRetryPolicy(document, input.retryPolicy)
        : input.patch;
      if (patch && patch.baseRevision !== document.revision)
        throw new Error(
          'Diagram revision changed; read the current diagram and retry'
        );
      if (patch && stagedPatch) {
        const stagedAdds = new Set(
          stagedPatch.operations
            .filter((op) => op.type === 'addCell')
            .map((op) => addedId(op.xml))
        );
        const fullRetry = patch.operations.some(
          (op) => op.type === 'addCell' && stagedAdds.has(addedId(op.xml))
        );
        if (!fullRetry) {
          const seenRemove = new Set<string>();
          patch = {
            baseRevision: document.revision,
            operations: [...stagedPatch.operations, ...patch.operations].filter(
              (op) => {
                if (op.type !== 'removeCell') return true;
                if (seenRemove.has(op.id)) return false;
                seenRemove.add(op.id);
                return true;
              }
            ),
          };
        }
      }
      if (patch) {
        applyDrawioPatch(document, patch, selection);
        stagedPatch = patch;
      }
      const command = drawioCommandSchema.parse({
        kind: 'drawio-command',
        commandId: randomUUID(),
        documentId: document.documentId,
        baseRevision: document.revision,
        pageId: document.pageId,
        operation: input.action,
        diagramType:
          input.action === 'patch' ? document.diagramType : input.diagramType,
        xml: input.graph ? compileNativeGraph(input.graph) : undefined,
        patch,
        description: input.description,
      });
      if (command.operation !== 'patch' && command.xml) {
        const candidate = prepareDrawioCommand(document, command, selection);
        checkCreationQuality(candidate);
        command.xml = await layoutNewDiagram(command.xml, command.diagramType);
      }
      if (command.operation === 'patch' && command.patch) {
        command.patch = placeDrawioPatch(document, command.patch);
        checkPatchPlacement(
          document,
          prepareDrawioCommand(document, command, selection),
          command.patch
        );
        command.patch = routeDrawioPatch(document, command.patch);
      }
      const candidate = prepareDrawioCommand(document, command, selection);
      if (
        nativeContentFingerprint(candidate.xml) ===
        nativeContentFingerprint(document.xml)
      )
        throw new Error(
          'Nothing was committed: this candidate makes no diagram change. Resend the COMPLETE requested atomic patch, including all nodes and connections, not only a prerequisite layout adjustment.'
        );
      if (requestGoal && !input.retryPolicy)
        await reviewNativeMutation(document, candidate, requestGoal, signal);
      return command;
    },
  });
  return {
    async stream(messages, options = {}) {
      const agent = new ToolLoopAgent({
        model: options.model || createNativeModel('text_to_flowchart'),
        instructions:
          options.instructions || nativeAgentInstructions(document, selection),
        tools: { generate_flowchart: tool },
        stopWhen: isStepCount(options.maxSteps || 2),
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
