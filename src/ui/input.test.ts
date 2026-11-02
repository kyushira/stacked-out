import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { combine, isMoveKey, keyVector, stickVector, ZERO } from './input';

describe('stickVector', () => {
  const R = 50;
  const DZ = 0.2;

  it('is zero inside the deadzone and at rest', () => {
    expect(stickVector(0, 0, R, DZ)).toEqual(ZERO);
    expect(stickVector(5, 5, R, DZ)).toEqual(ZERO); // ~0.14 of radius < 0.2
  });

  it('reaches full magnitude at the travel radius and clamps beyond it', () => {
    const edge = stickVector(R, 0, R, DZ);
    expect(edge.x).toBeCloseTo(1);
    expect(edge.y).toBeCloseTo(0);
    const far = stickVector(R * 5, 0, R, DZ);
    expect(far.x).toBeCloseTo(1);
  });

  it('starts from zero at the deadzone edge and keeps direction', () => {
    const justOut = stickVector(R * DZ + 0.01, 0, R, DZ);
    expect(justOut.x).toBeGreaterThan(0);
    expect(justOut.x).toBeLessThan(0.05);
    const diag = stickVector(-30, 40, R, DZ);
    expect(Math.hypot(diag.x, diag.y)).toBeLessThanOrEqual(1);
    expect(diag.x).toBeLessThan(0);
    expect(diag.y).toBeGreaterThan(0);
    expect(diag.y / diag.x).toBeCloseTo(40 / -30);
  });

  it('uses the configured radius and deadzone by default', () => {
    const v = stickVector(CONFIG.joystickRadiusPx, 0);
    expect(v.x).toBeCloseTo(1);
  });
});

describe('keyVector', () => {
  it('maps WASD and arrows; up is negative y', () => {
    expect(keyVector(new Set(['KeyW']))).toEqual({ x: 0, y: -1 });
    expect(keyVector(new Set(['ArrowDown']))).toEqual({ x: 0, y: 1 });
    expect(keyVector(new Set(['KeyA']))).toEqual({ x: -1, y: 0 });
    expect(keyVector(new Set(['ArrowRight']))).toEqual({ x: 1, y: 0 });
  });

  it('cancels opposite keys and ignores non-movement keys', () => {
    expect(keyVector(new Set(['KeyW', 'KeyS']))).toEqual({ x: 0, y: 0 });
    expect(keyVector(new Set(['KeyQ', 'Space']))).toEqual({ x: 0, y: 0 });
  });

  it('clamps diagonal keys to unit axes', () => {
    expect(keyVector(new Set(['KeyW', 'ArrowUp', 'KeyD']))).toEqual({ x: 1, y: -1 });
  });

  it('recognises only the bound codes', () => {
    expect(isMoveKey('KeyD')).toBe(true);
    expect(isMoveKey('KeyE')).toBe(false);
    expect(isMoveKey('constructor')).toBe(false);
  });
});

describe('combine', () => {
  it('sums sources and clamps each axis', () => {
    expect(combine({ x: 0.5, y: 0 }, { x: 0.75, y: -1 })).toEqual({ x: 1, y: -1 });
    expect(combine(ZERO, { x: 0.25, y: 0.5 })).toEqual({ x: 0.25, y: 0.5 });
  });
});
