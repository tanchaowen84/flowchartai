export interface SseEventDecoder {
  push: (chunk: Uint8Array) => unknown[];
  finish: () => unknown[];
}

function parseEventBlock(block: string): unknown | null {
  const payload = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!payload) return null;
  if (payload === '[DONE]') return payload;
  return JSON.parse(payload);
}

export function createSseEventDecoder(): SseEventDecoder {
  const decoder = new TextDecoder();
  let buffer = '';

  const drain = (flush: boolean): unknown[] => {
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = flush ? '' : blocks.pop() || '';
    const completed = flush ? blocks.filter(Boolean) : blocks;
    const events: unknown[] = [];
    for (const block of completed) {
      const event = parseEventBlock(block);
      if (event !== null) events.push(event);
    }
    return events;
  };

  return {
    push(chunk): unknown[] {
      buffer += decoder.decode(chunk, { stream: true });
      return drain(false);
    },
    finish(): unknown[] {
      buffer += decoder.decode();
      return drain(true);
    },
  };
}
