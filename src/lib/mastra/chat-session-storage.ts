import type { AiAssistantMode } from '@/lib/ai-modes';

export interface CanvasChatMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface CanvasChatMessage {
  id: string;
  content: string | CanvasChatMessageContent[];
  role: 'user' | 'assistant';
  timestamp: Date;
  isFlowchart?: boolean;
  mermaidCode?: string;
  error?: string;
}

export interface CanvasChatSession {
  version: number;
  draft: string;
  mode: AiAssistantMode;
  messages: CanvasChatMessage[];
}

const STORAGE_PREFIX = 'flowchartai:canvas-chat';
const UNSAVED_FLOWCHART_KEY = 'unsaved';

export function getCanvasChatStorageKey(flowchartId?: string): string {
  return `${STORAGE_PREFIX}:${flowchartId || UNSAVED_FLOWCHART_KEY}`;
}

export function serializeCanvasChatSession(session: CanvasChatSession): string {
  return JSON.stringify(session);
}

function isCanvasChatMessage(value: unknown): value is CanvasChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    (typeof message.content === 'string' || Array.isArray(message.content)) &&
    typeof message.timestamp === 'string'
  );
}

export function parseCanvasChatSession(
  serialized: string | null
): CanvasChatSession | null {
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    if (
      parsed.version !== 1 ||
      typeof parsed.draft !== 'string' ||
      typeof parsed.mode !== 'string' ||
      !Array.isArray(parsed.messages) ||
      !parsed.messages.every(isCanvasChatMessage)
    ) {
      return null;
    }

    return {
      version: 1,
      draft: parsed.draft,
      mode: parsed.mode as AiAssistantMode,
      messages: parsed.messages.map((message) => ({
        ...message,
        timestamp: new Date(message.timestamp),
      })),
    };
  } catch {
    return null;
  }
}

export function buildRetryConversation(
  messages: CanvasChatMessage[],
  failedAssistantId: string
): CanvasChatMessage[] | null {
  const failedIndex = messages.findIndex(
    (message) =>
      message.id === failedAssistantId && message.role === 'assistant'
  );
  if (failedIndex < 0) return null;

  for (let index = failedIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return messages.slice(0, index + 1);
    }
  }

  return null;
}
