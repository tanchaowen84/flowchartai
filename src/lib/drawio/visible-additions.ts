/** External delivery guard: a new process must not hide another process at the same position. */
import { prepareDrawioCommand } from './command';
import type { DrawioCommand, DrawioDocument } from './contracts';
import { type NativeCellSummary, readNativeCells } from './native-document';
function box(
  cell: NativeCellSummary
): { x: number; y: number; width: number; height: number } | null {
  if (
    cell.source ||
    cell.target ||
    /(^|;)(text(;|$)|shape=(text|label)|container=1|swimlane|group)/.test(
      cell.style
    )
  )
    return null;
  const { x = 0, y = 0, width, height } = cell.geometry;
  const result = {
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  };
  return Object.values(result).every(Number.isFinite) &&
    result.width > 16 &&
    result.height > 16
    ? result
    : null;
}
export function assertVisibleAdditions(
  current: DrawioDocument,
  command: DrawioCommand
): void {
  if (command.operation !== 'patch') return;
  const before = new Set(readNativeCells(current).map((c) => c.id));
  const cells = readNativeCells(prepareDrawioCommand(current, command));
  for (const added of cells.filter((c) => !before.has(c.id))) {
    const a = box(added);
    if (!a) continue;
    for (const existing of cells) {
      if (existing.id === added.id || existing.parent !== added.parent)
        continue;
      const b = box(existing);
      if (!b) continue;
      const overlap =
        Math.max(
          0,
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        ) *
        Math.max(
          0,
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        );
      if (
        overlap / (a.width * a.height) > 0.85 &&
        overlap / (b.width * b.height) > 0.85
      )
        throw new Error(
          `New node ${added.id} overlaps node ${existing.id}. Put the added step in free space, move downstream nodes if needed, and resend the complete atomic patch.`
        );
    }
  }
}
