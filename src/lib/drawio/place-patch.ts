/** Keep new content below headings; move expanded groups into free local space. */
import type { DrawioDocument, DrawioOperation, DrawioPatch } from './contracts';
import { fitDrawioPatchGroups } from './fit-patch-groups';
import { applyDrawioPatch, readNativeCells } from './native-document';

export function placeDrawioPatch(
  current: DrawioDocument,
  patch: DrawioPatch
): DrawioPatch {
  const fitted = fitDrawioPatchGroups(current, patch);
  const cells = readNativeCells(applyDrawioPatch(current, fitted));
  const map = new Map(cells.map((cell) => [cell.id, cell]));
  const before = new Set(readNativeCells(current).map((cell) => cell.id));
  const operations: DrawioOperation[] = [...fitted.operations];
  for (const cell of cells.filter(
    (cell) =>
      !before.has(cell.id) &&
      cell.geometry.width &&
      !cell.source &&
      !cell.target
  )) {
    const parent = map.get(cell.parent);
    if (!parent || !parent.style.includes('swimlane')) continue;
    const header = Number(/startSize=([^;]+)/.exec(parent.style)?.[1] || 40);
    const key = parent.style.includes('horizontal=0') ? 'x' : 'y';
    if (+(cell.geometry[key] || 0) < header) {
      cell.geometry[key] = String(header + 8);
      operations.push({
        type: 'updateCell',
        id: cell.id,
        changes: { geometry: { [key]: header + 8 } },
      });
    }
  }
  const groups = new Set(cells.map((cell) => cell.parent));
  const touched = new Set(
    operations.flatMap((op) =>
      op.type === 'updateCell' && op.changes.geometry ? [op.id] : []
    )
  );
  const overlaps = (a: (typeof cells)[number], b: (typeof cells)[number]) =>
    +(a.geometry.x || 0) < +(b.geometry.x || 0) + +b.geometry.width &&
    +(b.geometry.x || 0) < +(a.geometry.x || 0) + +a.geometry.width &&
    +(a.geometry.y || 0) < +(b.geometry.y || 0) + +b.geometry.height &&
    +(b.geometry.y || 0) < +(a.geometry.y || 0) + +a.geometry.height;
  for (const cell of cells.filter(
    (cell) => groups.has(cell.id) && touched.has(cell.id) && cell.geometry.width
  )) {
    const siblings = cells.filter(
      (other) =>
        other.id !== cell.id &&
        other.parent === cell.parent &&
        other.geometry.width &&
        !other.source &&
        !other.target
    );
    if (!siblings.some((other) => overlaps(cell, other))) continue;
    const y =
      Math.max(
        ...siblings.map(
          (other) => +(other.geometry.y || 0) + +other.geometry.height
        )
      ) + 40;
    cell.geometry.y = String(y);
    operations.push({
      type: 'updateCell',
      id: cell.id,
      changes: { geometry: { y } },
    });
  }
  return fitDrawioPatchGroups(current, { ...patch, operations });
}
