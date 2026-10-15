import { type DrawioDocument, EMPTY_DRAWIO_XML } from '@/lib/drawio/contracts';
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ repair: false, failed: false }));
const calls = [
  { model: 'deepseek/deepseek-v4-pro', input: 1000, cached: 0, output: 500 },
  { model: 'deepseek/deepseek-v4-pro', input: 2000, cached: 1000, output: 600 },
];
vi.mock('@/lib/billing/usage-collector', () => ({
  createUsageCollector: () => ({
    fetch: fetch,
    finish: async () => calls,
    receipts: async () => calls,
  }),
}));
vi.mock('@/lib/mastra/native-model', () => ({
  getNativeModelForMode: () => 'deepseek/deepseek-v4-pro',
  createNativeModel: () => ({}),
}));
vi.mock('@/lib/mastra/drawio-agent', () => ({
  nativeAgentInstructions: () => 'test',
  createDrawioAgent: (document: DrawioDocument) => ({
    stream: async () => ({
      fullStream: (async function* () {
        if (state.repair || state.failed)
          yield {
            type: 'tool-error',
            payload: {
              error: new Error(
                'New step overlaps another step; private provider diagnostic'
              ),
            },
          };
        if (!state.failed)
          yield {
            type: 'tool-result',
            payload: {
              toolName: 'generate_flowchart',
              result: {
                kind: 'drawio-command',
                commandId: 'test-command',
                documentId: document.documentId,
                baseRevision: document.revision,
                operation: 'create',
                diagramType: 'flowchart',
                xml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Process" vertex="1" parent="1"><mxGeometry x="0" y="0" width="180" height="56" as="geometry"/></mxCell></root></mxGraphModel>',
                description: 'Generated',
              },
            },
          };
        yield { type: 'finish', payload: {} };
      })(),
    }),
  }),
}));
import { runNativeTask } from './runner';
const document: DrawioDocument = {
  editorKind: 'drawio',
  formatVersion: 1,
  documentId: 'runner-test',
  revision: 0,
  diagramType: 'flowchart',
  xml: EMPTY_DRAWIO_XML,
};
beforeEach(() => {
  state.repair = false;
  state.failed = false;
});
it('keeps every provider receipt in one successful task', async () => {
  const output = await runNativeTask(
    document,
    { prompt: 'Make a process', max_credits: 100 },
    false
  );
  expect(output.calls.map((c) => c.input)).toEqual([1000, 2000]);
  expect(output.calls.every((c) => !c.platformFunded)).toBe(true);
});
it('funds every call when the Agent corrects a rejected hidden-node attempt', async () => {
  state.repair = true;
  const output = await runNativeTask(
    document,
    { prompt: 'Make a process', max_credits: 100 },
    false
  );
  expect(output.calls).toHaveLength(2);
  expect(output.calls.every((c) => c.platformFunded)).toBe(true);
});
it('retains failed-call costs for reconciliation without exposing provider diagnostics', async () => {
  state.failed = true;
  try {
    await runNativeTask(
      document,
      { prompt: 'Make a process', max_credits: 100 },
      false
    );
    throw new Error('Expected failure');
  } catch (error) {
    expect(error).toMatchObject({ code: 'generation_failed', calls });
    expect((error as Error).message).not.toContain('private provider');
  }
});
