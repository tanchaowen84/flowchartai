import { generateAICanvasDescription } from '@/lib/canvas-analyzer';
import OpenAI from 'openai';

// OpenRouter 客户端配置
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    'X-Title': 'FlowChart AI',
  },
});

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

// 简化的系统提示词，不再依赖预传递的画布状态
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

CANVAS ANALYSIS APPROACH:
When analyzing canvas content, be natural and conversational. Focus on:
- What the diagram represents and its purpose
- The flow and relationships between elements  
- Key insights about the process or workflow
- Practical suggestions for improvement
- Avoid rigid formatting - just have a natural conversation about what you see

FLOWCHART GENERATION MODES:
- **replace**: Clear existing AI elements and create new flowchart (when starting fresh)
- **extend**: Add to or modify existing flowchart (when building on current content)
- **new**: Create flowchart on empty canvas (default)

Be helpful, clear, and educational in all your responses!`;
}

// 工具调用完成后继续对话的函数
async function continueConversationAfterToolCalls(
  originalMessages: any[],
  toolCalls: any[],
  toolResults: any[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  try {
    // 构建包含工具调用和结果的消息历史
    const messagesWithToolCalls = [
      ...originalMessages,
      {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      ...toolResults,
    ];

    // 重新调用AI API，让它基于工具结果继续生成回复
    const followUpCompletion = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash-preview-05-20',
      messages: messagesWithToolCalls,
      temperature: 0.7,
      stream: true,
    });

    // 流式传输AI的后续回复
    for await (const chunk of followUpCompletion) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        const data = JSON.stringify({
          type: 'text',
          content: delta.content,
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        // Don't send a finish message that would overwrite the accumulated content
        // Just break to end the stream naturally
        break;
      }
    }
  } catch (error) {
    console.error('Error in follow-up conversation:', error);
    const errorData = JSON.stringify({
      type: 'error',
      error: 'Failed to generate follow-up response after tool call.',
    });
    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // 验证请求数据
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    // 验证 API Key
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 生成系统提示词
    const systemPrompt = generateSystemPrompt();

    // 构建完整的消息数组
    const fullMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages,
    ];

    // 调用 OpenRouter API
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash-preview-05-20',
      messages: fullMessages,
      tools: [flowchartTool, canvasAnalysisTool],
      tool_choice: 'auto',
      temperature: 0.7,
      stream: true,
    });

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          const toolCalls: any[] = [];

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              fullResponse += delta.content;
              // 发送文本内容
              const data = JSON.stringify({
                type: 'text',
                content: delta.content,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.index !== undefined) {
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
            }

            // 检查是否完成
            if (chunk.choices[0]?.finish_reason === 'tool_calls') {
              // 执行工具调用并准备继续对话
              const toolResults: any[] = [];

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

                    // 收集工具结果，稍后让AI继续对话
                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: 'Flowchart generated successfully!',
                    });
                  } catch (error) {
                    console.error('Error parsing tool call arguments:', error);
                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: 'Error generating flowchart.',
                    });
                  }
                } else if (toolCall.function.name === 'get_canvas_state') {
                  try {
                    // 对于画布状态请求，我们发送一个特殊的响应让前端处理
                    const data = JSON.stringify({
                      type: 'tool-call',
                      toolCallId: toolCall.id,
                      toolName: 'get_canvas_state',
                      args: {},
                    });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));

                    // 这里不添加工具结果，因为需要前端提供画布状态
                    // 前端会处理这个工具调用并重新发送请求
                  } catch (error) {
                    console.error(
                      'Error handling canvas state request:',
                      error
                    );
                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: 'Error requesting canvas state.',
                    });
                  }
                }
              }

              // 如果有工具调用结果（非画布状态请求），继续对话
              if (toolResults.length > 0) {
                await continueConversationAfterToolCalls(
                  fullMessages,
                  toolCalls,
                  toolResults,
                  controller,
                  encoder
                );
              }
            } else if (chunk.choices[0]?.finish_reason === 'stop') {
              // 普通对话完成
              if (fullResponse && toolCalls.length === 0) {
                const data = JSON.stringify({
                  type: 'finish',
                  content: fullResponse,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('FlowChart API Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
