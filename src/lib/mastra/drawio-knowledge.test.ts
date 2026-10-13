import { expect, it } from 'vitest';
import { complexRefundFixture } from '../drawio/complex-refund.fixture';
import { createDrawioAgent, nativeAgentInstructions } from './drawio-agent';
import { relevantDrawioKnowledge } from './drawio-knowledge';

it('makes the bundled references available through Mastra without a workspace', async () => {
  const agent = createDrawioAgent(complexRefundFixture(), []);
  const skill = await agent.getSkill('drawio-native');
  expect(skill?.references).toContain('complex-flow.md');
  expect(skill?.references).toContain('sequence.md');
  expect(await agent.listSkills()).toHaveLength(1);
});

it('preloads the requested new family even when the existing document is a flowchart', () => {
  const knowledge = relevantDrawioKnowledge(
    'flowchart',
    '转换为 ER 实体关系图'
  );
  expect(knowledge).toContain('REFERENCE references/er.md');
  expect(knowledge).not.toContain('REFERENCE references/sequence.md');
  expect(knowledge).not.toContain('REFERENCE references/complex-flow.md');
  expect(knowledge.match(/REFERENCE /g)).toHaveLength(3);
});

it('uses the current document as edit context alongside patterns without fixture IDs', () => {
  const document = { ...complexRefundFixture(), documentId: 'current-canvas' };
  const instructions = nativeAgentInstructions(
    document,
    ['calculate'],
    '调整审批前风控'
  );
  const context = JSON.parse(instructions.split('CURRENT DOCUMENT: ')[1]);
  expect(context.documentId).toBe('current-canvas');
  expect(context.revision).toBe(document.revision);
  expect(context.selection).toEqual(['calculate']);
  expect(
    context.objects.find((cell: { id: string }) => cell.id === 'calculate')
  ).toBeDefined();
  expect(instructions).toContain('SAME fork');
  expect(instructions).toContain('BEFORE the original first attempt');
});
