type ChatMessageContentPart = {
  type?: string;
  text?: string;
};

type ChatMessageLike = {
  role?: string;
  content?: string | ChatMessageContentPart[] | null;
};

export type CreemModerationDecision = 'allow' | 'flag' | 'deny';

export interface CreemModerationResult {
  id: string;
  object: string;
  prompt: string;
  external_id?: string;
  decision: CreemModerationDecision;
  usage?: {
    units?: number;
  };
}

const DEFAULT_CREEM_MODERATION_TIMEOUT_MS = 5000;

function getModerationTimeoutMs(): number {
  const rawTimeout = process.env.CREEM_MODERATION_TIMEOUT_MS;

  if (!rawTimeout) {
    return DEFAULT_CREEM_MODERATION_TIMEOUT_MS;
  }

  const parsedTimeout = Number.parseInt(rawTimeout, 10);

  if (Number.isNaN(parsedTimeout) || parsedTimeout <= 0) {
    return DEFAULT_CREEM_MODERATION_TIMEOUT_MS;
  }

  return parsedTimeout;
}

function getLatestUserContent(messages: unknown[]): ChatMessageLike['content'] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as ChatMessageLike | undefined;

    if (message?.role === 'user') {
      return message.content ?? null;
    }
  }

  return null;
}

export function extractLatestUserPrompt(messages: unknown[]): string {
  const content = getLatestUserContent(messages);

  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter(
      (part): part is ChatMessageContentPart =>
        part?.type === 'text' && typeof part.text === 'string'
    )
    .map((part) => part.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join('\n')
    .trim();
}

export async function screenPromptWithCreem(params: {
  prompt: string;
  externalId?: string;
}): Promise<CreemModerationResult> {
  const apiKey = process.env.CREEM_API_KEY;
  const apiUrl = process.env.CREEM_API_URL;

  if (!apiKey || !apiUrl) {
    throw new Error('Missing Creem moderation configuration.');
  }

  const response = await fetch(`${apiUrl}/v1/moderation/prompt`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      external_id: params.externalId,
    }),
    signal: AbortSignal.timeout(getModerationTimeoutMs()),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Creem moderation request failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`
    );
  }

  const result = (await response.json()) as Partial<CreemModerationResult>;

  if (
    result.decision !== 'allow' &&
    result.decision !== 'flag' &&
    result.decision !== 'deny'
  ) {
    throw new Error('Creem moderation response missing a valid decision.');
  }

  return result as CreemModerationResult;
}
