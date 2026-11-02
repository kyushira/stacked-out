import type { Cell, Level } from './level';

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

export function inBounds(level: Level, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < level.width && r < level.height;
}

/** In-bounds and not a wall. Out-of-bounds counts as blocked. */
export function walkable(level: Level, c: number, r: number): boolean {
  return inBounds(level, c, r) && level.tiles[r * level.width + c] !== 'wall';
}

/** Breadth-first distance (in steps) from `from` to every tile; -1 when unreachable. */
export function distanceMap(level: Level, from: Cell): Int32Array {
  const dist = new Int32Array(level.width * level.height).fill(-1);
  if (!walkable(level, from.c, from.r)) return dist;
  const queue: number[] = [from.r * level.width + from.c];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const c = idx % level.width;
    const r = Math.floor(idx / level.width);
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!walkable(level, nc, nr)) continue;
      const ni = nr * level.width + nc;
      if (dist[ni] >= 0) continue;
      dist[ni] = dist[idx] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

/**
 * Shortest 4-connected path from `from` to `to` over non-wall tiles.
 * Returns the cells after `from` up to and including `to`, [] when already there,
 * or null when `to` cannot be reached.
 */
export function findPath(level: Level, from: Cell, to: Cell): Cell[] | null {
  if (!walkable(level, from.c, from.r) || !walkable(level, to.c, to.r)) return null;
  if (from.c === to.c && from.r === to.r) return [];
  const n = level.width * level.height;
  const start = from.r * level.width + from.c;
  const goal = to.r * level.width + to.c;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  seen[start] = 1;
  const queue: number[] = [start];
  for (let head = 0; head < queue.length && !seen[goal]; head++) {
    const idx = queue[head];
    const c = idx % level.width;
    const r = Math.floor(idx / level.width);
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!walkable(level, nc, nr)) continue;
      const ni = nr * level.width + nc;
      if (seen[ni]) continue;
      seen[ni] = 1;
      prev[ni] = idx;
      queue.push(ni);
    }
  }
  if (!seen[goal]) return null;
  const path: Cell[] = [];
  for (let idx = goal; idx !== start; idx = prev[idx]) {
    path.push({ c: idx % level.width, r: Math.floor(idx / level.width) });
  }
  return path.reverse();
}
