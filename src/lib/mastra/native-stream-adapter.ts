/** Keep the existing SSE contract while native tools use AI SDK 7 end to end. */
export async function* adaptNativeStream(
  stream: AsyncIterable<any>
): AsyncIterable<any> {
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta')
      yield { type: 'text-delta', payload: { text: chunk.text } };
    else if (chunk.type === 'tool-call')
      yield {
        type: 'tool-call',
        payload: {
          toolName: chunk.toolName,
          toolCallId: chunk.toolCallId,
          args: chunk.input,
        },
      };
    else if (chunk.type === 'tool-result')
      yield {
        type: 'tool-result',
        payload: {
          toolName: chunk.toolName,
          toolCallId: chunk.toolCallId,
          result: chunk.output,
        },
      };
    else if (chunk.type === 'tool-error' || chunk.type === 'error')
      yield { type: chunk.type, payload: { error: chunk.error } };
    else if (chunk.type === 'finish')
      yield {
        type: 'finish',
        payload: {
          stepResult: { reason: chunk.finishReason },
          output: { usage: chunk.totalUsage },
        },
      };
    else if (chunk.type === 'abort') yield { type: 'abort', payload: {} };
  }
}
