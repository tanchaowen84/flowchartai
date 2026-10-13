/** Compile a bounded retry mutation with one-time initialization and no lost branches. */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { z } from 'zod';
import type { DrawioDocument, DrawioOperation, DrawioPatch } from './contracts';
import { compileNativeGraph } from './graph-compiler';
import { readNativeCells } from './native-document';

export const retryPolicySchema = z
  .object({
    actionId: z.string(),
    retryStepId: z.string(),
    eligibilityId: z.string(),
    manualHandlerId: z.string(),
    maxRetries: z.number().int().positive(),
  })
  .strict();
export function compileRetryPolicy(
  document: DrawioDocument,
  input: z.infer<typeof retryPolicySchema>
): DrawioPatch {
  const policy = retryPolicySchema.parse(input);
  const cells = readNativeCells(document);
  const map = new Map(cells.map((cell) => [cell.id, cell]));
  for (const id of [
    policy.actionId,
    policy.retryStepId,
    policy.eligibilityId,
    policy.manualHandlerId,
  ])
    if (!map.has(id)) throw new Error(`Retry policy object ${id} is missing`);
  const base = `bounded_${policy.actionId}`;
  const init = `${base}_init`;
  const check = `${base}_check`;
  const increment = `${base}_increment`;
  const chinese = cells.some((cell) => /[\u4e00-\u9fff]/.test(cell.value));
  const label = chinese
    ? `重试次数 < ${policy.maxRetries}？`
    : `Retries < ${policy.maxRetries}?`;
  if (map.has(check))
    return {
      baseRevision: document.revision,
      operations: [
        { type: 'updateCell', id: check, changes: { value: label } },
      ],
    };
  const action = map.get(policy.actionId)!;
  const retry = map.get(policy.retryStepId)!;
  const incoming = cells.filter(
    (cell) =>
      cell.target === policy.actionId && cell.source !== policy.retryStepId
  );
  const back = cells.find(
    (cell) =>
      cell.source === policy.retryStepId && cell.target === policy.actionId
  );
  const eligible = cells.find(
    (cell) =>
      cell.source === policy.eligibilityId && cell.target === policy.retryStepId
  );
  if (!incoming.length || !back || !eligible)
    throw new Error(
      'Retry policy requires an existing initial action, eligibility branch and retry return edge'
    );
  let initialX = +action.geometry.x + +action.geometry.width + 40;
  const initialY = +action.geometry.y;
  const siblings = cells.filter(
    (cell) =>
      cell.parent === action.parent &&
      cell.geometry.width &&
      !cell.source &&
      !cell.target
  );
  for (let round = 0; round < siblings.length; round++) {
    const collision = siblings.find(
      (cell) =>
        initialX < +(cell.geometry.x || 0) + +cell.geometry.width &&
        initialX + 180 > +(cell.geometry.x || 0) &&
        initialY < +(cell.geometry.y || 0) + +cell.geometry.height &&
        initialY + 56 > +(cell.geometry.y || 0)
    );
    if (!collision) break;
    initialX = +(collision.geometry.x || 0) + +collision.geometry.width + 40;
  }
  const xml = compileNativeGraph(
    {
      nodes: [
        {
          id: init,
          label: chinese ? '重试次数 = 0' : 'Retry count = 0',
          shape: 'process',
          parent: action.parent,
          x: initialX,
          y: initialY,
        },
        {
          id: check,
          label,
          shape: 'decision',
          parent: retry.parent,
          x: 24,
          y: 44,
        },
        {
          id: increment,
          label: chinese ? '重试次数 + 1' : 'Retry count + 1',
          shape: 'process',
          parent: retry.parent,
          x: 24,
          y: 244,
        },
      ],
      edges: [
        {
          id: `${base}_initial`,
          source: init,
          target: policy.actionId,
          label: '',
        },
        {
          id: `${base}_yes`,
          source: check,
          target: policy.retryStepId,
          label: chinese ? '是' : 'Yes',
        },
        {
          id: `${base}_no`,
          source: check,
          target: policy.manualHandlerId,
          label: chinese ? '否，达到上限' : 'No, limit reached',
        },
        {
          id: `${base}_back`,
          source: increment,
          target: policy.actionId,
          label: chinese ? '重新请求退款' : 'Retry action',
        },
      ],
    },
    { fragment: true }
  );
  const parsed = new DOMParser().parseFromString(xml, 'text/xml');
  const operations: DrawioOperation[] = Array.from(
    parsed.getElementsByTagName('mxCell')
  )
    .filter((cell) => !['0', '1'].includes(cell.getAttribute('id') || ''))
    .map((cell) => ({
      type: 'addCell',
      xml: new XMLSerializer().serializeToString(cell),
    }));
  for (const edge of incoming)
    operations.push({
      type: 'updateCell',
      id: edge.id,
      changes: { target: init, points: [] },
    });
  operations.push(
    {
      type: 'updateCell',
      id: eligible.id,
      changes: { target: check, points: [] },
    },
    {
      type: 'updateCell',
      id: back.id,
      changes: { target: increment, points: [] },
    },
    {
      type: 'updateCell',
      id: retry.id,
      changes: { geometry: { x: 24, y: 152 } },
    }
  );
  return { baseRevision: document.revision, operations };
}
