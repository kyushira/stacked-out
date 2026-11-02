import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, nextInt, shuffle } from './rng';

describe('seeded rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 50 }, () => nextFloat(a));
    const seqB = Array.from({ length: 50 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('produces floats in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt is inclusive on both ends and hits both', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(nextInt(rng, 1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('shuffle returns a permutation and leaves the input untouched', () => {
    const rng = createRng(7);
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(rng, input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
