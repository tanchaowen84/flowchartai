/** Grow only affected ancestor containers; all existing child positions stay. */
import type { DrawioDocument, DrawioOperation, DrawioPatch } from './contracts';
import { applyDrawioPatch, readNativeCells } from './native-document';

export function fitDrawioPatchGroups(
  current: DrawioDocument,
  patch: DrawioPatch
): DrawioPatch {
  const cells = readNativeCells(applyDrawioPatch(current, patch));
  const map = new Map(cells.map((cell) => [cell.id, cell]));
  const before = new Set(readNativeCells(current).map((cell) => cell.id));
  const touched = new Set(
    patch.operations.flatMap((op) =>
      op.type === 'updateCell' && (op.changes.geometry || op.changes.parent)
        ? [op.id]
        : []
    )
  );
  for (const cell of cells) if (!before.has(cell.id)) touched.add(cell.id);
  const groups = new Set<string>();
  const depth = (id: string): number => {
    let count = 0;
    let cell = map.get(id);
    while (cell?.parent) {
      count++;
      cell = map.get(cell.parent);
    }
    return count;
  };
  for (const id of touched) {
    let parent = map.get(id)?.parent;
    while (parent && parent !== '0' && parent !== '1') {
      groups.add(parent);
      parent = map.get(parent)?.parent;
    }
  }
  const operations: DrawioOperation[] = [...patch.operations];
  for (const id of [...groups].sort((a, b) => depth(b) - depth(a))) {
    const group = map.get(id);
    if (!group?.geometry.width) continue;
    const children = cells.filter(
      (cell) =>
        cell.parent === id &&
        cell.geometry.width &&
        !cell.source &&
        !cell.target &&
        cell.geometry.relative !== '1'
    );
    const width = Math.max(
      +group.geometry.width,
      ...children.map(
        (child) => +(child.geometry.x || 0) + +child.geometry.width + 24
      )
    );
    const height = Math.max(
      +group.geometry.height,
      ...children.map(
        (child) => +(child.geometry.y || 0) + +child.geometry.height + 24
      )
    );
    if (width !== +group.geometry.width || height !== +group.geometry.height) {
      group.geometry.width = String(width);
      group.geometry.height = String(height);
      operations.push({
        type: 'updateCell',
        id,
        changes: { geometry: { width, height } },
      });
    }
  }
  return { ...patch, operations };
}
