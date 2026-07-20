import type { AiAssistantMode } from '@/lib/ai-modes';

interface IncomingMessage {
  role?: string;
  content?: unknown;
  tool_calls?: unknown;
}

interface BuildMastraRequestInput {
  mode: AiAssistantMode;
  messages: IncomingMessage[];
  requestedMode?: string;
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) {
    if (content == null) return '';
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }

  return content
    .map((part: any) => {
      if (part?.type === 'text') return part.text || '';
      if (part?.type === 'image_url') return '[Image attached]';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export function buildGatewayModelId(model: string): string {
  const normalized = model.trim();
  if (!normalized) throw new Error('Flowchart model id is not configured');
  return normalized.startsWith('openrouter/')
    ? normalized
    : `openrouter/${normalized}`;
}

export function buildMastraRequestMessages({
  mode,
  messages,
  requestedMode,
}: BuildMastraRequestInput): string | Array<Record<string, unknown>> {
  if (mode !== 'image_to_flowchart') {
    const transcript = messages
      .slice(-12)
      .map((message) => {
        const role =
          typeof message.role === 'string' ? message.role : 'unknown';
        const content = stringifyMessageContent(message.content).trim();
        const toolCalls = Array.isArray(message.tool_calls)
          ? `\nTool calls: ${JSON.stringify(message.tool_calls)}`
          : '';
        return `${role.toUpperCase()}:\n${content}${toolCalls}`;
      })
      .join('\n\n');
    const requested = requestedMode
      ? `\n\nRequested mode from UI: ${requestedMode}`
      : '';
    return `Conversation transcript:\n${transcript}${requested}\n\nUse the latest user message as the active request.`;
  }

  const latestUser = [...messages]
    .reverse()
    .find(
      (message) => message.role === 'user' && Array.isArray(message.content)
    );
  const parts = Array.isArray(latestUser?.content) ? latestUser.content : [];
  const imageUrls = parts
    .filter(
      (part: any) =>
        part?.type === 'image_url' && typeof part.image_url?.url === 'string'
    )
    .map((part: any) => part.image_url.url as string);

  if (imageUrls.length !== 1) {
    throw new Error('Image mode supports exactly one image');
  }

  const text = parts
    .filter(
      (part: any) => part?.type === 'text' && typeof part.text === 'string'
    )
    .map((part: any) => part.text as string)
    .join('\n')
    .trim();
  const requested = requestedMode
    ? `\n\nRequested mode from UI: ${requestedMode}`
    : '';

  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${text || 'Convert the uploaded image into a Mermaid flowchart.'}${requested}\n\nRead the attached image and reconstruct the diagram.`,
        },
        { type: 'image', image: imageUrls[0] },
      ],
    },
  ];
}
