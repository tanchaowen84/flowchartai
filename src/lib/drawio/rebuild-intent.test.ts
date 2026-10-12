import { expect, it } from 'vitest';
import { allowsNativeRebuild } from './rebuild-intent';
it('requires explicit whole-diagram rebuilding and respects negation', () => {
  expect(allowsNativeRebuild('请重新生成整张流程图')).toBe(true);
  expect(allowsNativeRebuild('Redraw the entire diagram')).toBe(true);
  expect(allowsNativeRebuild('新增风控，不要重建整张图')).toBe(false);
  expect(allowsNativeRebuild('Do not redraw the whole diagram')).toBe(false);
  expect(allowsNativeRebuild('把这个节点改成菱形')).toBe(false);
});
