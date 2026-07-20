import { describe, expect, it } from 'vitest';
import {
  buildGatewayModelId,
  buildMastraRequestMessages,
} from './request-builder';

describe('Mastra request builder', () => {
  it('normalizes OpenRouter model ids exactly once', () => {
    expect(buildGatewayModelId('deepseek/deepseek-v4-flash')).toBe(
      'openrouter/deepseek/deepseek-v4-flash'
    );
    expect(buildGatewayModelId('openrouter/bytedance-seed/seed-2.0-mini')).toBe(
      'openrouter/bytedance-seed/seed-2.0-mini'
    );
  });

  it('builds a bounded text transcript for the text model path', () => {
    const result = buildMastraRequestMessages({
      mode: 'text_to_flowchart',
      messages: [
        { role: 'user', content: 'Create a login flow' },
        { role: 'assistant', content: 'I will map it.' },
        { role: 'user', content: 'Add password reset' },
      ],
      requestedMode: 'extend',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('Add password reset');
    expect(result).toContain('Requested mode from UI: extend');
  });

  it('builds one multimodal user message for the image model path', () => {
    const result = buildMastraRequestMessages({
      mode: 'image_to_flowchart',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Rebuild this diagram' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,AAAA' },
            },
          ],
        },
      ],
      requestedMode: 'replace',
    });

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          expect.objectContaining({ type: 'text' }),
          { type: 'image', image: 'data:image/png;base64,AAAA' },
        ],
      },
    ]);
  });

  it('rejects multiple images before any model call', () => {
    expect(() =>
      buildMastraRequestMessages({
        mode: 'image_to_flowchart',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: 'image-1' } },
              { type: 'image_url', image_url: { url: 'image-2' } },
            ],
          },
        ],
        requestedMode: 'replace',
      })
    ).toThrow(/one image|single image/i);
  });
});
