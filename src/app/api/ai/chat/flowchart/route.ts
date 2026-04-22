import { canUserUseAI, recordAIUsage } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import {
  extractLatestUserPrompt,
  screenPromptWithCreem,
} from '@/lib/creem-moderation';
import { IMAGE_TO_FLOWCHART_PROMPT } from '@/lib/prompts/image-flowchart';
import { headers } from 'next/headers';
import OpenAI from 'openai';

// OpenRouter 客户端配置
function createOpenAIClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'FlowChart AI',
    },
  });
}

// 流程图生成工具定义
const flowchartTool = {
  type: 'function' as const,
  function: {
    name: 'generate_flowchart',
    description: 'Generate or update a flowchart using Mermaid syntax',
    parameters: {
      type: 'object',
      properties: {
        mermaid_code: {
          type: 'string',
          description:
            'Valid Mermaid flowchart code. CRITICAL: NO special symbols in node text: ()（）【】《》「」\'\'"":;，。！？',
        },
        mode: {
          type: 'string',
          enum: ['replace', 'extend'],
          description:
            'Whether to replace existing flowchart completely or extend/modify it based on existing content',
        },
        description: {
          type: 'string',
          description: 'Brief description of the flowchart',
        },
      },
      required: ['mermaid_code', 'mode', 'description'],
    },
  },
};

// 系统提示词
type AiAssistantMode = 'text_to_flowchart' | 'image_to_flowchart';

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

function extractJsonFromContent(rawContent: string): string {
  const trimmed = rawContent.trim();

  if (trimmed.startsWith('```')) {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }
  }

  return trimmed;
}

function normalizeMermaidCode(mermaid: string): string {
  return mermaid
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/"/g, "'");
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
    const { messages, model = 'x-ai/grok-4-fast', aiContext } = body;

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

    // 5. 调用 OpenRouter API
    const openai = createOpenAIClient();

    if (requestedMode === IMAGE_MODE) {
      const imageCount = countImagesInLatestUserMessage(messages);

      if (imageCount === 0) {
        console.warn(
          'Image mode request received without images. Falling back to text mode.'
        );
        requestedMode = TEXT_MODE;
      } else {
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

        const recordImageUsage = async (
          success: boolean,
          errorMessage?: string
        ) => {
          // 图片模式的计费应该在前端渲染成功后进行，保持与文本模式一致
          // 这里只记录错误情况，成功计费在前端处理
          if (!success && userId) {
            try {
              await recordAIUsage(userId, 'flowchart_generation', {
                tokensUsed: 0,
                model: model,
                success: false,
                errorMessage,
                metadata: {
                  messageCount: messages.length,
                  mode: 'image_to_flowchart',
                  imageMode: true,
                },
              });
              console.log(
                '❌ Image to flowchart error recorded for user:',
                userId
              );
            } catch (recordError) {
              console.error(
                'Failed to record image flowchart error:',
                recordError
              );
            }
          }
        };

        const completion = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'system' as const,
              content: IMAGE_TO_FLOWCHART_PROMPT,
            },
            ...messages,
          ],
          temperature: 0.3,
          stream: false,
        });

        const rawContent = completion.choices[0]?.message?.content;

        let responseText = '';
        if (Array.isArray(rawContent)) {
          responseText = rawContent
            .map((item) => (item?.type === 'text' ? item.text : ''))
            .join('')
            .trim();
        } else if (typeof rawContent === 'string') {
          responseText = rawContent.trim();
        }

        if (!responseText) {
          await recordImageUsage(false, 'Model returned empty response');
          return new Response(
            JSON.stringify({ error: 'Model returned empty response' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const normalizedJson = extractJsonFromContent(responseText);

        if (!normalizedJson) {
          await recordImageUsage(false, 'Model returned empty response');
          return new Response(
            JSON.stringify({ error: 'Model returned empty response' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        let parsedResult: {
          mermaid?: string;
          title?: string;
          notes?: string;
        };

        try {
          parsedResult = JSON.parse(normalizedJson);
        } catch (error) {
          console.error('Failed to parse image flowchart JSON:', responseText);
          await recordImageUsage(false, 'Failed to parse AI response as JSON');
          return new Response(
            JSON.stringify({
              error: 'Failed to parse AI response as JSON',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (!parsedResult?.mermaid) {
          await recordImageUsage(false, 'AI response missing mermaid code');
          return new Response(
            JSON.stringify({
              error: 'AI response missing mermaid code',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const description = parsedResult.title
          ? `Generated from image: ${parsedResult.title}`
          : 'Generated flowchart from image';

        const mermaidCode = normalizeMermaidCode(parsedResult.mermaid);

        const encoder = new TextEncoder();
        const summaryContent = parsedResult.notes
          ? parsedResult.notes
          : 'Generated flowchart from the uploaded image.';

        const stream = new ReadableStream({
          start(controller) {
            const textPayload = JSON.stringify({
              type: 'text',
              content: summaryContent,
            });
            controller.enqueue(encoder.encode(`data: ${textPayload}\n\n`));

            const toolPayload = JSON.stringify({
              type: 'tool-call',
              toolCallId: `image-flowchart-${Date.now()}`,
              toolName: 'generate_flowchart',
              args: {
                mermaid_code: mermaidCode,
                mode: 'replace',
                description,
              },
            });
            controller.enqueue(encoder.encode(`data: ${toolPayload}\n\n`));

            const finishPayload = JSON.stringify({
              type: 'finish',
              content: summaryContent,
              toolCallsCompleted: true,
            });
            controller.enqueue(encoder.encode(`data: ${finishPayload}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });

        // 图片模式成功，计费将在前端渲染成功后进行
        // await recordImageUsage(true); // 不在这里计费，保持与文本模式一致

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }
    }

    const systemMessage = {
      role: 'system' as const,
      content: generateSystemPrompt(
        snapshotSummary,
        aiContext?.lastMermaid?.code || undefined
      ),
    };

    const contextMessages: Array<{
      role: 'system' | 'assistant';
      content: string;
    }> = [];

    if (aiContext?.requestedMode) {
      contextMessages.push({
        role: 'system',
        content: `Requested mode from UI: ${aiContext.requestedMode}`,
      });
    }

    const fullMessages = [systemMessage, ...contextMessages, ...messages];

    console.log(
      `🚀 Starting AI conversation with ${fullMessages.length} messages (User)`
    );

    const completion = await openai.chat.completions.create({
      model: model,
      messages: fullMessages,
      tools: [flowchartTool],
      tool_choice: 'auto',
      temperature: 0.7,
      stream: true,
    });

    console.log('✅ OpenRouter API call successful, starting stream');

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

    // 7. 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const toolCalls: any[] = [];
          let accumulatedContent = '';

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              accumulatedContent += delta.content;
              const data = JSON.stringify({
                type: 'text',
                content: delta.content,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (!toolCalls[toolCall.index]) {
                  toolCalls[toolCall.index] = {
                    id: toolCall.id,
                    type: toolCall.type,
                    function: { name: '', arguments: '' },
                  };
                }

                if (toolCall.function?.name) {
                  toolCalls[toolCall.index].function.name =
                    toolCall.function.name;
                }

                if (toolCall.function?.arguments) {
                  toolCalls[toolCall.index].function.arguments +=
                    toolCall.function.arguments;
                }
              }
            }

            if (chunk.choices[0]?.finish_reason === 'tool_calls') {
              // 处理工具调用
              for (const toolCall of toolCalls) {
                if (toolCall.function.name === 'generate_flowchart') {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const data = JSON.stringify({
                      type: 'tool-call',
                      toolCallId: toolCall.id,
                      toolName: 'generate_flowchart',
                      args: args,
                    });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  } catch (error) {
                    console.error('Error parsing flowchart args:', error);
                  }
                } else if (toolCall.function.name === 'get_canvas_state') {
                  const data = JSON.stringify({
                    type: 'tool-call',
                    toolCallId: toolCall.id,
                    toolName: 'get_canvas_state',
                    args: {},
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }

              // 发送完成信号
              const finishData = JSON.stringify({
                type: 'finish',
                content:
                  accumulatedContent || 'Tool calls completed successfully.',
                toolCallsCompleted: true,
              });
              controller.enqueue(encoder.encode(`data: ${finishData}\n\n`));
            } else if (chunk.choices[0]?.finish_reason === 'stop') {
              // 普通对话完成
              const finishData = JSON.stringify({
                type: 'finish',
                content: accumulatedContent || 'Conversation completed.',
              });
              controller.enqueue(encoder.encode(`data: ${finishData}\n\n`));
            }
          }

          // 发送结束信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error: any) {
          console.error('FlowChart API Error:', error);

          // Record failed usage
          // 移除这里的计费，改为在流程图成功生成后计费
          // if (isGuestUser) {
          //   await recordGuestAIUsage(req, 'flowchart_generation', false);
          // } else if (userId) {
          //   await recordAIUsage(userId, 'flowchart_generation', {
          //     tokensUsed: 0,
          //     model: model,
          //     success: false,
          //     errorMessage: error.message,
          //     metadata: { messageCount: messages.length, mode: requestedMode },
          //   });
          // }

          const errorData = JSON.stringify({
            type: 'error',
            error:
              error.message ||
              'An error occurred while processing your request.',
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
  } catch (error: any) {
    console.error('FlowChart API Error:', error);

    // 移除这里的计费，改为在流程图成功生成后计费
    // try {
    //   await recordAIUsage(userId, 'flowchart_generation', {
    //     tokensUsed: 0,
    //     model: 'google/gemini-2.5-flash',
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
