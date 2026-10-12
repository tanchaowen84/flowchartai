/**
 * [INPUT] Existing flowchart and a candidate field-level patch.
 * [OUTPUT] Feedback for new overlaps or children escaping affected groups.
 * [POS] Server tool validation; pre-existing manual overlaps remain allowed.
 * [UPDATE] Sync geometry feedback and complex-edit acceptance.
 */
import type { DrawioDocument, DrawioPatch } from './contracts';
import { type NativeCellSummary, readNativeCells } from './native-document';

function box(cell: NativeCellSummary) {
  return {
    x: +(cell.geometry.x || 0),
    y: +(cell.geometry.y || 0),
    width: +cell.geometry.width,
    height: +cell.geometry.height,
  };
}
function area(
  a: NativeCellSummary | undefined,
  b: NativeCellSummary | undefined
): number {
  if (!a || !b) return 0;
  const l = box(a);
  const r = box(b);
  return (
    Math.max(0, Math.min(l.x + l.width, r.x + r.width) - Math.max(l.x, r.x)) *
    Math.max(0, Math.min(l.y + l.height, r.y + r.height) - Math.max(l.y, r.y))
  );
}
export function checkPatchPlacement(
  current: DrawioDocument,
  candidate: DrawioDocument,
  patch: DrawioPatch
): void {
  if (!/^(flowchart|swimlane)$/i.test(candidate.diagramType)) return;
  const before = new Map(
    readNativeCells(current).map((cell) => [cell.id, cell])
  );
  const after = readNativeCells(candidate).filter(
    (cell) =>
      cell.geometry.width &&
      !cell.source &&
      !cell.target &&
      cell.geometry.relative !== '1'
  );
  const changed = new Set(
    patch.operations.flatMap((operation) =>
      operation.type === 'updateCell' &&
      (operation.changes.geometry || operation.changes.parent)
        ? [operation.id]
        : []
    )
  );
  for (const cell of after) if (!before.has(cell.id)) changed.add(cell.id);
  for (const cell of after.filter((cell) => changed.has(cell.id))) {
    const parent = after.find((p) => p.id === cell.parent);
    const nextBox = box(cell);
    if (parent && /swimlane(?:;|$)|shape=swimlane/.test(parent.style)) {
      const header = Number(/startSize=([^;]+)/.exec(parent.style)?.[1] || 40);
      const horizontal = !/horizontal=0(?:;|$)/.test(parent.style);
      const old = before.get(cell.id);
      if (
        (horizontal ? nextBox.y : nextBox.x) < header &&
        (!old ||
          (horizontal ? +(old.geometry.y || 0) : +(old.geometry.x || 0)) >=
            header)
      )
        throw new Error(
          `Cell ${cell.id} overlaps the heading of ${parent.id}. Keep ${horizontal ? 'y' : 'x'} >= ${header} inside the container.`
        );
    }

    if (
      parent &&
      (nextBox.x < 0 ||
        nextBox.y < 0 ||
        nextBox.x + nextBox.width > +parent.geometry.width + 1 ||
        nextBox.y + nextBox.height > +parent.geometry.height + 1)
    )
      throw new Error(
        `Cell ${cell.id} extends outside group ${parent.id}. Expand that group with explicit geometry while keeping unrelated nodes unchanged.`
      );
    for (const other of after.filter(
      (other) => other.id !== cell.id && other.parent === cell.parent
    )) {
      if (
        area(cell, other) >
        area(before.get(cell.id), before.get(other.id)) + 1
      )
        throw new Error(
          `New overlap between ${cell.id} ${JSON.stringify(box(cell))} and ${other.id} ${JSON.stringify(box(other))}. Place new/changed nodes or groups in free space and expand only affected containers; preserve unrelated manual positions.`
        );
    }
  }
}
