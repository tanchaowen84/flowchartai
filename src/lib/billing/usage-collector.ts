import { type ModelCallUsage, creditsForCalls } from './policy';
export interface UsageCollector {
  fetch: typeof fetch;
  finish: () => Promise<ModelCallUsage[]>;
  receipts: () => Promise<ModelCallUsage[]>;
}
export function parseOpenRouterReceipt(
  text: string,
  model: string
): ModelCallUsage {
  let last: any;
  let generationId: string | undefined;
  const lines = text.trim().startsWith('{')
    ? [text]
    : text
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter((line) => line !== '[DONE]');
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      generationId = data.id ?? generationId;
      if (data.usage) last = data.usage;
    } catch {}
  }
  if (
    !last ||
    !Number.isSafeInteger(last.prompt_tokens) ||
    !Number.isSafeInteger(last.completion_tokens)
  )
    throw new Error('Provider usage receipt is missing');
  const call = {
    model,
    input: last.prompt_tokens,
    output: last.completion_tokens,
    cached: last.prompt_tokens_details?.cached_tokens ?? 0,
    reasoning: last.completion_tokens_details?.reasoning_tokens ?? 0,
    cost: typeof last.cost === 'number' ? last.cost : undefined,
    generationId,
  };
  creditsForCalls([call]);
  return call;
}
export function createUsageCollector(
  model: string,
  transport: typeof fetch = fetch
): UsageCollector {
  const pending: Promise<ModelCallUsage>[] = [];
  const wrapped: typeof fetch = async (input, init) => {
    // The wallet caps settlement. Let existing Agent step/time limits govern execution,
    // so an underestimated reservation cannot discard a complete complex diagram.
    const response = await transport(input, init);
    if (response.ok) {
      const receipt = response
        .clone()
        .text()
        .then((text) => parseOpenRouterReceipt(text, model));
      // Attach a rejection handler immediately; finish still reports incomplete receipts and prevents billing.
      receipt.catch(() => undefined);
      pending.push(receipt);
    }
    return response;
  };
  return {
    fetch: wrapped,
    finish: () => Promise.all(pending),
    receipts: async () => {
      const results = await Promise.allSettled(pending);
      return results.flatMap((r) =>
        r.status === 'fulfilled' ? [r.value] : []
      );
    },
  };
}
export function estimateTaskBudget(body: unknown): number {
  // Automatic reservation estimate; actual final charge uses provider receipts,
  // capped at this reservation. No interactive confirmation is required.
  let images = 0;
  const context = JSON.stringify(body, (key, value) => {
    if (key === 'image_url' && value && typeof value.url === 'string') {
      images++;
      return { url: '[image input]' };
    }
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      images++;
      return '[image input]';
    }
    return value;
  });
  const approximateInput =
    Math.ceil(Buffer.byteLength(context, 'utf8') / 3) + 6000 + images * 4096;
  return Math.min(2000, Math.max(32, Math.ceil(approximateInput * 0.004 + 16)));
}
