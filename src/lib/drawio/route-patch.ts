/**
 * [INPUT] A validated flowchart patch and current native geometry.
 * [OUTPUT] Affected connectors routed around nodes, or draw.io automatic routing.
 * [POS] Fixed-node routing; never moves unrelated objects or reroutes other edges.
 * [UPDATE] Verify obstacle avoidance, nested coordinates and preserved manual paths.
 */
import type { DrawioDocument, DrawioOperation, DrawioPatch } from './contracts';
import { applyDrawioPatch, readNativeCells } from './native-document';

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
const padding = 8;
function intersects(a: Point, b: Point, r: Rect): boolean {
  return a.x === b.x
    ? a.x > r.x &&
        a.x < r.x + r.width &&
        Math.min(a.y, b.y) < r.y + r.height &&
        Math.max(a.y, b.y) > r.y
    : a.y > r.y &&
        a.y < r.y + r.height &&
        Math.min(a.x, b.x) < r.x + r.width &&
        Math.max(a.x, b.x) > r.x;
}
function findRoute(start: Point, end: Point, obstacles: Rect[]): Point[] {
  const xs = [
    ...new Set([
      start.x,
      end.x,
      ...obstacles.flatMap((r) => [r.x, r.x + r.width]),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      start.y,
      end.y,
      ...obstacles.flatMap((r) => [r.y, r.y + r.height]),
    ]),
  ].sort((a, b) => a - b);
  xs.unshift(xs[0] - 40);
  xs.push(xs[xs.length - 1] + 40);
  ys.unshift(ys[0] - 40);
  ys.push(ys[ys.length - 1] + 40);
  const key = (i: number, j: number) => i * ys.length + j;
  const startKey = key(xs.indexOf(start.x), ys.indexOf(start.y));
  const endKey = key(xs.indexOf(end.x), ys.indexOf(end.y));
  const open = new Set([startKey]);
  const distance = new Map([[startKey, 0]]);
  const previous = new Map<number, number>();
  const point = (k: number) => ({
    x: xs[Math.floor(k / ys.length)],
    y: ys[k % ys.length],
  });
  const blocked = (p: Point) =>
    obstacles.some(
      (r) =>
        p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height
    );
  while (open.size) {
    let current = -1;
    let best = Number.POSITIVE_INFINITY;
    for (const k of open) {
      const p = point(k);
      const score =
        distance.get(k)! + Math.abs(p.x - end.x) + Math.abs(p.y - end.y);
      if (score < best) {
        best = score;
        current = k;
      }
    }
    if (current === endKey) {
      const path = [end];
      let k = current;
      while (previous.has(k)) {
        k = previous.get(k)!;
        path.push(point(k));
      }
      path.reverse();
      return path.filter(
        (p, i) =>
          !i ||
          i === path.length - 1 ||
          !(
            (path[i - 1].x === p.x && p.x === path[i + 1].x) ||
            (path[i - 1].y === p.y && p.y === path[i + 1].y)
          )
      );
    }
    open.delete(current);
    const i = Math.floor(current / ys.length);
    const j = current % ys.length;
    const a = point(current);
    for (const [ni, nj] of [
      [i - 1, j],
      [i + 1, j],
      [i, j - 1],
      [i, j + 1],
    ]) {
      if (ni < 0 || ni >= xs.length || nj < 0 || nj >= ys.length) continue;
      const next = key(ni, nj);
      const b = point(next);
      if (blocked(b) || obstacles.some((r) => intersects(a, b, r))) continue;
      const prev = previous.get(current);
      const turn =
        prev === undefined
          ? 0
          : (point(prev).x === a.x) === (a.x === b.x)
            ? 0
            : 24;
      const score =
        distance.get(current)! +
        Math.abs(a.x - b.x) +
        Math.abs(a.y - b.y) +
        turn;
      if (score < (distance.get(next) ?? Number.POSITIVE_INFINITY)) {
        distance.set(next, score);
        previous.set(next, current);
        open.add(next);
      }
    }
  }
  throw new Error(
    'Could not route an affected connection without crossing a node. Create more space in the affected region.'
  );
}

export function routeDrawioPatch(
  current: DrawioDocument,
  patch: DrawioPatch
): DrawioPatch {
  if (!/^(flowchart|swimlane)$/i.test(current.diagramType)) return patch;
  const candidate = applyDrawioPatch(current, patch);
  const cells = readNativeCells(candidate);
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const beforeCells = readNativeCells(current);
  const beforeMap = new Map(beforeCells.map((cell) => [cell.id, cell]));
  const beforeOffset = (id: string): Point => {
    const cell = beforeMap.get(id);
    if (!cell || !cell.parent) return { x: 0, y: 0 };
    const parent = beforeOffset(cell.parent);
    return {
      x: parent.x + +(cell.geometry.x || 0),
      y: parent.y + +(cell.geometry.y || 0),
    };
  };
  const moved = new Set<string>();
  const explicit = new Set(
    patch.operations.flatMap((op) =>
      op.type === 'updateCell' && op.changes.points?.length ? [op.id] : []
    )
  );
  const originalIds = new Set(readNativeCells(current).map((cell) => cell.id));
  const affected = new Set(
    patch.operations.flatMap((op) =>
      op.type === 'updateCell' &&
      (op.changes.source ||
        op.changes.target ||
        op.changes.points?.length === 0)
        ? [op.id]
        : []
    )
  );
  const offset = (id: string): Point => {
    const cell = byId.get(id);
    if (!cell || !cell.parent) return { x: 0, y: 0 };
    const parent = offset(cell.parent);
    return {
      x: parent.x + +(cell.geometry.x || 0),
      y: parent.y + +(cell.geometry.y || 0),
    };
  };
  const rectangles = new Map(
    cells
      .filter(
        (cell) =>
          cell.geometry.width &&
          !cell.source &&
          !cell.target &&
          cell.geometry.relative !== '1'
      )
      .map((cell) => [
        cell.id,
        {
          ...offset(cell.id),
          width: +cell.geometry.width,
          height: +cell.geometry.height,
        },
      ])
  );
  for (const [id, rectangle] of rectangles) {
    const old = beforeMap.get(id);
    if (!old) {
      moved.add(id);
      continue;
    }
    const point = beforeOffset(id);
    if (
      rectangle.x !== point.x ||
      rectangle.y !== point.y ||
      rectangle.width !== +old.geometry.width ||
      rectangle.height !== +old.geometry.height
    )
      moved.add(id);
  }
  const parents = new Set(cells.map((cell) => cell.parent));
  const obstacles = [...rectangles]
    .filter(([id]) => !parents.has(id))
    .map(([, r]) => ({
      x: r.x - padding,
      y: r.y - padding,
      width: r.width + 2 * padding,
      height: r.height + 2 * padding,
    }));
  const operations: DrawioOperation[] = [...patch.operations];
  for (const edge of cells.filter((cell) => cell.source && cell.target)) {
    if (
      explicit.has(edge.id) ||
      (!affected.has(edge.id) &&
        originalIds.has(edge.id) &&
        !moved.has(edge.source!) &&
        !moved.has(edge.target!))
    )
      continue;
    const source = rectangles.get(edge.source!);
    const target = rectangles.get(edge.target!);
    if (!source || !target) continue;
    let exit = { x: 0.5, y: 1 };
    let entry = { x: 0.5, y: 0 };
    if (target.y < source.y) {
      exit = { x: 1, y: 0.5 };
      entry = { x: 1, y: 0.5 };
    } else if (Math.abs(target.y - source.y) < 60) {
      exit = { x: target.x > source.x ? 1 : 0, y: 0.5 };
      entry = { x: target.x > source.x ? 0 : 1, y: 0.5 };
    }
    const port = (r: Rect, p: Point): Point => ({
      x: r.x + r.width * p.x + (p.x === 0 ? -padding : p.x === 1 ? padding : 0),
      y:
        r.y + r.height * p.y + (p.y === 0 ? -padding : p.y === 1 ? padding : 0),
    });
    const sides = [
      { x: 0.5, y: 1 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0, y: 0.5 },
    ];
    let points: Point[] | undefined;
    const pairs = [
      [exit, entry],
      ...sides.flatMap((a) => sides.map((b) => [a, b])),
    ];
    for (const [out, input] of pairs) {
      try {
        points = findRoute(port(source, out), port(target, input), obstacles);
        exit = out;
        entry = input;
        break;
      } catch {
        /* Try another safe attachment side. */
      }
    }
    const parent = offset(edge.parent);
    operations.push({
      type: 'updateCell',
      id: edge.id,
      changes: {
        style: {
          edgeStyle: points ? 'segmentEdgeStyle' : 'orthogonalEdgeStyle',
          exitX: String(exit.x),
          exitY: String(exit.y),
          entryX: String(entry.x),
          entryY: String(entry.y),
        },
        points: (points || []).map((point) => ({
          x: point.x - parent.x,
          y: point.y - parent.y,
        })),
      },
    });
  }
  return { ...patch, operations };
}
