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

// 动态生成系统提示词的函数
function generateSystemPrompt(canvasState: any) {
  const hasExistingFlowchart = canvasState?.existingMermaid;

  let prompt = `You are FlowChart AI, an expert at creating flowcharts using Mermaid syntax.

RULES:
- If user asks to create, generate, draw, make, design, or modify a flowchart/diagram → use generate_flowchart tool
- If user asks general questions, wants to chat, or discusses non-flowchart topics → respond normally with text
- Always generate valid Mermaid syntax when using the tool
- Keep flowcharts clear, well-structured, and easy to understand
- Use appropriate Mermaid diagram types (flowchart, graph, sequence, etc.)
- Use Chinese text in flowchart nodes when user communicates in Chinese

MODE SELECTION:
- Use "replace" mode when user wants to create a completely new flowchart or start over
- Use "extend" mode when user wants to modify, add to, or improve existing flowchart

REPLACE MODE triggers (use mode: "replace"):
- "Draw a new flowchart..."
- "Create a fresh diagram..."
- "Start over with..."
- "Replace this with..."

EXTEND MODE triggers (use mode: "extend"):
- "Add to this flowchart..."
- "Modify the diagram to include..."
- "Update the flowchart with..."
- "Improve this by adding..."`;

  if (hasExistingFlowchart) {
    prompt += `

CURRENT CANVAS STATE:
There is an existing flowchart on the canvas:
\`\`\`mermaid
${canvasState.existingMermaid}
\`\`\`

When using "extend" mode:
- Base your modifications on the existing flowchart above
- Keep the original structure and logic intact
- Add new nodes/connections as requested
- Generate a complete updated version that includes both old and new content

When using "replace" mode:
- Ignore the existing flowchart
- Create a completely new diagram based on user's request`;
  } else {
    prompt += `

CURRENT CANVAS STATE:
The canvas is currently empty. All requests will use "replace" mode to create new flowcharts.`;
  }

  prompt += `

When generating Mermaid code:
- Use 'flowchart TD' for top-down flowcharts
- Use clear, descriptive node labels
- Include decision points with diamond shapes {}
- Use appropriate arrow labels for conditions
- Keep the structure logical and easy to follow`;

  return prompt;
}

export async function POST(req: Request) {
  try {
    const { messages, canvasState } = await req.json();

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

    // 生成动态系统提示词
    const systemPrompt = generateSystemPrompt(canvasState);

    // 构建完整的消息数组
    const fullMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages,
    ];

    // 调用 OpenRouter API
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash-preview-05-20',
      messages: fullMessages,
      tools: [flowchartTool],
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
              // 发送工具调用信息
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

                    // 发送工具调用结果
                    const resultData = JSON.stringify({
                      type: 'tool-result',
                      toolCallId: toolCall.id,
                      result: 'Flowchart generated successfully!',
                    });
                    controller.enqueue(
                      encoder.encode(`data: ${resultData}\n\n`)
                    );
                  } catch (error) {
                    console.error('Error parsing tool call arguments:', error);
                  }
                }
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
