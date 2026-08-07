import { describe, expect, it } from 'vitest';
import { markAiGeneratedElements } from './mermaid-converter';

describe('markAiGeneratedElements', () => {
  it('marks a conversion batch without duplicating the Mermaid source', () => {
    const elements = markAiGeneratedElements([
      { id: 'node-a', customData: { converterData: 'keep-a' } },
      { id: 'node-b', customData: { converterData: 'keep-b' } },
    ]);

    expect(elements).toHaveLength(2);
    expect(elements.every((element) => element.customData.aiGenerated)).toBe(
      true
    );
    expect(elements[0].customData.generatedAt).toBe(
      elements[1].customData.generatedAt
    );
    expect(elements[0].customData.converterData).toBe('keep-a');
    expect(elements[1].customData.converterData).toBe('keep-b');
    expect(
      elements.some(
        (element) => 'originalMermaid' in (element.customData || {})
      )
    ).toBe(false);
    expect(
      elements.some((element) => 'sessionId' in (element.customData || {}))
    ).toBe(false);
  });
});
