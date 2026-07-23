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

  it('routes common requests to the matching Mermaid family', () => {
    const prompt = generateSystemPrompt().replace(/\s+/g, ' ');

    expect(prompt).toMatch(/state machine.*stateDiagram/i);
    expect(prompt).toMatch(/actor.*time.*sequenceDiagram/i);
    expect(prompt).toMatch(/class.*inheritance.*classDiagram/i);
    expect(prompt).toMatch(/entity.*relationship.*erDiagram/i);
    expect(prompt).toMatch(/explicit.*mindmap.*timeline.*gantt.*journey/i);
    expect(prompt).toMatch(/ambiguous.*flowchart/i);
  });

  it('keeps semantic color opt-in and does not infer roles from shapes', () => {
    const prompt = generateSystemPrompt().replace(/\s+/g, ' ');

    expect(prompt).toMatch(/semantic color.*explicit/i);
    expect(prompt).toMatch(/do not infer.*role.*shape/i);
    expect(prompt).not.toMatch(/Defaults: process fill/i);
  });
});
