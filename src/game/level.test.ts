import { describe, it, expect } from 'vitest';
import { LEVEL, parseLevel } from './level';
import { distanceMap } from './path';

describe('level map', () => {
  it('is 24 tiles wide and 32 tiles tall', () => {
    expect(LEVEL.width).toBe(24);
    expect(LEVEL.height).toBe(32);
  });

  it('has a single entrance S that is the start cell', () => {
    const { start, width, tiles } = LEVEL;
    expect(tiles[start.r * width + start.c]).toBe('start');
    expect(tiles.filter((t) => t === 'start')).toHaveLength(1);
  });

  it('makes every non-wall tile reachable from S', () => {
    const dist = distanceMap(LEVEL, LEVEL.start);
    LEVEL.tiles.forEach((kind, i) => {
      if (kind !== 'wall') expect(dist[i], `tile index ${i} unreachable`).toBeGreaterThanOrEqual(0);
    });
  });

  it('has 4 artifact spots, each reachable from S', () => {
    expect(LEVEL.spots).toHaveLength(4);
    for (const spot of LEVEL.spots) expect(spot.depth).toBeGreaterThan(0);
  });

  it('has 6 guardian waypoints numbered 1..6 on floor tiles', () => {
    expect(LEVEL.waypoints).toHaveLength(6);
    for (const wp of LEVEL.waypoints) {
      expect(LEVEL.tiles[wp.r * LEVEL.width + wp.c]).toBe('waypoint');
    }
  });

  it('contains creaky tiles and a flood-able area big enough for one hazard', () => {
    expect(LEVEL.tiles.filter((t) => t === 'creak').length).toBeGreaterThan(0);
    expect(LEVEL.tiles.filter((t) => t === 'flood').length).toBeGreaterThanOrEqual(6);
  });

  it('rejects ragged rows', () => {
    expect(() => parseLevel(['#####', '#S##'])).toThrow(/width/);
  });

  it('rejects unknown glyphs', () => {
    expect(() => parseLevel(['#####', '#S?##', '#####'])).toThrow(/glyph/);
  });

  it('rejects a map without exactly one entrance', () => {
    expect(() => parseLevel(['#####', '#...#', '#####'])).toThrow(/entrance|start|S/);
  });

  it('rejects waypoints that are not numbered contiguously from 1', () => {
    expect(() => parseLevel(['#####', '#S2.#', '#####'])).toThrow(/missing 1/);
  });
});
