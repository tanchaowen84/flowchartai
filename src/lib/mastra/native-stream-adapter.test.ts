import { expect, it } from 'vitest';
import { adaptNativeStream } from './native-stream-adapter';
it('preserves structured tool inputs and outputs across the SDK boundary', async () => {
  const input = {
    action: 'patch',
    patch: {
      baseRevision: 8,
      operations: [
        { type: 'updateCell', id: 'n13', changes: { value: '重试' } },
      ],
    },
  };
  const output = { kind: 'drawio-command', commandId: 'one' };
  async function* stream() {
    yield {
      type: 'tool-call',
      toolName: 'generate_flowchart',
      toolCallId: 'id',
      input,
    };
    yield {
      type: 'tool-result',
      toolName: 'generate_flowchart',
      toolCallId: 'id',
      output,
    };
    yield {
      type: 'finish',
      finishReason: 'stop',
      totalUsage: { totalTokens: 100 },
    };
  }
  const result = [];
  for await (const chunk of adaptNativeStream(stream())) result.push(chunk);
  expect(result[0].payload.args).toEqual(input);
  expect(result[1].payload.result).toEqual(output);
  expect(result[2].payload.output.usage.totalTokens).toBe(100);
});
