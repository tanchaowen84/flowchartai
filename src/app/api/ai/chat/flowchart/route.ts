import { randomUUID } from 'node:crypto';
import { getFlowchartModelForMode } from '@/lib/ai-models';
import type { AiAssistantMode } from '@/lib/ai-modes';
import { canUserUseAI } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import {
  extractLatestUserPrompt,
  screenPromptWithCreem,
} from '@/lib/creem-moderation';
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
  buildGatewayModelId,
  buildMastraRequestMessages,
} from '@/lib/mastra/request-builder';
import { runGuardedFlowchartAgent } from '@/lib/mastra/route-guard';
import { createMastraStreamMapper } from '@/lib/mastra/stream-protocol';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TEXT_MODE: AiAssistantMode = 'text_to_flowchart';
const IMAGE_MODE: AiAssistantMode = 'image_to_flowchart';

interface AgentRequestBody {
  messages: any[];
  aiContext?: Record<string, any>;
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
  startedAt: number
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const mapper = createMastraStreamMapper({
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

      try {
        for await (const chunk of output.fullStream) {
          const event = mapper.map(chunk);
          if (event) emit(event);
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

  try {
    const guarded = await runGuardedFlowchartAgent(
      { latestUserPrompt },
      {
        getSession: async () =>
          auth.api.getSession({ headers: await headers() }),
        checkUsage: canUserUseAI,
        moderate: async (prompt, userId) =>
          screenPromptWithCreem({
            prompt,
            externalId: `user_${userId}_flowchart_${Date.now()}`,
          }),
        invokeAgent: async () => {
          const agentMessages = buildMastraRequestMessages({
            mode: requestedMode,
            messages: body.messages,
            requestedMode: body.aiContext?.requestedMode,
          });
          const model = buildGatewayModelId(
            getFlowchartModelForMode(requestedMode)
          );

          logFlowchartDiagnostic({
            requestId,
            stage: 'agent',
            status: 'started',
            code: 'agent_invoked',
            mode: requestedMode,
            elapsedMs: Date.now() - startedAt,
          });
          return flowchartAgent.stream(agentMessages as any, {
            model,
            instructions: buildAgentInstructions(requestedMode, body.aiContext),
            maxSteps: 2,
            toolChoice: 'auto',
            abortSignal: request.signal,
            modelSettings: {
              temperature: requestedMode === IMAGE_MODE ? 0.3 : 0.7,
              maxOutputTokens: 4096,
              maxRetries: 1,
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

    return createAgentStreamResponse(
      guarded.value,
      request.signal,
      requestId,
      startedAt
    );
  } catch (error) {
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
