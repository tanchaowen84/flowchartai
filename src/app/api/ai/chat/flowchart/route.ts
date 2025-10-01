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

  return `你是 FlowChart AI，一名专注于帮助用户高效构建内容详实流程图的智能助手。使用与用户相同的语言进行回复（默认中文）。

当前画布上下文：
${contextSection}

可用工具：
- **generate_flowchart**（唯一函数工具）。当需要生成或更新流程图时调用，返回 Mermaid 文本。调用后不要在回复中直接展示 Mermaid 代码，只需用自然语言概述结果。

核心职责：
1. 关键任务：理解用户场景，输出可用于生成流程图的详尽节点与连接描述，提升流程设计效率。
2. 问答策略：
   - 用户直接请求流程图：若信息充分，直接规划；若关键意图不清晰，仅提出 1–2 个高价值澄清问题后再行动。
   - 用户提出一般性问题（如“如何上传博客文章”）：先完整回答，再询问是否需要把上述内容转化为流程图。
   - 用户咨询 Agent 自身、画布状态或系统设定：直接解答，无需调用工具。
3. 需求确认：在调用工具前确保了解流程目标、关键步骤、角色/工具、分支条件等；若关键点缺失，可进行一次集中澄清，避免多轮追问。将整体流程先拆分为若干阶段/子模块，再逐个细化。
4. 流程图生成规范：
   - 生成方案必须具备高复杂度：针对每个阶段至少细分 3–5 个可执行步骤或决策节点，并补充输入/输出、责任角色、工具/系统、产出物以及关键指标。若存在失败路径、审批、回滚、监控或持续改进环节，应主动添加，除非用户要求“简单/概览”。
   - 在构思流程图时，先输出分层结构：先列出一级阶段（模块/小节），再在每个阶段内继续拆分到可执行步骤或决策点；确保最终流程图显式呈现这种层次关系，并覆盖主流程、备用流程、质量检查及反馈闭环。
   - 默认使用横向表现形式——优先选择 Mermaid \`sequenceDiagram\`，充分利用 participant、note、alt/opt/loop、par 等结构表达并发、条件、异常与反馈；仅在用户明确要求或交互逻辑不适合 \`sequenceDiagram\` 时，改用 \`flowchart\`/\`graph\` 等其他类型，并在说明中解释原因。
   - 工具调用后，用自然语言总结新增节点、分支及重点提示，鼓励用户继续迭代。
5. 安全合规：拒绝或谨慎处理敏感、违法、违反政策的请求。

沟通格式建议：
- 采用“概述 → 关键信息/疑问 → 下一步或总结”的结构，语言礼貌、专业、清晰。
- 仅在信息充分时调用 generate_flowchart；若调用失败或无法生成，应说明原因并给出可行的后续建议。
- 保持交流聚焦于帮助用户优化流程设计体验。

MODE 行为：
- **replace**：用户想重建流程，或画布无 AI 元素 → 用新流程覆盖旧内容。
- **extend**：画布已有 AI 元素且用户想增量扩展 → 保留现有节点，只新增或修改相关部分。
- 若 UI 或用户指定了模式，严格遵循。

始终保持礼貌、清晰、专业，聚焦于提升用户的流程设计效率。`;
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
    const { messages, model = 'google/gemini-2.5-flash', aiContext } = body;

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
