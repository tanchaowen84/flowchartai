import { afterEach, expect, it, vi } from 'vitest';
import { prepareDrawioCommand } from '../drawio/command';
import { complexRefundFixture } from '../drawio/complex-refund.fixture';
import { EMPTY_DRAWIO_XML, drawioCommandSchema } from '../drawio/contracts';
import * as layout from '../drawio/layout-new-diagram';
import { readNativeCells } from '../drawio/native-document';
import { buildNativeCommand, createDrawioAgent } from './drawio-agent';
import { createNativeModel } from './native-model';

afterEach(() => vi.restoreAllMocks());

it('accepts multiple entries, a cycle and an independent note in a new diagram', async () => {
  const document = { ...complexRefundFixture(), xml: EMPTY_DRAWIO_XML };
  const command = await buildNativeCommand(document, {
    action: 'create',
    diagramType: 'flowchart',
    description: 'Two entry paths with a retry loop and a note',
    graph: {
      nodes: [
        { id: 'a', label: '线上申请', shape: 'terminator' },
        { id: 'b', label: '线下申请', shape: 'terminator' },
        { id: 'check', label: '校验', shape: 'decision' },
        { id: 'note', label: '适用所有申请渠道', shape: 'text' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'check', label: '' },
        { id: 'e2', source: 'b', target: 'check', label: '' },
        { id: 'e3', source: 'check', target: 'a', label: '补充资料' },
      ],
    },
  });
  const cells = readNativeCells(prepareDrawioCommand(document, command));
  expect(cells.find((cell) => cell.id === 'note')?.value).toBe(
    '适用所有申请渠道'
  );
  expect(cells.filter((cell) => cell.source)).toHaveLength(3);
});

it('commits a complex cross-group patch without judging its placement', async () => {
  const document = complexRefundFixture();
  const before = readNativeCells(document);
  const command = await buildNativeCommand(document, {
    action: 'patch',
    diagramType: 'flowchart',
    description: 'Add an annotation and change both approval labels',
    patch: {
      baseRevision: document.revision,
      operations: [
        {
          type: 'addCell',
          xml: '<mxCell id="note" value="处理说明" vertex="1" parent="finance"><mxGeometry x="20" y="0" width="200" height="56" as="geometry"/></mxCell>',
        },
        {
          type: 'updateCell',
          id: 'supervisor',
          changes: { value: '主管复核' },
        },
        { type: 'updateCell', id: 'calculate', changes: { value: '财务复核' } },
      ],
    },
  });
  const cells = readNativeCells(prepareDrawioCommand(document, command));
  expect(cells.find((cell) => cell.id === 'note')?.geometry.y).toBe('0');
  expect(cells.find((cell) => cell.id === 'supervisor')?.value).toBe(
    '主管复核'
  );
  expect(cells.find((cell) => cell.id === 'calculate')).toEqual({
    ...before.find((cell) => cell.id === 'calculate'),
    value: '财务复核',
  });
  expect(
    cells.filter(
      (cell) => !['note', 'supervisor', 'calculate'].includes(cell.id)
    )
  ).toEqual(
    before.filter((cell) => !['supervisor', 'calculate'].includes(cell.id))
  );
});

it('uses a valid rebuild even if automatic layout fails', async () => {
  vi.spyOn(layout, 'layoutNewDiagram').mockRejectedValueOnce(
    new Error('ELK failed')
  );
  const document = complexRefundFixture();
  const command = await buildNativeCommand(document, {
    action: 'replace',
    diagramType: 'architecture',
    description: '换成架构图',
    graph: {
      nodes: [
        { id: 'app', label: '应用', shape: 'process', x: 100, y: 100 },
        { id: 'db', label: '数据库', shape: 'database', x: 100, y: 300 },
      ],
      edges: [{ id: 'e', source: 'app', target: 'db', label: '读写' }],
    },
  });
  const candidate = prepareDrawioCommand(document, command);
  expect(candidate.diagramType).toBe('architecture');
  expect(
    readNativeCells(candidate).find((cell) => cell.id === 'app')?.geometry.x
  ).toBe('100');
});

it('still rejects stale or broken patches before optional layout', async () => {
  const document = complexRefundFixture();
  const base = {
    action: 'patch' as const,
    diagramType: 'flowchart',
    description: 'Edit',
  };
  await expect(
    buildNativeCommand(document, {
      ...base,
      patch: {
        baseRevision: 3,
        operations: [{ type: 'removeCell', id: 'request' }],
      },
    })
  ).rejects.toThrow(/revision/i);
  await expect(
    buildNativeCommand(document, {
      ...base,
      patch: {
        baseRevision: 4,
        operations: [{ type: 'removeCell', id: 'request' }],
      },
    })
  ).rejects.toThrow(/reference/);
});

it.each([false, true])(
  'stops after a valid tool result, repairing a format error only when needed (%s)',
  async (firstIsStale) => {
    const document = complexRefundFixture();
    let requests = 0;
    const model = createNativeModel('text_to_flowchart', {
      apiKey: 'test-only',
      fetch: async () => {
        requests++;
        const input = {
          action: 'patch',
          diagramType: 'flowchart',
          description: '主管复核',
          patch: {
            baseRevision: firstIsStale && requests === 1 ? 3 : 4,
            operations: [
              {
                type: 'updateCell',
                id: 'supervisor',
                changes: { value: '主管复核' },
              },
            ],
          },
        };
        const event = (choices: unknown[]) =>
          'data: ' +
          JSON.stringify({
            id: 'test-' + requests,
            object: 'chat.completion.chunk',
            created: 1,
            model: 'deepseek/deepseek-v4-pro',
            choices,
          }) +
          '\n\n';
        return new Response(
          event([
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-' + requests,
                    type: 'function',
                    function: {
                      name: 'generate_flowchart',
                      arguments: JSON.stringify(input),
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ]) +
            event([{ index: 0, delta: {}, finish_reason: 'tool_calls' }]) +
            'data: [DONE]\n\n',
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        );
      },
    });
    const output = await createDrawioAgent(document, ['payment']).stream(
      '改成主管复核',
      { model }
    );
    const chunks = [];
    for await (const chunk of output.fullStream) chunks.push(chunk);
    const results = chunks.filter((chunk) => chunk.type === 'tool-result');
    expect(results).toHaveLength(1);
    expect(
      drawioCommandSchema.safeParse(results[0].payload.result).success
    ).toBe(true);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(requests).toBe(firstIsStale ? 2 : 1);
  }
);

it.each(['patch', 'replace'] as const)(
  'protects the active page during a %s when the user switches pages',
  (operation) => {
    const fixture = complexRefundFixture();
    const document = {
      ...fixture,
      pageId: 'main',
      xml:
        '<mxfile><diagram id="main">' +
        fixture.xml +
        '</diagram><diagram id="other">' +
        EMPTY_DRAWIO_XML +
        '</diagram></mxfile>',
    };
    expect(() =>
      prepareDrawioCommand(document, {
        kind: 'drawio-command',
        commandId: 'test',
        documentId: document.documentId,
        baseRevision: 4,
        pageId: 'other',
        operation,
        diagramType: 'flowchart',
        description: 'Edit',
        xml: EMPTY_DRAWIO_XML,
        patch: {
          baseRevision: 4,
          operations: [
            {
              type: 'updateCell',
              id: 'supervisor',
              changes: { value: '主管复核' },
            },
          ],
        },
      })
    ).toThrow(/Page changed/);
  }
);

it('combines a retry shortcut and an unrelated requested label change atomically', async () => {
  const document = complexRefundFixture();
  const command = await buildNativeCommand(document, {
    action: 'patch',
    diagramType: 'flowchart',
    description: '限制重试并更新主管标签',
    retryPolicy: {
      actionId: 'refund',
      retryStepId: 'retry',
      eligibilityId: 'paid',
      manualHandlerId: 'manual',
      maxRetries: 3,
    },
    patch: {
      baseRevision: 4,
      operations: [
        {
          type: 'updateCell',
          id: 'supervisor',
          changes: { value: '主管复核' },
        },
      ],
    },
  });
  const cells = readNativeCells(prepareDrawioCommand(document, command));
  expect(cells.find((cell) => cell.id === 'bounded_refund_init')).toBeDefined();
  expect(cells.find((cell) => cell.id === 'supervisor')?.value).toBe(
    '主管复核'
  );
  expect(cells.find((cell) => cell.id === 'calculate')).toEqual(
    readNativeCells(document).find((cell) => cell.id === 'calculate')
  );
});
