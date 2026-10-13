import { describe, expect, it } from 'vitest';
import { automaticDiagramTitle } from './diagram-title';

describe('automatic diagram names', () => {
  it('names an unnamed diagram and normalizes model whitespace', () => {
    expect(
      automaticDiagramTitle('Untitled', '  退款审批\n流程图  ', 'create', false)
    ).toBe('退款审批 流程图');
    expect(
      automaticDiagramTitle('Untitled', '退款审批流程图', 'patch', false)
    ).toBe('退款审批流程图');
    expect(
      automaticDiagramTitle('Untitled', 'Untitled', 'create', false)
    ).toBeNull();
  });
  it('keeps a user name even during a rebuild or when the user clears it', () => {
    expect(
      automaticDiagramTitle('财务审批 V2', '退款流程', 'replace', true)
    ).toBeNull();
    expect(automaticDiagramTitle('', '退款流程', 'create', true)).toBeNull();
  });
  it('keeps an automatic name for local edits and can rename a full rebuild', () => {
    expect(
      automaticDiagramTitle('退款流程', '审批流程', 'patch', false)
    ).toBeNull();
    expect(
      automaticDiagramTitle('退款流程', '服务架构图', 'replace', false)
    ).toBe('服务架构图');
  });
});
