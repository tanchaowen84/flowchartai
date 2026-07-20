import { describe, expect, it } from 'vitest';
import { createSseEventDecoder } from './sse-client';

describe('createSseEventDecoder', () => {
  it('retains an event split across network chunks', () => {
    const decoder = createSseEventDecoder();
    const encoder = new TextEncoder();

    expect(decoder.push(encoder.encode('data: {"type":"te'))).toEqual([]);
    expect(decoder.push(encoder.encode('xt","content":"hello"}\n\n'))).toEqual([
      { type: 'text', content: 'hello' },
    ]);
  });

  it('decodes multiple events and the DONE sentinel', () => {
    const decoder = createSseEventDecoder();
    const encoder = new TextEncoder();
    const events = decoder.push(
      encoder.encode(
        'data: {"type":"text","content":"a"}\n\ndata: {"type":"finish","toolCallsCompleted":false}\n\ndata: [DONE]\n\n'
      )
    );

    expect(events).toEqual([
      { type: 'text', content: 'a' },
      { type: 'finish', toolCallsCompleted: false },
      '[DONE]',
    ]);
  });
});
