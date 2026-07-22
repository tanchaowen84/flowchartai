import { describe, expect, it } from 'vitest';
import { generateSystemPrompt } from './flowchart-prompts';

describe('FlowchartAgent capability prompt', () => {
  it('states the supported styled patch dialect and replace-only fallback', () => {
    const prompt = generateSystemPrompt().replace(/\s+/g, ' ');

    expect(prompt).toMatch(/rectangle.*rounded.*diamond.*stadium.*circle/i);
    expect(prompt).toMatch(/fill.*stroke.*stroke-width/i);
    expect(prompt).toMatch(/subgraph.*classDef.*linkStyle.*replace/i);
    expect(prompt).toMatch(/full replacement|replace(?:s|ment)? style/i);
  });
});
