import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFlowchartModelForMode } from './ai-models';
import { buildGatewayModelId } from './mastra/request-builder';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('flowchart model routing', () => {
  it('routes text requests through the configured OpenRouter Gateway model', () => {
    vi.stubEnv('FLOWCHART_TEXT_MODEL', 'deepseek/custom-text');
    expect(
      buildGatewayModelId(
        getFlowchartModelForMode('text_to_flowchart')
      )
    ).toBe('openrouter/deepseek/custom-text');
  });

  it('routes image requests through the independently configured multimodal model', () => {
    vi.stubEnv('FLOWCHART_IMAGE_MODEL', 'bytedance-seed/custom-vision');
    expect(
      buildGatewayModelId(
        getFlowchartModelForMode('image_to_flowchart')
      )
    ).toBe('openrouter/bytedance-seed/custom-vision');
  });
});
