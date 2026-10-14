import { createHash, randomUUID } from 'node:crypto';
import { EVENTS, isProductionAnalytics } from '@/analytics/core-goals';
import { sendServerEvent } from '@/analytics/plausible-server';
import { getFlowchartModelForMode } from '@/lib/ai-models';
import type { AiAssistantMode } from '@/lib/ai-modes';
import { canUserUseAI } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import { billingEnabled } from '@/lib/billing/policy';
import {
  type UsageCollector,
  createUsageCollector,
  estimateTaskBudget,
} from '@/lib/billing/usage-collector';
import {
  BillingError,
  finalizeTask,
  readyTask,
  recordTaskCalls,
  reserveTask,
} from '@/lib/billing/wallet';
import {
  extractLatestUserPrompt,
  screenPromptWithCreem,
} from '@/lib/creem-moderation';
import { prepareDrawioCommand } from '@/lib/drawio/command';
import { drawioDocumentSchema } from '@/lib/drawio/contracts';
import { nativeModelSettings } from '@/lib/drawio/model-settings';
import {
  createDrawioAgent,
  nativeAgentInstructions,
} from '@/lib/mastra/drawio-agent';
import { flowchartAgent } from '@/lib/mastra/flowchart-agent';
import {
  classifyFlowchartError,
  getSafeErrorName,
  logFlowchartDiagnostic,
} from '@/lib/mastra/flowchart-diagnostics';
import {
  generateImageModeInstructions,
  generateSystemPrompt,
} from '@/lib/mastra/flowchart-prompts';
import {
  createNativeModel,
  getNativeModelForMode,
} from '@/lib/mastra/native-model';
import {
  buildGatewayModelId,
  buildMastraRequestMessages,
} from '@/lib/mastra/request-builder';
import { runGuardedFlowchartAgent } from '@/lib/mastra/route-guard';
import { createMastraStreamMapper } from '@/lib/mastra/stream-protocol';
import { headers } from 'next/headers';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TEXT_MODE: AiAssistantMode = 'text_to_flowchart';
const IMAGE_MODE: AiAssistantMode = 'image_to_flowchart';

interface AgentRequestBody {
  messages: any[];
  aiContext?: Record<string, any>;
  billingTaskId?: string;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  requestId: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Flowchart-Request-Id': requestId,
    },
  });
}

function countImagesInLatestUserMessage(messages: any[]): number {
  const latestUser = [...messages]
    .reverse()
    .find((message) => message?.role === 'user');
  if (!Array.isArray(latestUser?.content)) return 0;
  return latestUser.content.filter(
    (part: any) =>
      part?.type === 'image_url' && typeof part.image_url?.url === 'string'
  ).length;
}

function getRequestedMode(
  messages: any[],
  aiContext: Record<string, any> | undefined
): AiAssistantMode {
  if (aiContext?.mode !== IMAGE_MODE) return TEXT_MODE;
  return countImagesInLatestUserMessage(messages) === 0
    ? TEXT_MODE
    : IMAGE_MODE;
}

function buildAgentInstructions(
  mode: AiAssistantMode,
  aiContext: Record<string, any> | undefined
): string {
  const context = {
    requestedMode: aiContext?.requestedMode,
    selectedDiagramId: aiContext?.selectedDiagramId,
    targetResolution: aiContext?.targetResolution,
    flowchartAi: aiContext?.flowchartAi,
    canvasSnapshot: aiContext?.canvasSnapshot,
    lastMermaid: aiContext?.lastMermaid,
  };
  return mode === IMAGE_MODE
    ? generateImageModeInstructions(context)
    : generateSystemPrompt(context);
}

function createAgentStreamResponse(
  output: { fullStream: AsyncIterable<any> },
  requestSignal: AbortSignal,
  requestId: string,
  startedAt: number,
  native = false,
  billing?: {
    id: string;
    userId: string;
    collector: UsageCollector;
    document: any;
  }
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const mapper = createMastraStreamMapper({
        recoverToolErrors: native,
        nativeProgress: native,
        onDiagnostic: (event) =>
          logFlowchartDiagnostic({
            requestId,
            elapsedMs: Date.now() - startedAt,
            ...event,
          }),
      });
      const emit = (event: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      const resultEvents: any[] = [];
      let settled = false;
      let platformRepair = false;
      try {
        const eventCounts: Record<string, number> = {};
        for await (const chunk of output.fullStream) {
          if (
            native &&
            typeof chunk?.type === 'string' &&
            /^[a-z0-9_-]{1,48}$/i.test(chunk.type)
          ) {
            eventCounts[chunk.type] = (eventCounts[chunk.type] || 0) + 1;
            if (chunk.type === 'finish') {
              const usage =
                chunk.payload?.output?.usage || chunk.payload?.usage;
              console.info('[native-agent-result]', {
                requestId,
                eventCounts,
                reason: chunk.payload?.stepResult?.reason,
                inputTokens: usage?.inputTokens,
                outputTokens: usage?.outputTokens,
              });
            }
          }
          if (chunk?.type === 'tool-error') platformRepair = true;
          const event = mapper.map(chunk);
          if (event) {
            if (billing && (event as any).type === 'finish') {
              if (requestSignal.aborted)
                throw new DOMException('Request aborted', 'AbortError');
              const commandEvent = resultEvents.find(
                (e) => e.type === 'tool-call'
              );
              if (commandEvent?.args.kind === 'drawio-command')
                prepareDrawioCommand(billing.document, commandEvent.args);
              const hasResult =
                commandEvent ||
                resultEvents.some(
                  (e) => e.type === 'text' && e.content?.trim()
                );
              if (!hasResult)
                throw new Error('AI task produced no usable result');
              const calls = (await billing.collector.finish()).map((call) => ({
                ...call,
                platformFunded: platformRepair,
              }));
              const text = resultEvents
                .filter((e) => e.type === 'text')
                .map((e) => e.content || '')
                .join('');
              const result = {
                events: [
                  ...(text ? [{ type: 'text', content: text }] : []),
                  ...(commandEvent ? [commandEvent] : []),
                  event,
                ],
              };
              const hash = createHash('sha256')
                .update(JSON.stringify(result))
                .digest('hex');
              await readyTask(billing.id, billing.userId, result, hash, calls);
              settled = true;
              emit({
                type: 'billing',
                taskId: billing.id,
                state: 'ready',
                resultHash: hash,
              });
            }
            resultEvents.push(event);
            emit(event);
          }
          if (mapper.isTerminated()) break;
        }

        if (!mapper.isTerminated()) {
          if (requestSignal.aborted) {
            const aborted = mapper.map({ type: 'abort', payload: {} });
            if (aborted) emit(aborted);
          } else {
            logFlowchartDiagnostic({
              requestId,
              stage: 'sse_map',
              status: 'stream_incomplete',
              code: 'stream_incomplete',
              elapsedMs: Date.now() - startedAt,
            });
            emit({
              type: 'error',
              error: 'Agent stream ended before a final event.',
            });
          }
        }
      } catch (error) {
        if (requestSignal.aborted) {
          const aborted = mapper.map({ type: 'abort', payload: {} });
          if (aborted) emit(aborted);
        } else {
          logFlowchartDiagnostic({
            requestId,
            stage: 'sse_map',
            status: 'failed',
            code: 'stream_exception',
            errorName: getSafeErrorName(error),
            elapsedMs: Date.now() - startedAt,
          });
          emit({
            type: 'error',
            error:
              error instanceof Error ? error.message : 'Agent stream failed.',
          });
        }
      } finally {
        if (billing && !settled) {
          const calls = await billing.collector.receipts();
          await recordTaskCalls(
            billing.userId,
            billing.id,
            calls.map((call) => ({ ...call, platformFunded: true }))
          ).catch(() => undefined);
          await finalizeTask(billing.userId, billing.id).catch(() => undefined);
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Flowchart-Request-Id': requestId,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let body: AgentRequestBody;
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    logFlowchartDiagnostic({
      requestId,
      stage: 'request',
      status: 'failed',
      code: 'invalid_json',
      elapsedMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: 'Invalid JSON body' }, 400, requestId);
  }

  if (!Array.isArray(body.messages)) {
    logFlowchartDiagnostic({
      requestId,
      stage: 'request',
      status: 'failed',
      code: 'invalid_messages',
      elapsedMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: 'Invalid messages format' }, 400, requestId);
  }

  const imageCount = countImagesInLatestUserMessage(body.messages);
  const requestedMode = getRequestedMode(body.messages, body.aiContext);
  const targetStatus = body.aiContext?.targetResolution?.status;
  logFlowchartDiagnostic({
    requestId,
    stage: 'request',
    status: 'started',
    code: 'request_received',
    mode: requestedMode,
    targetStatus:
      targetStatus === 'none' ||
      targetStatus === 'resolved' ||
      targetStatus === 'ambiguous'
        ? targetStatus
        : undefined,
    messageCount: body.messages.length,
    imageCount,
    elapsedMs: Date.now() - startedAt,
  });
  if (body.aiContext?.mode === IMAGE_MODE && imageCount > 1) {
    logFlowchartDiagnostic({
      requestId,
      stage: 'request',
      status: 'failed',
      code: 'too_many_images',
      mode: requestedMode,
      imageCount,
      elapsedMs: Date.now() - startedAt,
    });
    return jsonResponse(
      { error: 'Only one image is supported for image_to_flowchart mode' },
      400,
      requestId
    );
  }

  const latestUserPrompt = extractLatestUserPrompt(body.messages);
  let billingContext:
    | { id: string; userId: string; collector: UsageCollector; document: any }
    | undefined;
  let replay: any = null;
  let legacyAllowance = false;
  const v1 = billingEnabled();
  const taskId = body.billingTaskId || randomUUID();
  if (v1 && !/^[a-zA-Z0-9_-]{16,80}$/.test(taskId))
    return jsonResponse({ error: 'invalid_task' }, 400, requestId);
  const estimatedBudget = estimateTaskBudget({
    messages: body.messages,
    aiContext: body.aiContext,
  });

  try {
    const guarded = await runGuardedFlowchartAgent(
      { latestUserPrompt },
      {
        getSession: async () =>
          auth.api.getSession({ headers: await headers() }),
        checkUsage: async (userId) => {
          const usage = await canUserUseAI(userId);
          legacyAllowance = v1 && usage.billingMode === 'legacy';
          return usage;
        },
        moderate: async (prompt, userId) =>
          screenPromptWithCreem({
            prompt,
            externalId: `user_${userId}_flowchart_${Date.now()}`,
          }),
        invokeAgent: async (userId) => {
          const nativeDocument =
            body.aiContext?.editorKind === 'drawio'
              ? drawioDocumentSchema.parse(body.aiContext.nativeDocument)
              : null;
          const nativeSelection: string[] = Array.isArray(
            body.aiContext?.nativeSelection
          )
            ? body.aiContext.nativeSelection.filter(
                (id: unknown): id is string => typeof id === 'string'
              )
            : [];
          const agent = nativeDocument
            ? createDrawioAgent(
                nativeDocument,
                nativeSelection,
                latestUserPrompt
              )
            : flowchartAgent;
          const agentMessages = buildMastraRequestMessages({
            mode: requestedMode,
            messages: body.messages,
            requestedMode: body.aiContext?.requestedMode,
          });
          const modelId = nativeDocument
            ? getNativeModelForMode(requestedMode)
            : getFlowchartModelForMode(requestedMode);
          if (v1) {
            const hash = createHash('sha256')
              .update(
                JSON.stringify({
                  messages: body.messages,
                  aiContext: body.aiContext,
                })
              )
              .digest('hex');
            const task = await reserveTask({
              id: taskId,
              userId,
              requestHash: hash,
              budget: estimatedBudget,
            });
            if (['ready', 'committed'].includes(task.state) && task.result) {
              replay = task;
              return { fullStream: (async function* () {})() };
            }
            if (task.state === 'released')
              throw new BillingError(
                'task_closed',
                'Start a new request for this retry'
              );
            billingContext = {
              id: taskId,
              userId,
              collector: createUsageCollector(modelId),
              document: nativeDocument,
            };
          }
          const model = v1
            ? createNativeModel(requestedMode, {
                model: modelId,
                fetch: billingContext!.collector.fetch,
                billing: !legacyAllowance,
              })
            : nativeDocument
              ? createNativeModel(requestedMode)
              : buildGatewayModelId(modelId);

          logFlowchartDiagnostic({
            requestId,
            stage: 'agent',
            status: 'started',
            code: 'agent_invoked',
            mode: requestedMode,
            elapsedMs: Date.now() - startedAt,
          });
          return agent.stream(agentMessages as any, {
            model,
            instructions: nativeDocument
              ? nativeAgentInstructions(
                  nativeDocument,
                  nativeSelection,
                  latestUserPrompt
                )
              : buildAgentInstructions(requestedMode, body.aiContext),
            maxSteps: nativeDocument ? 5 : 2,
            toolChoice: 'auto',
            abortSignal: request.signal,
            modelSettings: {
              ...(nativeDocument
                ? nativeModelSettings(getNativeModelForMode(requestedMode))
                : {
                    temperature: requestedMode === IMAGE_MODE ? 0.3 : 0.7,
                    maxOutputTokens: 4096,
                    maxRetries: 1,
                  }),
            },
          });
        },
      }
    );

    if (!guarded.ok) {
      logFlowchartDiagnostic({
        requestId,
        stage: 'guard',
        status: 'failed',
        code: 'guard_rejected',
        mode: requestedMode,
        elapsedMs: Date.now() - startedAt,
      });
      return jsonResponse(guarded.body, guarded.status, requestId);
    }

    if (replay) {
      const events = [
        ...(replay.result.events || []),
        {
          type: 'billing',
          taskId: replay.id,
          charged: replay.charged,
          state: replay.state,
          resultHash: replay.resultHash,
        },
      ];
      return new Response(
        events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') +
          'data: [DONE]\n\n',
        {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'X-Flowchart-Request-Id': requestId,
          },
        }
      );
    }
    // Count accepted requests after auth, quota, moderation and agent startup.
    // Delivery runs after the response and does not delay the first AI token.
    try {
      if (isProductionAnalytics()) {
        const visitor = new Headers(request.headers);
        after(async () => {
          await sendServerEvent(
            EVENTS.processingStarted,
            {
              mode: requestedMode,
              editor:
                body.aiContext?.editorKind === 'drawio'
                  ? 'drawio'
                  : 'excalidraw',
            },
            visitor
          );
        });
      }
    } catch {}

    return createAgentStreamResponse(
      guarded.value,
      request.signal,
      requestId,
      startedAt,
      body.aiContext?.editorKind === 'drawio',
      billingContext
    );
  } catch (error) {
    if (billingContext)
      await finalizeTask(billingContext.userId, billingContext.id).catch(
        () => undefined
      );
    if (error instanceof BillingError)
      return jsonResponse(
        { error: error.code, message: error.message },
        error.status,
        requestId
      );
    logFlowchartDiagnostic({
      requestId,
      stage: 'agent',
      status: 'failed',
      code: classifyFlowchartError(error),
      errorName: getSafeErrorName(error),
      elapsedMs: Date.now() - startedAt,
    });
    return jsonResponse(
      {
        error: 'Internal server error',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
      },
      500,
      requestId
    );
  }
}
