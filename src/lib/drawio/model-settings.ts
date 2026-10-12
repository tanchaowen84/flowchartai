/** Budget for native graph output plus reasoning; reasoning stays private. */
export function nativeModelSettings(model: string): {
  temperature?: number;
  maxOutputTokens: number;
  maxRetries: number;
} {
  return {
    ...(/openai\/gpt-5/.test(model) ? {} : { temperature: 0.35 }),
    maxOutputTokens: 16000,
    maxRetries: 1,
  };
}

export function nativeProviderBody(model: string): Record<string, unknown> {
  // Configure the provider itself: Mastra's bundled OpenRouter 1.5.4 adapter
  // does not forward per-call providerOptions. Native invocation configures options on the provider; long V4 thinking is disabled after live timeout observations.
  if (/openai\/gpt-5/.test(model))
    return { reasoning: { effort: 'low', exclude: true } };
  return /deepseek-v4/.test(model) && !model.includes(':thinking')
    ? { reasoning: { enabled: false } }
    : {};
}
