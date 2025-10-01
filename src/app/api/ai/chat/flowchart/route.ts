import { canUserUseAI, recordAIUsage } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import { canGuestUseAI, recordGuestAIUsage } from '@/lib/guest-usage';
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
          description: 'Valid Mermaid flowchart code',
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
function generateSystemPrompt(canvasSummary?: string, lastMermaid?: string) {
  const contextSection = [
    canvasSummary
      ? `CURRENT CANVAS SNAPSHOT (JSON):\n${canvasSummary}`
      : 'CURRENT CANVAS SNAPSHOT: none provided',
    lastMermaid
      ? `LATEST AI MERMAID (may be outdated if user edited manually):\n\n\`\`\`mermaid\n${lastMermaid}\n\`\`\``
      : 'LATEST AI MERMAID: none recorded',
  ].join('\n\n');

  return `You are FlowChart AI, an expert at creating flowcharts using Mermaid syntax.

${contextSection}

CORE RULES:
- There is exactly one tool available: **generate_flowchart**
- When user asks to create/generate/modify a flowchart → call generate_flowchart
- Use the provided canvas snapshot and previous Mermaid to understand the current diagram BEFORE generating anything new；不要再请求其他工具
- Follow the requested mode if supplied ("replace" to overwrite existing AI elements, "extend" to build onto the current flowchart); if mode is absent, infer it from user intent and canvas state
- For general chat or explanations → respond以普通文本
- Always output valid Mermaid syntax via generate_flowchart; keep结构清晰、语义准确

IMPORTANT RESPONSE GUIDELINES:
- 当调用 generate_flowchart 时，不要在回复里直接展示 Mermaid 代码，只需解释内容
- 清晰说明新增或更新的节点/分支，并提示用户可继续改动
- 确保生成的流程图遵守用户明确的约束（命名/节点数量/流程步骤等）

MODE BEHAVIOR:
- **replace**: 用户想要重建或替换已有流程 → 清除旧的 AI 元素并重新生成完整流程
- **extend**: 用户想在现有流程基础上添加/修改 → 保留现有节点，仅增量新增或更新相关部分
- 如果画布不存在 AI 节点或提示明确要求 "全新"，请选择 replace；若画布已有 AI 节点且用户描述为“新增/扩展/在…基础上”，则倾向 extend

Be helpful, clear, and educational in all responses.`;
}

export async function POST(req: Request) {
  let userId: string | null = null;
  let isGuestUser = false;

  try {
    // 1. 身份验证 - 支持guest用户
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Guest user - check if they can use AI
      isGuestUser = true;
      const guestCheck = await canGuestUseAI(req);

      if (!guestCheck.canUse) {
        return new Response(
          JSON.stringify({
            error: 'Guest usage limit exceeded',
            message:
              guestCheck.reason ||
              'Guest users can only use AI once per month. Please sign up for more requests.',
            isGuest: true,
            lastUsed: guestCheck.lastUsed,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 2. 检查AI使用量限制 (仅对登录用户)
    if (!isGuestUser) {
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
    }

    // 3. 验证请求数据
    const body = await req.json();
    const {
      messages,
      model = 'google/gemini-2.5-flash',
      aiContext,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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

    const systemMessage = {
      role: 'system' as const,
      content: generateSystemPrompt(
        snapshotSummary,
        aiContext?.lastMermaid?.code || undefined
      ),
    };

    const contextMessages: Array<{ role: 'system' | 'assistant'; content: string }> = [];

    if (aiContext?.requestedMode) {
      contextMessages.push({
        role: 'system',
        content: `Requested mode from UI: ${aiContext.requestedMode}`,
      });
    }

    const fullMessages = [systemMessage, ...contextMessages, ...messages];

    // 5. 调用 OpenRouter API
    const openai = createOpenAIClient();

    console.log(
      `🚀 Starting AI conversation with ${fullMessages.length} messages (${isGuestUser ? 'Guest' : 'User'})`
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

    // 6. 记录AI使用情况
    if (isGuestUser) {
      await recordGuestAIUsage(req, 'flowchart_generation', true);
    } else {
      await recordAIUsage(userId!, 'flowchart_generation', {
        tokensUsed: 0,
        model: model,
        success: true,
        metadata: {
          messageCount: messages.length,
        },
      });
    }

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
          if (isGuestUser) {
            await recordGuestAIUsage(req, 'flowchart_generation', false);
          } else if (userId) {
            await recordAIUsage(userId, 'flowchart_generation', {
              tokensUsed: 0,
              model: model,
              success: false,
              errorMessage: error.message,
              metadata: { messageCount: messages.length },
            });
          }

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

    // Record failed usage if we have userId or is guest
    if (isGuestUser) {
      try {
        await recordGuestAIUsage(req, 'flowchart_generation', false);
      } catch (recordError) {
        console.error('Failed to record guest AI usage:', recordError);
      }
    } else if (userId) {
      try {
        await recordAIUsage(userId, 'flowchart_generation', {
          tokensUsed: 0,
          model: 'google/gemini-2.5-flash',
          success: false,
          errorMessage: error.message,
          metadata: {},
        });
      } catch (recordError) {
        console.error('Failed to record AI usage:', recordError);
      }
    }

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
