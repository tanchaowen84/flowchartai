import { expect, it, vi } from 'vitest';
import { createNativeModel } from './native-model';

it('actually forwards optional thinking control in the outbound HTTP request', async () => {
  vi.stubEnv('FLOWCHART_TEXT_MODEL', 'deepseek/deepseek-v4-pro');
  let body: any;
  try {
    const model = createNativeModel('text_to_flowchart', {
      apiKey: 'test-only',
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: 'test',
            object: 'chat.completion',
            created: 1,
            model: 'deepseek/deepseek-v4-pro',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'ok' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });
    await model.doGenerate({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'test transport' }] },
      ],
      maxOutputTokens: 16000,
    });
    expect(body.model).toBe('deepseek/deepseek-v4-pro');
    expect(body.reasoning).toEqual({ enabled: false });
    expect(body.max_tokens).toBe(16000);
  } finally {
    vi.unstubAllEnvs();
  }
});
