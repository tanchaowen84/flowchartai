import { expect, it } from 'vitest';
import { complexRefundFixture } from './complex-refund.fixture';
import { checkCreationQuality } from './creation-quality';

it('rejects a missing incoming approval branch before committing the diagram', () => {
  const d = complexRefundFixture();
  expect(() => checkCreationQuality(d)).not.toThrow();
  const missing = {
    ...d,
    xml: d.xml.replace(/<mxCell id="edge_14"[\s\S]*?<\/mxCell>/, ''),
  };
  expect(() => checkCreationQuality(missing)).toThrow(/calculate/);
});
it('keeps sequence participant roots valid', () => {
  const d = complexRefundFixture();
  expect(() =>
    checkCreationQuality({ ...d, diagramType: 'sequence' })
  ).not.toThrow();
});
