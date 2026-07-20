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
export const maxDuration = 60;

const TEXT_MODE: AiAssistantMode = 'text_to_flowchart';
const IMAGE_MODE: AiAssistantMode = 'image_to_flowchart';

interface AgentRequestBody {
  messages: any[];
  aiContext?: Record<string, any>;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  requestSignal: AbortSignal
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const mapper = createMastraStreamMapper();
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
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: AgentRequestBody;
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!Array.isArray(body.messages)) {
    return jsonResponse({ error: 'Invalid messages format' }, 400);
  }

  const imageCount = countImagesInLatestUserMessage(body.messages);
  if (body.aiContext?.mode === IMAGE_MODE && imageCount > 1) {
    return jsonResponse(
      { error: 'Only one image is supported for image_to_flowchart mode' },
      400
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
          const requestedMode = getRequestedMode(body.messages, body.aiContext);
          const agentMessages = buildMastraRequestMessages({
            mode: requestedMode,
            messages: body.messages,
            requestedMode: body.aiContext?.requestedMode,
          });
          const model = buildGatewayModelId(
            getFlowchartModelForMode(requestedMode)
          );

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
      return jsonResponse(guarded.body, guarded.status);
    }

    return createAgentStreamResponse(guarded.value, request.signal);
  } catch (error) {
    console.error('FlowchartAgent route error:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
      },
      500
    );
  }
}
