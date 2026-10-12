/**
 * [INPUT] A validated newly generated native flowchart.
 * [OUTPUT] Structural feedback for one bounded Agent correction.
 * [POS] Creation guard only; never rearranges or rejects manual edits.
 * [UPDATE] Keep flowchart guard, prompts and native SSE recovery in sync.
 */
import type { DrawioDocument } from './contracts';
import { readNativeCells } from './native-document';

export function checkCreationQuality(document: DrawioDocument): void {
  if (!/^(flowchart|swimlane)$/i.test(document.diagramType)) return;
  const cells = readNativeCells(document);
  const parents = new Set(cells.map((cell) => cell.parent));
  const vertices = cells.filter(
    (cell) =>
      cell.geometry.width &&
      !cell.source &&
      !cell.target &&
      !parents.has(cell.id)
  );
  if (vertices.length < 2) return;
  const edges = cells.filter((cell) => cell.source && cell.target);
  const entries = vertices.filter(
    (cell) => !edges.some((edge) => edge.target === cell.id)
  );
  if (entries.length !== 1)
    throw new Error(
      `Flowchart has ${entries.length} unconnected entry steps: ${entries.map((cell) => cell.id).join(', ')}. Check missing incoming branches, especially parallel approvals. Connect every requested process to the flow; use one explicit start/fork for multiple entries.`
    );
  const visited = new Set([entries[0].id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges)
      if (visited.has(edge.source!) && !visited.has(edge.target!)) {
        visited.add(edge.target!);
        changed = true;
      }
  }
  const missing = vertices.filter((cell) => !visited.has(cell.id));
  if (missing.length)
    throw new Error(
      `Unreachable process steps: ${missing.map((cell) => cell.id).join(', ')}. Repair missing branches; do not delete requested steps.`
    );
}
