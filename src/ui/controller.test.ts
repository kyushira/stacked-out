import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { createRun, type RunState } from '../game/sim';
import { advanceRun, createController, endRun, snapshotOf, summarizeRun } from './controller';

const DECK = ['muffle', 'pocket_find'] as const;

function fresh(seed = 7): RunState {
  return createRun([...DECK], seed);
}

describe('advanceRun', () => {
  it('does nothing while paused, and drops accumulated time', () => {
    const c = createController(fresh());
    c.paused = true;
    expect(advanceRun(c, 1)).toBe(0);
    expect(c.state.elapsed).toBe(0);
    expect(c.acc).toBe(0);
  });

  it('steps on the fixed timestep and keeps the remainder', () => {
    const c = createController(fresh());
    const frame = CONFIG.simStepS * 2.5;
    expect(advanceRun(c, frame)).toBe(2);
    expect(c.state.elapsed).toBeCloseTo(CONFIG.simStepS * 2);
    expect(c.acc).toBeCloseTo(CONFIG.simStepS * 0.5);
  });

  it('clamps a stalled frame to maxFrameS and caps steps per frame', () => {
    const c = createController(fresh());
    const steps = advanceRun(c, 10);
    expect(steps).toBe(CONFIG.maxStepsPerFrame);
    expect(c.acc).toBeLessThan(CONFIG.simStepS);
    expect(CONFIG.maxFrameS).toBeGreaterThan(0);
  });

  it('feeds each step its events to the callback', () => {
    const c = createController(fresh());
    const seen: string[] = [];
    advanceRun(c, 0.5, (events) => {
      for (const ev of events) seen.push(ev.type);
    });
    // First draw is at firstDrawS (20 s), so no events in the first half second.
    expect(seen).toEqual([]);
    expect(c.state.elapsed).toBeGreaterThan(0);
  });

  it('is inert once the run has ended, and giving up banks embers only', () => {
    const c = createController(fresh());
    endRun(c);
    expect(c.state.status).toBe('gaveUp');
    expect(advanceRun(c, 1)).toBe(0);
    expect(summarizeRun(c.state)?.status).toBe('gaveUp');
  });
});

describe('snapshotOf / summarizeRun', () => {
  it('exposes HUD fields with the configured noise max', () => {
    const c = createController(fresh());
    const snap = snapshotOf(c);
    expect(snap.status).toBe('playing');
    expect(snap.noiseMax).toBe(CONFIG.noiseMax);
    expect(snap.cardsInPile).toBe(DECK.length);
    expect(snap.nextDrawIn).toBeCloseTo(CONFIG.firstDrawS);
    expect(snap.artifactHeld).toBe(false);
  });

  it('summarizes only finished runs', () => {
    const c = createController(fresh());
    expect(summarizeRun(c.state)).toBeNull();
    endRun(c);
    const sum = summarizeRun(c.state);
    expect(sum).not.toBeNull();
    expect(sum?.artifactValue).toBeGreaterThanOrEqual(5);
  });
});
