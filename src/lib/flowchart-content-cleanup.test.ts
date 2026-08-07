import { describe, expect, it } from 'vitest';
import { compactFlowchartContent } from './flowchart-content-cleanup';

function content(elements: unknown[]): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements,
    files: { untouched: { id: 'file-1' } },
  });
}

describe('compactFlowchartContent', () => {
  it('keeps one deterministic carrier for a managed diagram', () => {
    const source = 'flowchart LR\n A-->B';
    const before = content([
      {
        id: 'label-z',
        type: 'text',
        customData: {
          diagramId: 'main',
          entityType: 'label',
          originalMermaid: source,
          keep: 'z',
        },
      },
      {
        id: 'node-b',
        type: 'rectangle',
        customData: {
          diagramId: 'main',
          entityType: 'node',
          originalMermaid: source,
          keep: 'b',
        },
      },
      {
        id: 'node-a',
        type: 'rectangle',
        customData: {
          diagramId: 'main',
          entityType: 'node',
          originalMermaid: source,
          keep: 'a',
        },
      },
    ]);

    const result = compactFlowchartContent(before);

    expect(result.status).toBe('changed');
    expect(result.removedSourceCopies).toBe(2);
    expect(result.carrierCount).toBe(1);
    const parsed = JSON.parse(result.content);
    expect(
      parsed.elements.filter(
        (element: { customData?: { originalMermaid?: string } }) =>
          element.customData?.originalMermaid === source
      )
    ).toEqual([expect.objectContaining({ id: 'node-a' })]);
    expect(
      parsed.elements.map((element: any) => element.customData.keep)
    ).toEqual(['z', 'b', 'a']);
    expect(parsed.files).toEqual({ untouched: { id: 'file-1' } });
  });

  it('keeps one carrier for each managed diagram and distinct source', () => {
    const before = content([
      {
        id: 'a-1',
        customData: { diagramId: 'a', originalMermaid: 'graph A' },
      },
      {
        id: 'a-2',
        customData: { diagramId: 'a', originalMermaid: 'graph A' },
      },
      {
        id: 'a-stale',
        customData: { diagramId: 'a', originalMermaid: 'graph A old' },
      },
      {
        id: 'b-1',
        customData: { diagramId: 'b', originalMermaid: 'graph B' },
      },
      {
        id: 'b-2',
        customData: { diagramId: 'b', originalMermaid: 'graph B' },
      },
    ]);

    const result = compactFlowchartContent(before);

    expect(result.status).toBe('changed');
    expect(result.removedSourceCopies).toBe(2);
    expect(result.carrierCount).toBe(3);
  });

  it('preserves separate legacy generations using the existing one-second clustering rule', () => {
    const source = 'sequenceDiagram\n A->>B: Hi';
    const legacy = (id: string, generatedAt?: number) => ({
      id,
      type: 'rectangle',
      customData: {
        aiGenerated: true,
        originalMermaid: source,
        ...(generatedAt === undefined ? {} : { generatedAt }),
      },
    });
    const before = content([
      legacy('first-a', 1_000),
      legacy('first-b', 1_800),
      legacy('second-a', 4_000),
      legacy('second-b', 4_100),
      legacy('without-time-a'),
      legacy('without-time-b'),
    ]);

    const result = compactFlowchartContent(before);

    expect(result.status).toBe('changed');
    expect(result.removedSourceCopies).toBe(3);
    expect(result.carrierCount).toBe(3);
  });

  it('is idempotent', () => {
    const before = content([
      {
        id: 'a',
        customData: { diagramId: 'main', originalMermaid: 'graph A' },
      },
      {
        id: 'b',
        customData: { diagramId: 'main', originalMermaid: 'graph A' },
      },
    ]);

    const first = compactFlowchartContent(before);
    const second = compactFlowchartContent(first.content);

    expect(first.status).toBe('changed');
    expect(second).toMatchObject({
      status: 'unchanged',
      content: first.content,
      removedSourceCopies: 0,
      carrierCount: 1,
    });
  });

  it('does not touch unrecognized sources or malformed content', () => {
    const unrecognized = content([
      {
        id: 'user-element',
        customData: { originalMermaid: 'user data', keep: true },
      },
    ]);
    const unrecognizedResult = compactFlowchartContent(unrecognized);
    const malformedResult = compactFlowchartContent('{broken');

    expect(unrecognizedResult).toMatchObject({
      status: 'unchanged',
      content: unrecognized,
      removedSourceCopies: 0,
      carrierCount: 0,
    });
    expect(malformedResult).toMatchObject({
      status: 'invalid',
      content: '{broken',
      removedSourceCopies: 0,
      carrierCount: 0,
    });
  });
});
