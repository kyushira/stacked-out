import { describe, it, expect } from 'vitest';
import { parseLevel } from './level';
import { findPath } from './path';

const corridor = parseLevel([
  '#######',
  '#S...1#',
  '#######',
]);

const sealed = parseLevel([
  '#####',
  '#S#1#',
  '#####',
]);

describe('findPath', () => {
  it('returns a path from S to a waypoint through walkable tiles', () => {
    const path = findPath(corridor, corridor.start, corridor.waypoints[0]);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(corridor.waypoints[0]);
    expect(path).toHaveLength(4);
  });

  it('steps only between 4-adjacent walkable cells', () => {
    const path = findPath(corridor, corridor.start, corridor.waypoints[0])!;
    let prev = corridor.start;
    for (const cell of path) {
      expect(Math.abs(cell.c - prev.c) + Math.abs(cell.r - prev.r)).toBe(1);
      expect(corridor.tiles[cell.r * corridor.width + cell.c]).not.toBe('wall');
      prev = cell;
    }
  });

  it('returns an empty path when already at the target', () => {
    expect(findPath(corridor, corridor.start, corridor.start)).toEqual([]);
  });

  it('returns null when the target is unreachable', () => {
    expect(findPath(sealed, sealed.start, sealed.waypoints[0])).toBeNull();
  });
});
