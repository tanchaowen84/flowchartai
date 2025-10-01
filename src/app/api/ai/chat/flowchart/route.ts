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

// 画布状态分析工具定义
const canvasAnalysisTool = {
  type: 'function' as const,
  function: {
    name: 'get_canvas_state',
    description:
      'Get detailed analysis of current canvas elements, including user modifications and all elements on the canvas. Use this to understand what is currently drawn before making modifications.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// 系统提示词
function generateSystemPrompt() {
  return `You are FlowChart AI, an expert at creating flowcharts using Mermaid syntax.

AVAILABLE TOOLS:
- generate_flowchart: Create or update flowcharts using Mermaid syntax
- get_canvas_state: Get detailed analysis of current canvas elements (use this to understand what's currently drawn)

CORE RULES:
- If user asks to create, generate, draw, make, design, or modify a flowchart/diagram → use generate_flowchart tool
- If you need to understand the current canvas state → use get_canvas_state tool first
- If user asks to analyze, describe, or explain the canvas → use get_canvas_state tool and provide natural, conversational analysis
- For general questions or chat → respond normally with text
- Always generate valid Mermaid syntax when using the flowchart tool
- Keep flowcharts clear, well-structured, and easy to understand

IMPORTANT RESPONSE GUIDELINES:
- When generating flowcharts, DO NOT show or mention Mermaid code in your response
- Focus on explaining what the flowchart represents and its purpose
- The flowchart will be automatically added to the canvas - you don't need to tell users how to add it
- Provide natural, conversational explanations about the process or workflow you created
- Ask users if they want any modifications or improvements

FLOWCHART GENERATION MODES:
- **replace**: Clear existing AI elements and create new flowchart (when starting fresh)
- **extend**: Add to or modify existing flowchart (when building on current content)

Be helpful, clear, and educational in all your responses!`;
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
    const systemMessage = {
      role: 'system',
      content: generateSystemPrompt(),
    };

    const contextMessages = [] as Array<{ role: 'system' | 'assistant'; content: string }>;

    if (aiContext?.canvasSnapshot) {
      const snapshotSummary = {
        nodes: aiContext.canvasSnapshot.nodes?.map((node: any) => ({
          id: node.id,
          type: node.type,
          text: node.text,
          aiGenerated: node.aiGenerated,
        })),
        edges: aiContext.canvasSnapshot.edges?.map((edge: any) => ({
          id: edge.id,
          from: edge.fromElement,
          to: edge.toElement,
          label: edge.label,
          aiGenerated: edge.aiGenerated,
        })),
        metadata: aiContext.canvasSnapshot.metadata,
        description: aiContext.canvasSnapshot.description,
      };
      contextMessages.push({
        role: 'system',
        content: `Current canvas snapshot (JSON):\n${JSON.stringify(snapshotSummary, null, 2)}`,
      });
    }

    if (aiContext?.lastMermaid?.code) {
      contextMessages.push({
        role: 'system',
        content: `Previous AI-generated Mermaid (may be outdated if user modified canvas):\n\n\`\`\`mermaid\n${aiContext.lastMermaid.code}\n\`\`\``,
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
      tools: [flowchartTool, canvasAnalysisTool],
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
