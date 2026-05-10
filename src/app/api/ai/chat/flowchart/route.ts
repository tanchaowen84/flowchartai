import { getFlowchartModelForMode } from '@/lib/ai-models';
import type { AiAssistantMode } from '@/lib/ai-modes';
import { canUserUseAI } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import {
  extractLatestUserPrompt,
  screenPromptWithCreem,
} from '@/lib/creem-moderation';
import { IMAGE_TO_FLOWCHART_PROMPT } from '@/lib/prompts/image-flowchart';
import {
  OpenRouter,
  tool as createOpenRouterTool,
  hasToolCall,
} from '@openrouter/agent';
import { headers } from 'next/headers';
import { z as z4 } from 'zod-v4';

// OpenRouter Responses client for text and image modes.
function createOpenRouterAgentClient() {
  return new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    appTitle: 'FlowChart AI',
    timeoutMs: 60000,
    retryConfig: {
      strategy: 'backoff',
      backoff: {
        initialInterval: 500,
        maxInterval: 2000,
        exponent: 1.5,
        maxElapsedTime: 30000,
      },
      retryConnectionErrors: true,
    },
  });
}

const flowchartToolInputSchema = z4.object({
  mermaid_code: z4
    .string()
    .describe(
      'Valid Mermaid flowchart code. CRITICAL: NO special symbols in node text: ()（）【】《》「」\'\'"":;，。！？'
    ),
  mode: z4
    .enum(['replace', 'extend'])
    .describe(
      'Whether to replace existing flowchart completely or extend/modify it based on existing content'
    ),
  description: z4.string().describe('Brief description of the flowchart'),
});

const flowchartTool = createOpenRouterTool({
  name: 'generate_flowchart',
  description: 'Generate or update a flowchart using Mermaid syntax',
  inputSchema: flowchartToolInputSchema,
  execute: false,
});

type FlowchartToolArguments = {
  mermaid_code: string;
  mode: 'replace' | 'extend';
  description: string;
};

const TEXT_MODE: AiAssistantMode = 'text_to_flowchart';
const IMAGE_MODE: AiAssistantMode = 'image_to_flowchart';

function generateSystemPrompt(canvasSummary?: string, lastMermaid?: string) {
  const contextSection = [
    canvasSummary
      ? `CURRENT CANVAS SNAPSHOT (JSON):\n${canvasSummary}`
      : 'CURRENT CANVAS SNAPSHOT: none provided',
    lastMermaid
      ? `LATEST AI MERMAID (may be outdated if user edited manually):\n\n\`\`\`mermaid\n${lastMermaid}\n\`\`\``
      : 'LATEST AI MERMAID: none recorded',
  ].join('\n\n');

  return `⚠️⚠️⚠️ URGENT: NEVER USE SPECIAL SYMBOLS IN NODES! ⚠️⚠️⚠️
ABSOLUTELY FORBIDDEN: ()（）【】《】「」''"":;，。！？
This causes 90% of rendering failures! Use plain text only!

🚨 CRITICAL SYNTAX RULES (PREVENT RENDERING FAILURES):

1. FORBIDDEN CHARACTERS in node text:
   ❌ NEVER use: ()（）【】《》「」''"":;，。！？、：；""''
   ❌ These symbols WILL BREAK the diagram rendering

2. ALLOWED CONTENT:
   ✅ Any language text is supported
   ✅ Numbers and spaces

3. HOW TO HANDLE SYMBOLS:
   ❌ A[User registration (new user)]
   ❌ B{Check status (active/inactive)}

   ✅ A[User registration new user]
   ✅ B{Check status active inactive]

4. ENGLISH EXAMPLES:
   ❌ A[Process (step 1)]     ✅ A[Process step 1]
   ❌ B{Check (OK or NG)}    ✅ B{Check OK or NG}
   ❌ C[Download file (PDF)] ✅ C[Download file PDF]

5. SIMPLE RULE: Replace forbidden symbols with spaces or remove them entirely

REMEMBER: One syntax error can break the entire diagram. Be strict about forbidden characters!

You are FlowChart AI, an assistant dedicated to helping users create richly detailed flowcharts. Always reply in the same language the user uses (default to English if unclear).

CURRENT CANVAS CONTEXT:
${contextSection}

AVAILABLE TOOL:
- **generate_flowchart** (only function tool). Call it when you need Mermaid code for a diagram. After calling, describe the result in natural language—do not print the Mermaid source.
- IMPORTANT TOOL CALL FORMAT: When you call generate_flowchart, include a brief natural-language assistant message before the tool call. Do not leave the assistant message content empty.

CORE DUTIES:
1. CRITICAL: NEVER use special symbols in node text: ()（）【】《】「」''"":;，。！？、：；""'' - This is the most common cause of rendering failures.
2. Primary mission: understand the user scenario and produce precise node and connection plans that accelerate flowchart creation.
3. Conversation policy:
   - DIRECT FLOWCHART REQUESTS: Always generate the flowchart, but when information is incomplete, express what additional details would be helpful while still proceeding with generation.
   - When details are missing, provide specific options: "I'm creating your flowchart now. I need to clarify a few details - please choose what applies: A) Include email verification, B) Phone verification only, C) Both, D) No verification needed. Also, for approval process: 1) Auto-approve, 2) Manager approval, 3) Multi-level approval, 4) No approval needed."
   - Template for providing options: "I need to clarify a few details. Please choose: For verification: A) Email only, B) Phone only, C) Both, D) Skip. For approval: 1) Auto-approve, 2) Manager only, 3) Department head + Manager, 4) Skip. For notifications: X) Email + SMS, Y) Email only, Z) No notifications."
- More option examples: "For timeline: A) Same day, B) 24-48 hours, C) 3-5 business days. For document requirements: 1) ID required, 2) ID + address proof, 3) No documents needed."
   - This approach shows you understand their needs while gathering information to improve the result, without blocking the generation.
   - General questions (e.g., "How do I upload a blog post?"): answer fully first, then offer to turn the explanation into a flowchart.
   - Questions about the agent, canvas state, or system settings: answer directly without using the tool.
4. Requirement check: Prioritize creating comprehensive, multi-layered flowcharts that demonstrate value. For basic requests, reasonably expand with common business scenarios: multiple phases, decision points, error handling, success/failure outcomes, and edge cases. Example: "user login" can become: access page → enter credentials → validate input → check credentials → handle success/failure → redirect or show error → log activity → optional 2FA → session management. If user explicitly asks for simplicity or indicates they need minimal steps, honor that preference. Focus on showing the full potential of what could be included in their process.
5. Flowchart generation guidelines:
   - 🚨 URGENT: NEVER use special symbols in node text: ()（）【】《》「」''"":;，。！？ - This is critical for rendering!
   - PRIORITIZE RICH CONTENT: Aim to create comprehensive flowcharts that show the full potential of their process. Include multiple phases, decision branches, success/failure paths, and common business scenarios.
   - However, respect user preferences: If they ask for simplicity, minimal steps, or indicate they need a basic overview, honor that request. Balance comprehensiveness with user's stated needs.
   - Still think hierarchically: outline top-level phases first, then expand each phase into actionable steps so the final diagram shows clear layers, the main path, and any critical quality checks or backups. Every major action should include at least one layer of concrete sub-steps (e.g., “Add media” must branch into “Upload image”, “Embed video”, “Attach audio” rather than staying a single node).
   - Evaluate the workflow before drawing: map out phases and detailed steps even when the user directly requests a diagram. Choose the Mermaid diagram family that best fits the structure—sequenceDiagram for rich actor timelines, flowchart/graph for state or decision flows, and other types (journey, gantt, etc.) when appropriate. Do not default to sequence diagrams unless they are clearly the best fit. Favor left-to-right layouts when practical, while honoring explicit user instructions.
   - After using the tool, summarize what was created and provide specific examples of how users can refine it: "You can ask me to add specific steps (like 'email verification'), include decision points (like 'is user premium?'), or adjust the flow for your particular use case."
   - Content comes first: prioritize comprehensive nodes, branches, and annotations before thinking about color. Only after the structure is complete should you add visuals.
   - Give every flowchart a light but consistent palette that Excalidraw will render: ideally apply at least one \`style\` command per major phase, mapping colors to the semantics of each node type. Recommended defaults:
     * Core process steps (actions, transformations): \`style StepCore fill:#fddf9f,stroke:#d68f2f,stroke-width:2px\`
     * Decision/branch points: \`style StepDecision fill:#f9c9c9,stroke:#d12f2f,stroke-width:2px\`
     * Start/End or confirmed success states: \`style StepSuccess fill:#9fdfbf,stroke:#2f7f3f,stroke-width:2px\`
     * Retry/error handling nodes: \`style StepRetry fill:#ffe0e0,stroke:#bf2f2f,stroke-width:2px\`
     * Notifications/outputs/information hubs: \`style StepInfo fill:#c9e9ff,stroke:#2f6fbf,stroke-width:2px\`
     Adjust hues if the user specifies branding or accessibility needs, but always keep the mapping explicit in your explanation. If a node truly should remain neutral for clarity, you may leave it unstyled, yet still mention why. Use \`style\` directives (not classDef) and keep supporting nodes minimal to preserve readability.
6. Mermaid syntax essentials (prevent rendering failures):
   - CRITICAL: NEVER use special symbols in node text: ()（）【】《》「」''"":;，。！？、：；""'' - This is the #1 cause of rendering failures.
   - When using 'sequenceDiagram', declare all participants at the top via \`participant Identifier as Display Name\`; identifiers must be unique, alphanumeric/underscore, and optional aliases follow \`as\`. Favor multi-layer sequences that group interactions by phase (notes, rect blocks, par/alt sections) so hierarchy is explicit.
   - Sequence messages must follow \`Sender ->> Receiver : text\` or \`Sender -->> Receiver : text\`; use \`->>+\` / \`-->>-\` for activation/deactivation. Escape or rephrase colons and other special characters inside message text.
   - Sequence control blocks must close properly with consistent indentation: \`alt/else/end\`, \`opt/end\`, \`loop/end\`, \`par/and/end\`. Inside blocks, use only valid messages, notes, or nested structures—never leave them empty.
   - Keep \`note over/left of/right of\` and \`rect ... end\` paired and adjacent to relevant participants; within \`par\`, separate branches with \`and\`.
   - For 'flowchart'/'graph', begin with \`flowchart LR\` or \`graph LR\`; IDs are alphanumeric/underscore, edges use patterns like \`A --> B\` or \`A -.-> B\`, and every node must connect to at least one edge.
   - Styling example: include the color directives in the Mermaid output, e.g.,
     \`style PhasePlanning fill:#fddf9f,stroke:#d68f2f,stroke-width:2px\`
     \`style DecisionGate fill:#f9c9c9,stroke:#d12f2f,stroke-width:2px\`
     \`style LaunchComplete fill:#9fdfbf,stroke:#2f7f3f,stroke-width:2px\`
     Ensure similar styles appear in every diagram so users see an intentional palette.
7. Safety & compliance: refuse or caution on sensitive, illegal, or policy-violating requests.

COMMUNICATION STYLE:
- GUIDE THEN GENERATE: Before calling the tool, always tell users what you're about to create and what information would help make it better. This sets expectations while gathering useful details.
- When information is incomplete, provide concrete options: "I'm creating your flowchart now. Please help me choose the right options: 1) User roles: A) Customer only, B) Customer + Admin, C) Customer + Admin + Manager. 2) Verification method: A) Email only, B) Phone only, C) Both. 3) Payment: A) Required upfront, B) After approval, C) No payment. I'll proceed with the most common combination and you can tell me your preferences."
- Always provide specific numbered or lettered choices for users to select from, rather than open-ended questions.
- For example: "For error handling, which scenarios should I include? 1) Invalid input, 2) System timeout, 3) Payment failure, 4) Duplicate submission, 5) All of the above."
- Structure responses as "brief guidance → immediate generation → post-generation refinement invitation," reducing user's cognitive burden.
- Focus on: 1) Setting expectations, 2) Providing clear feedback examples, 3) Generating immediately, 4) Guiding refinements.

MODE BEHAVIOR:
- **replace**: use when rebuilding a diagram or when no AI-generated elements exist—overwrite previous AI content.
- **extend**: use when AI content already exists and the user wants incremental changes—keep existing nodes and add/update only what’s needed.
- Always honor an explicit mode set by the UI or user.

Stay polite, clear, and professional, always working to enhance the user's flowchart design efficiency.

⚠️⚠️⚠️ FINAL WARNING: NEVER USE SPECIAL SYMBOLS IN NODES! ⚠️⚠️⚠️
No: ()（）【】《》「」''"":;，。！？
This is the most critical rule - violating it breaks the diagram! 不要在节点中使用特殊符号`;
}

function getRequestedMode(aiContext: any): AiAssistantMode {
  const mode = aiContext?.mode;
  return mode === IMAGE_MODE ? IMAGE_MODE : TEXT_MODE;
}

function countImagesInLatestUserMessage(messages: any[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== 'user') continue;

    const content = message.content;
    if (!Array.isArray(content)) {
      return 0;
    }

    let count = 0;
    for (const part of content) {
      if (part?.type === 'image_url' && part.image_url?.url) {
        count += 1;
      }
    }
    return count;
  }

  return 0;
}

function stringifyMessageContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part?.type === 'text') {
          return part.text || '';
        }

        if (part?.type === 'image_url') {
          return '[Image attached]';
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content == null) {
    return '';
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function buildTextModeInput(messages: any[], aiContext: any): string {
  const recentMessages = messages.slice(-12);
  const transcript = recentMessages
    .map((message) => {
      const role = typeof message?.role === 'string' ? message.role : 'unknown';
      const content = stringifyMessageContent(message?.content).trim();
      const toolCalls = Array.isArray(message?.tool_calls)
        ? `\nTool calls: ${JSON.stringify(message.tool_calls)}`
        : '';

      return `${role.toUpperCase()}:\n${content}${toolCalls}`;
    })
    .join('\n\n');

  const requestedMode = aiContext?.requestedMode
    ? `\n\nRequested mode from UI: ${aiContext.requestedMode}`
    : '';

  return `Conversation transcript:
${transcript}${requestedMode}

Use the latest user message as the active request.`;
}

function getLatestImageRequest(
  messages: any[]
): { imageUrl: string; text: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== 'user' || !Array.isArray(message.content)) {
      continue;
    }

    let imageUrl = '';
    const textParts: string[] = [];

    for (const part of message.content) {
      if (part?.type === 'text' && typeof part.text === 'string') {
        textParts.push(part.text);
      }

      if (
        part?.type === 'image_url' &&
        typeof part.image_url?.url === 'string'
      ) {
        imageUrl = part.image_url.url;
      }
    }

    if (imageUrl) {
      return {
        imageUrl,
        text: textParts.join('\n').trim(),
      };
    }
  }

  return null;
}

function buildImageModeInput(messages: any[], aiContext: any) {
  const imageRequest = getLatestImageRequest(messages);

  if (!imageRequest) {
    throw new Error('Image mode request is missing an image.');
  }

  const userText = imageRequest.text
    ? `User request:\n${imageRequest.text}`
    : 'User request:\nConvert the uploaded image into a Mermaid flowchart.';
  const requestedMode = aiContext?.requestedMode
    ? `\n\nRequested mode from UI: ${aiContext.requestedMode}`
    : '';

  return [
    {
      type: 'message' as const,
      role: 'user' as const,
      content: [
        {
          type: 'input_text' as const,
          text: `${userText}${requestedMode}\n\nRead the attached image and reconstruct the diagram as Mermaid.`,
        },
        {
          type: 'input_image' as const,
          imageUrl: imageRequest.imageUrl,
          detail: 'high' as const,
        },
      ],
    },
  ];
}

function generateImageModeInstructions(
  canvasSummary?: string,
  lastMermaid?: string
): string {
  const contextSection = [
    canvasSummary
      ? `CURRENT CANVAS SNAPSHOT (JSON):\n${canvasSummary}`
      : 'CURRENT CANVAS SNAPSHOT: none provided',
    lastMermaid
      ? `LATEST AI MERMAID:\n\n\`\`\`mermaid\n${lastMermaid}\n\`\`\``
      : 'LATEST AI MERMAID: none recorded',
  ].join('\n\n');

  return `${IMAGE_TO_FLOWCHART_PROMPT}

CURRENT CANVAS CONTEXT:
${contextSection}

IMPORTANT RESPONSE FORMAT OVERRIDE:
- Do not return raw JSON to the user.
- First stream a brief natural-language note about what you detected in the image.
- Then call generate_flowchart exactly once.
- Put the Mermaid code in generate_flowchart.mermaid_code.
- Use mode "replace" unless the user explicitly asks to update an existing diagram.
- Put the detected title or a concise summary in generate_flowchart.description.`;
}

function parseFlowchartToolArguments(
  toolArguments: unknown
): FlowchartToolArguments | null {
  let candidate = toolArguments;

  if (typeof toolArguments === 'string') {
    try {
      candidate = JSON.parse(toolArguments);
    } catch (error) {
      console.error('Failed to parse flowchart tool arguments:', error);
      return null;
    }
  }

  if (!candidate || typeof candidate !== 'object') {
    console.error('Invalid flowchart tool arguments:', candidate);
    return null;
  }

  const payload = candidate as Record<string, unknown>;
  const mermaidCode =
    typeof payload.mermaid_code === 'string'
      ? payload.mermaid_code
      : typeof payload.mermaid === 'string'
        ? payload.mermaid
        : '';
  const mode = payload.mode === 'extend' ? 'extend' : 'replace';
  const description =
    typeof payload.description === 'string'
      ? payload.description
      : 'Generated flowchart';

  if (!mermaidCode.trim()) {
    console.error('Flowchart tool arguments missing mermaid code:', candidate);
    return null;
  }

  return {
    mermaid_code: normalizeMermaidCode(mermaidCode),
    mode,
    description,
  };
}

function normalizeMermaidCode(mermaid: string): string {
  return mermaid
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/"/g, "'");
}

function createFlowchartAgentStreamResponse(completion: any): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let accumulatedContent = '';
        let pendingToolCall: {
          toolCallId: string;
          toolName: string;
          arguments: string;
        } | null = null;
        let toolCallSent = false;
        let hasFlowchartToolCall = false;
        let finishSent = false;

        const emitToolCall = () => {
          if (
            toolCallSent ||
            !pendingToolCall ||
            pendingToolCall.toolName !== 'generate_flowchart'
          ) {
            return;
          }

          const args = parseFlowchartToolArguments(pendingToolCall.arguments);

          if (!args) {
            return;
          }

          hasFlowchartToolCall = true;
          toolCallSent = true;
          const data = JSON.stringify({
            type: 'tool-call',
            toolCallId: pendingToolCall.toolCallId,
            toolName: 'generate_flowchart',
            args,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const emitFinish = (toolCallsCompleted: boolean) => {
          if (finishSent) {
            return;
          }

          finishSent = true;
          const finishData = JSON.stringify({
            type: 'finish',
            content: accumulatedContent || 'Conversation completed.',
            toolCallsCompleted,
          });
          controller.enqueue(encoder.encode(`data: ${finishData}\n\n`));
        };

        for await (const event of completion.getFullResponsesStream()) {
          if (
            event.type === 'response.output_text.delta' &&
            typeof event.delta === 'string'
          ) {
            accumulatedContent += event.delta;
            const data = JSON.stringify({
              type: 'text',
              content: event.delta,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            continue;
          }

          if (
            event.type === 'response.output_item.added' &&
            event.item?.type === 'function_call'
          ) {
            pendingToolCall = {
              toolCallId: event.item.callId || event.item.id || '',
              toolName: event.item.name || '',
              arguments: event.item.arguments || '',
            };
            continue;
          }

          if (
            event.type === 'response.function_call_arguments.delta' &&
            pendingToolCall
          ) {
            pendingToolCall.arguments += event.delta;
            continue;
          }

          if (
            event.type === 'response.function_call_arguments.done' &&
            pendingToolCall
          ) {
            pendingToolCall.toolName = event.name || pendingToolCall.toolName;
            pendingToolCall.arguments =
              event.arguments || pendingToolCall.arguments;
            emitToolCall();
            continue;
          }

          if (
            event.type === 'response.output_item.done' &&
            event.item?.type === 'function_call'
          ) {
            pendingToolCall = {
              toolCallId: event.item.callId || event.item.id || '',
              toolName: event.item.name || '',
              arguments: event.item.arguments || '',
            };
            emitToolCall();
            continue;
          }

          if (event.type === 'response.completed') {
            const flowchartCall = (event.response.output as any[])?.find(
              (item: any) =>
                item?.type === 'function_call' &&
                item?.name === 'generate_flowchart'
            );

            if (flowchartCall) {
              pendingToolCall = {
                toolCallId: flowchartCall.callId || flowchartCall.id || '',
                toolName: flowchartCall.name,
                arguments: flowchartCall.arguments || '',
              };
              emitToolCall();
            }

            emitFinish(hasFlowchartToolCall);
          }
        }

        if (!toolCallSent) {
          emitToolCall();
        }

        if (!hasFlowchartToolCall) {
          emitFinish(false);
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error: any) {
        console.error('FlowChart API Error:', error);

        const errorData = JSON.stringify({
          type: 'error',
          error:
            error.message || 'An error occurred while processing your request.',
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(req: Request) {
  let userId: string | null = null;
  let requestedMode: AiAssistantMode = TEXT_MODE;

  try {
    // 1. 身份验证 - 要求用户登录
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Guest用户 - 禁止使用AI功能，要求登录
      return new Response(
        JSON.stringify({
          error: 'Authentication required',
          message: 'Please sign in to use AI-powered flowchart generation.',
          isGuest: true,
          redirectTo: '/auth/login',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. 检查AI使用量限制
    const usageCheck = await canUserUseAI(userId!);
    if (!usageCheck.canUse) {
      return new Response(
        JSON.stringify({
          error: 'Usage limit exceeded',
          message: `You have reached your AI usage limit. ${usageCheck.remainingUsage} of ${usageCheck.limit} requests remaining.`,
          usageInfo: usageCheck,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. 验证请求数据
    const body = await req.json();
    const { messages, aiContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const latestUserPrompt = extractLatestUserPrompt(messages);

    if (latestUserPrompt) {
      try {
        const moderationResult = await screenPromptWithCreem({
          prompt: latestUserPrompt,
          externalId: `user_${userId}_flowchart_${Date.now()}`,
        });

        if (
          moderationResult.decision === 'deny' ||
          moderationResult.decision === 'flag'
        ) {
          return new Response(
            JSON.stringify({
              error:
                moderationResult.decision === 'deny'
                  ? 'prompt_rejected'
                  : 'prompt_flagged',
              message:
                moderationResult.decision === 'deny'
                  ? 'Your prompt was rejected by our safety screening. Please revise it and try again.'
                  : 'Your prompt could not be processed by our safety screening. Please revise it and try again.',
              moderationDecision: moderationResult.decision,
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (error) {
        console.error('Creem moderation error:', error);

        return new Response(
          JSON.stringify({
            error: 'moderation_unavailable',
            message:
              'We could not complete safety screening for your prompt right now. Please try again in a moment.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 4. 准备消息
    const snapshotSummary = aiContext?.canvasSnapshot
      ? JSON.stringify(
          {
            nodes: aiContext.canvasSnapshot.nodes,
            edges: aiContext.canvasSnapshot.edges,
            metadata: aiContext.canvasSnapshot.metadata,
            description: aiContext.canvasSnapshot.description,
          },
          null,
          2
        )
      : undefined;

    requestedMode = getRequestedMode(aiContext);

    if (requestedMode === IMAGE_MODE) {
      const imageCount = countImagesInLatestUserMessage(messages);

      if (imageCount === 0) {
        console.warn(
          'Image mode request received without images. Falling back to text mode.'
        );
        requestedMode = TEXT_MODE;
      } else {
        const model = getFlowchartModelForMode(IMAGE_MODE);

        if (imageCount > 1) {
          return new Response(
            JSON.stringify({
              error: 'Only one image is supported for image_to_flowchart mode',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const agentClient = createOpenRouterAgentClient();
        const completion = agentClient.callModel({
          model,
          instructions: generateImageModeInstructions(
            snapshotSummary,
            aiContext?.lastMermaid?.code || undefined
          ),
          input: buildImageModeInput(messages, aiContext),
          tools: [flowchartTool],
          toolChoice: 'auto',
          temperature: 0.3,
          parallelToolCalls: false,
          maxOutputTokens: 4096,
          stopWhen: hasToolCall('generate_flowchart'),
        });

        console.log('✅ OpenRouter Agent SDK image call prepared');
        return createFlowchartAgentStreamResponse(completion);
      }
    }

    const instructions = `${generateSystemPrompt(
      snapshotSummary,
      aiContext?.lastMermaid?.code || undefined
    )}

STREAMING REQUIREMENT:
- Before calling generate_flowchart, first write a visible assistant message to the user.
- The visible message must be streamed as normal assistant text and must not be empty.
- Only after that visible text has been emitted should you call generate_flowchart.
- A good concise default is: "I am mapping your flowchart now."`;
    const input = buildTextModeInput(messages, aiContext);
    const model = getFlowchartModelForMode(requestedMode);

    console.log(
      `🚀 Starting AI conversation with ${messages.length} messages (User)`
    );

    const agentClient = createOpenRouterAgentClient();
    const completion = agentClient.callModel({
      model: model,
      instructions,
      input,
      tools: [flowchartTool],
      toolChoice: 'auto',
      temperature: 0.7,
      parallelToolCalls: false,
      maxOutputTokens: 4096,
      stopWhen: hasToolCall('generate_flowchart'),
    });

    console.log('✅ OpenRouter Agent SDK call prepared, starting stream');

    // 6. 记录AI使用情况 - 移除这里的计费，改为在流程图成功生成后计费
    // if (isGuestUser) {
    //   await recordGuestAIUsage(req, 'flowchart_generation', true);
    // } else {
    //   await recordAIUsage(userId!, 'flowchart_generation', {
    //     tokensUsed: 0,
    //     model: model,
    //     success: true,
    //     metadata: {
    //       messageCount: messages.length,
    //       mode: requestedMode,
    //     },
    //   });
    // }

    return createFlowchartAgentStreamResponse(completion);
  } catch (error: any) {
    console.error('FlowChart API Error:', error);

    // 移除这里的计费，改为在流程图成功生成后计费
    // try {
    //   await recordAIUsage(userId, 'flowchart_generation', {
    //     tokensUsed: 0,
    //     model: getFlowchartModelForMode(requestedMode),
    //     success: false,
    //     errorMessage: error.message,
    //     metadata: { mode: requestedMode },
    //   });
    // } catch (recordError) {
    //   console.error('Failed to record AI usage:', recordError);
    // }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
