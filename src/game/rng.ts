/**
 * Seeded PRNG (mulberry32). All sim randomness goes through an Rng so a run is
 * reproducible from its seed. The state is a plain object so it clones with the run.
 */
export interface Rng {
  s: number;
}

export function createRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** Float in [0, 1). Advances the rng. */
export function nextFloat(rng: Rng): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [lo, hi], both inclusive. */
export function nextInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(nextFloat(rng) * (hi - lo + 1));
}

/** Fisher-Yates shuffle into a new array; the input is not modified. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
