import { expect, it } from 'vitest';
import { nativeModelSettings, nativeProviderBody } from './model-settings';

it('reserves visible XML budget and disables only known optional thinking', () => {
  expect(nativeProviderBody('deepseek/deepseek-v4-flash')).toEqual({
    reasoning: { enabled: false },
  });
  expect(nativeProviderBody('google/gemini-3.5-flash')).toEqual({});
  expect(nativeProviderBody('deepseek/deepseek-v4-flash:thinking')).toEqual({});
  expect(
    nativeModelSettings('deepseek/deepseek-v4-flash').maxOutputTokens
  ).toBe(16000);
});
