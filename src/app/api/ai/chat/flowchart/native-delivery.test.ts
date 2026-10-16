import { EMPTY_DRAWIO_XML } from '@/lib/drawio/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ firstDiagram: false, command: {} as any }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => ({ user: { id: 'owner' } }) } },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/ai-usage', () => ({
  canUserUseAI: async () => ({ canUse: true, billingMode: 'credits' }),
}));
vi.mock('@/lib/creem-moderation', () => ({
  extractLatestUserPrompt: () => 'Remove the final node',
  screenPromptWithCreem: async () => ({ decision: 'allow' }),
}));
vi.mock('@/lib/billing/wallet', () => ({
  BillingError: class extends Error {},
  reserveTask: async () => ({
    state: 'running',
    budget: 60,
    firstDiagram: state.firstDiagram,
  }),
  readyTask: vi.fn(async () => {}),
  recordTaskCalls: vi.fn(async () => {}),
  finalizeTask: vi.fn(async () => ({ charged: 0, state: 'released' })),
}));
vi.mock('@/lib/mastra/flowchart-agent', () => ({ flowchartAgent: {} }));
vi.mock('@/lib/mastra/native-model', () => ({
  getNativeModelForMode: () => 'deepseek/deepseek-v4-pro',
  createNativeModel: () => ({}),
}));
vi.mock('@/lib/mastra/drawio-agent', () => ({
  nativeAgentInstructions: () => 'Fixture',
  createDrawioAgent: () => ({
    stream: async () => ({
      fullStream: (async function* () {
        yield {
          type: 'tool-result',
          payload: {
            toolName: 'generate_flowchart',
            toolCallId: 'call',
            result: state.command,
          },
        };
        yield { type: 'finish', payload: {} };
      })(),
    }),
  }),
}));
import { finalizeTask, readyTask } from '@/lib/billing/wallet';
import { POST } from './route';

const singleNodeXml = EMPTY_DRAWIO_XML.replace(
  '</root>',
  '<mxCell id="last" vertex="1" parent="1"><mxGeometry width="120" height="60" as="geometry"/></mxCell></root>'
);
async function run(xml = singleNodeXml): Promise<string> {
  const response = await POST(
    new Request('http://localhost/api/ai/chat/flowchart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingTaskId: 'native-delivery-task-1234',
        messages: [{ role: 'user', content: 'Remove the final node' }],
        aiContext: {
          editorKind: 'drawio',
          nativeDocument: {
            editorKind: 'drawio',
            formatVersion: 1,
            documentId: 'doc',
            revision: 1,
            diagramType: 'flowchart',
            xml,
          },
        },
      }),
    })
  );
  expect(response.status).toBe(200);
  return response.text();
}
describe('native billed command delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BILLING_V1_ENABLED = 'true';
    state.firstDiagram = false;
    state.command = {
      kind: 'drawio-command',
      commandId: 'remove-last',
      documentId: 'doc',
      baseRevision: 1,
      operation: 'patch',
      diagramType: 'flowchart',
      description: 'Removed the final node',
      patch: {
        baseRevision: 1,
        operations: [{ type: 'removeCell', id: 'last' }],
      },
    };
  });
  it('delivers an intentional edit that removes the final node', async () => {
    const stream = await run();
    expect(stream).toContain('"state":"ready"');
    expect(stream).toContain('"type":"finish"');
    expect(stream).not.toContain('"type":"error"');
    expect(readyTask).toHaveBeenCalledOnce();
    expect(finalizeTask).not.toHaveBeenCalled();
  });
  it('still rejects empty protected first-diagram delivery', async () => {
    state.firstDiagram = true;
    state.command = {
      ...state.command,
      operation: 'create',
      patch: undefined,
      xml: EMPTY_DRAWIO_XML,
    };
    expect(await run(EMPTY_DRAWIO_XML)).toContain('no visible editable shapes');
    expect(readyTask).not.toHaveBeenCalled();
    expect(finalizeTask).toHaveBeenCalled();
  });
  it.each(['create', 'replace'])(
    'rejects empty %s results for ordinary billed requests',
    async (operation) => {
      state.command = {
        ...state.command,
        operation,
        patch: undefined,
        xml: EMPTY_DRAWIO_XML,
      };
      const stream = await run(
        operation === 'create' ? EMPTY_DRAWIO_XML : singleNodeXml
      );
      expect(stream).toContain('no visible editable shapes');
      expect(stream).not.toContain('"state":"ready"');
      expect(readyTask).not.toHaveBeenCalled();
      expect(finalizeTask).toHaveBeenCalled();
    }
  );
  it('still delivers a visible protected first diagram', async () => {
    state.firstDiagram = true;
    state.command = {
      ...state.command,
      operation: 'create',
      patch: undefined,
      xml: singleNodeXml,
    };
    expect(await run(EMPTY_DRAWIO_XML)).toContain('"firstDiagram":true');
    expect(readyTask).toHaveBeenCalledOnce();
  });
});
