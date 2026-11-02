import { distanceMap } from './path';

/**
 * Map legend (see docs/SPEC-v0.1.md):
 *   #  wall            .  floor           ,  creaky floor (+1 noise on entry, per-tile cooldown)
 *   ~  flood-able      S  entrance / exit  A  artifact candidate spot
 *   1-6  guardian patrol waypoints (walked in numeric order, then loop)
 *
 * Each row is authored as three 8-char column groups so the walls line up in the source:
 * [left border+room | central hall | right room+border].
 */
const LEVEL_GROUPS: readonly (readonly [string, string, string])[] = [
  ['########', '########', '########'],
  ['#A.....#', '........', '#......#'],
  ['#......#', '........', '#....A.#'],
  ['#......#', '..1.....', '#......#'],
  ['#......,', '........', '.......#'],
  ['#......#', '........', '#......#'],
  ['#......#', '........', '#..6...#'],
  ['###.####', '........', '###.####'],
  ['#......,', '........', '.......#'],
  ['#.#....#', '........', '..#....#'],
  ['#.#....#', '..~~~~..', '..#....#'],
  ['#.#....#', '.~~~~~~.', '..#....#'],
  ['#.#....#', '........', '..#....#'],
  ['#......#', '..2.....', '#..5...#'],
  ['#......#', '........', '#......#'],
  ['########', '...,,...', '########'],
  ['#......#', '........', '#......#'],
  ['#......#', '........', '#......#'],
  ['#......#', '...3....', '#..A...#'],
  ['#......#', '........', '#......#'],
  ['#......#', '........', '#......#'],
  ['###.####', '........', '###.####'],
  ['#......#', '........', '#......#'],
  ['#......#', '........', '#......#'],
  ['#.A....#', '........', '#......#'],
  ['#.......', '........', '.......#'],
  ['#......#', '....4...', '#......#'],
  ['#......#', '........', '#......#'],
  ['#......#', '........', '#......#'],
  ['#......#', '........', '#......#'],
  ['#......#', '...S....', '#......#'],
  ['########', '########', '########'],
];

export const LEVEL_ROWS: readonly string[] = LEVEL_GROUPS.map(([a, b, c]) => a + b + c);

export type TileKind = 'wall' | 'floor' | 'creak' | 'flood' | 'start' | 'spot' | 'waypoint';

export interface Cell {
  c: number;
  r: number;
}

export interface ArtifactSpot {
  cell: Cell;
  /** Walking steps from the entrance; deeper spots are worth more. */
  depth: number;
}

export interface Level {
  width: number;
  height: number;
  /** Row-major, index = r * width + c. */
  tiles: TileKind[];
  start: Cell;
  spots: ArtifactSpot[];
  /** waypoints[0] is the map's '1'. */
  waypoints: Cell[];
}

const GLYPHS: Record<string, TileKind> = {
  '#': 'wall',
  '.': 'floor',
  ',': 'creak',
  '~': 'flood',
  S: 'start',
  A: 'spot',
};

/** Parses ASCII rows into a Level. Throws on malformed input. */
export function parseLevel(rows: readonly string[]): Level {
  if (rows.length === 0) throw new Error('level has no rows');
  const width = rows[0].length;
  const height = rows.length;
  const tiles: TileKind[] = new Array<TileKind>(width * height);
  const starts: Cell[] = [];
  const spotCells: Cell[] = [];
  const waypointByNumber = new Map<number, Cell>();

  rows.forEach((row, r) => {
    if (row.length !== width) throw new Error(`row ${r} has width ${row.length}, expected ${width}`);
    for (let c = 0; c < width; c++) {
      const ch = row[c];
      const cell: Cell = { c, r };
      if (ch >= '1' && ch <= '9') {
        waypointByNumber.set(Number(ch), cell);
        tiles[r * width + c] = 'waypoint';
        continue;
      }
      const kind = GLYPHS[ch];
      if (!kind) throw new Error(`unknown map glyph "${ch}" at ${c},${r}`);
      if (kind === 'start') starts.push(cell);
      if (kind === 'spot') spotCells.push(cell);
      tiles[r * width + c] = kind;
    }
  });

  if (starts.length !== 1) throw new Error(`level needs exactly one entrance S, found ${starts.length}`);

  const waypoints: Cell[] = [];
  for (let n = 1; n <= waypointByNumber.size; n++) {
    const wp = waypointByNumber.get(n);
    if (!wp) throw new Error(`waypoints must be numbered 1..N without gaps; missing ${n}`);
    waypoints.push(wp);
  }

  const level: Level = {
    width,
    height,
    tiles,
    start: starts[0],
    spots: spotCells.map((cell) => ({ cell, depth: -1 })),
    waypoints,
  };
  const depth = distanceMap(level, level.start);
  for (const spot of level.spots) spot.depth = depth[spot.cell.r * width + spot.cell.c];
  return level;
}

export const LEVEL: Level = parseLevel(LEVEL_ROWS);
