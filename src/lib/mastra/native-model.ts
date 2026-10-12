/**
 * [INPUT] Native configured model, existing key and optional test transport.
 * [OUTPUT] AI SDK 7-compatible OpenRouter model for native tool execution.
 * [POS] Native provider adapter using the existing OpenRouter service.
 * [UPDATE] Verify outbound request options when upgrading provider or Mastra.
 */
import {
  type OpenRouterProviderSettings,
  createOpenRouter,
} from '@openrouter/ai-sdk-provider';
import { getFlowchartModelForMode } from '../ai-models';
import type { AiAssistantMode } from '../ai-modes';
import { nativeProviderBody } from '../drawio/model-settings';

export function getNativeModelForMode(mode: AiAssistantMode): string {
  return mode === 'text_to_flowchart'
    ? process.env.FLOWCHART_NATIVE_TEXT_MODEL || 'deepseek/deepseek-v4-pro'
    : getFlowchartModelForMode(mode);
}

export function createNativeModel(
  mode: AiAssistantMode,
  options?: Pick<OpenRouterProviderSettings, 'apiKey' | 'fetch'>
): ReturnType<ReturnType<typeof createOpenRouter>['chat']> {
  const model = getNativeModelForMode(mode).replace(/^openrouter\//, '');
  const provider = createOpenRouter({
    apiKey: options?.apiKey || process.env.OPENROUTER_API_KEY,
    fetch: options?.fetch,
  });
  return provider.chat(model, { extraBody: nativeProviderBody(model) });
}
