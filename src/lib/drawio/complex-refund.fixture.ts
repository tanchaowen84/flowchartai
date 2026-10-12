import type { DrawioDocument } from './contracts';

const groups = ['customer', 'support', 'manager', 'finance', 'payment'];
const steps = [
  ['request', '提交退款申请', 'customer'],
  ['validate', '校验订单', 'support'],
  ['valid', '订单有效？', 'support'],
  ['expiry', '退款期限内？', 'support'],
  ['exception', '例外审批', 'manager'],
  ['exception_ok', '例外批准？', 'manager'],
  ['evidence', '检查凭证', 'support'],
  ['sufficient', '凭证完整？', 'support'],
  ['supplement', '补交凭证', 'customer'],
  ['fork', '并行审核', 'support'],
  ['supervisor', '主管审核', 'manager'],
  ['approved', '主管批准？', 'manager'],
  ['calculate', '财务核算', 'finance'],
  ['correct', '金额一致？', 'finance'],
  ['correction', '更正金额', 'finance'],
  ['join', '两项审核均通过', 'support'],
  ['refund', '请求退款', 'payment'],
  ['paid', '退款成功？', 'payment'],
  ['retry', '重试退款', 'retry_group'],
  ['manual', '人工处理', 'payment'],
  ['notify', '通知客户', 'support'],
  ['archive', '归档', 'support'],
  ['reject', '拒绝申请', 'support'],
];
const connections = [
  ['request', 'validate'],
  ['validate', 'valid'],
  ['valid', 'expiry'],
  ['valid', 'reject'],
  ['expiry', 'exception'],
  ['expiry', 'evidence'],
  ['exception', 'exception_ok'],
  ['exception_ok', 'evidence'],
  ['exception_ok', 'reject'],
  ['evidence', 'sufficient'],
  ['sufficient', 'supplement'],
  ['supplement', 'evidence'],
  ['sufficient', 'fork'],
  ['fork', 'supervisor'],
  ['fork', 'calculate'],
  ['supervisor', 'approved'],
  ['approved', 'join'],
  ['approved', 'reject'],
  ['calculate', 'correct'],
  ['correct', 'join'],
  ['correct', 'correction'],
  ['correction', 'calculate'],
  ['join', 'refund'],
  ['refund', 'paid'],
  ['paid', 'notify'],
  ['paid', 'retry'],
  ['retry', 'refund'],
  ['paid', 'manual'],
  ['manual', 'notify'],
  ['notify', 'archive'],
];

export function complexRefundFixture(): DrawioDocument {
  const counters: Record<string, number> = {};
  const groupXml = groups
    .map(
      (id, i) =>
        `<mxCell id="${id}" value="${id}" style="swimlane;horizontal=1;" vertex="1" parent="1"><mxGeometry x="${i * 280}" y="0" width="260" height="1200" as="geometry"/></mxCell>`
    )
    .join('');
  const nested =
    '<mxCell id="retry_group" value="重试子流程" style="swimlane;" vertex="1" parent="payment"><mxGeometry x="10" y="720" width="230" height="200" as="geometry"/></mxCell>';
  const nodeXml = steps
    .map(([id, label, parent]) => {
      const rank = counters[parent] || 0;
      counters[parent] = rank + 1;
      return `<mxCell id="${id}" value="${label}" style="rounded=1;fillColor=#ffffff;strokeColor=#536175;" vertex="1" parent="${parent}"><mxGeometry x="20" y="${50 + rank * 100}" width="200" height="56" as="geometry"/></mxCell>`;
    })
    .join('');
  const edges = connections
    .map(
      ([source, target], i) =>
        `<mxCell id="edge_${i}" edge="1" parent="1" source="${source}" target="${target}" style="edgeStyle=orthogonalEdgeStyle;endArrow=block;"><mxGeometry relative="1" as="geometry"/></mxCell>`
    )
    .join('');
  return {
    editorKind: 'drawio',
    formatVersion: 1,
    documentId: 'refund-fixture',
    revision: 4,
    diagramType: 'flowchart',
    xml: `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${groupXml}${nested}${nodeXml}${edges}</root></mxGraphModel>`,
  };
}
