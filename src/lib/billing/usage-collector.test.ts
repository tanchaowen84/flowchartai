import { expect, it } from 'vitest';
import {
  createUsageCollector,
  estimateTaskBudget,
  parseOpenRouterReceipt,
} from './usage-collector';
it('estimates image input without treating encoded bytes as text tokens', () => {
  const image = (url: string) => ({
    messages: [
      { role: 'user', content: [{ type: 'image_url', image_url: { url } }] },
    ],
  });
  const small = estimateTaskBudget(image('data:image/png;base64,AA=='));
  const large = estimateTaskBudget(
    image(`data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}`)
  );
  expect(large).toBe(small);
  expect(large).toBeLessThanOrEqual(64);
  expect(estimateTaskBudget({ text: 'A'.repeat(100000) })).toBeGreaterThan(64);
});
it('reads final SSE usage without double-counting reasoning', () => {
  const call = parseOpenRouterReceipt(
    'data: {"id":"gen-1","usage":{"prompt_tokens":1000,"completion_tokens":500,"prompt_tokens_details":{"cached_tokens":400},"completion_tokens_details":{"reasoning_tokens":100},"cost":0.002}}\n\ndata: [DONE]\n',
    'deepseek/deepseek-v4-pro'
  );
  expect(call).toMatchObject({
    input: 1000,
    cached: 400,
    output: 500,
    reasoning: 100,
    cost: 0.002,
    generationId: 'gen-1',
  });
});
it('counts each provider call even when the final step is cheaper', async () => {
  let n = 0;
  const collector = createUsageCollector(
    'deepseek/deepseek-v4-pro',
    async () =>
      new Response(
        JSON.stringify({
          id: `gen-${++n}`,
          usage: {
            prompt_tokens: n === 1 ? 100000 : 1000,
            completion_tokens: 500,
            cost: n === 1 ? 0.02 : 0.001,
          },
        })
      )
  );
  await collector.fetch('http://fixture');
  await collector.fetch('http://fixture');
  expect(
    (await collector.finish()).reduce((sum, c) => sum + (c.cost ?? 0), 0)
  ).toBe(0.021);
});
it('refuses unknown/missing usage and does not fabricate a debit', () =>
  expect(() =>
    parseOpenRouterReceipt(
      'data: {"content":"done"}',
      'deepseek/deepseek-v4-pro'
    )
  ).toThrow());
