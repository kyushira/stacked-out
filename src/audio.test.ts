import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { heartbeatIntervalS, soundPlanFor } from './audio';
import type { GameEvent } from './game/sim';

describe('heartbeatIntervalS', () => {
  it('runs slow at zero noise, fast at max, and lerps between', () => {
    expect(heartbeatIntervalS(0)).toBeCloseTo(CONFIG.heartbeatSlowS);
    expect(heartbeatIntervalS(CONFIG.noiseMax)).toBeCloseTo(CONFIG.heartbeatFastS);
    const mid = heartbeatIntervalS(CONFIG.noiseMax / 2);
    expect(mid).toBeCloseTo((CONFIG.heartbeatSlowS + CONFIG.heartbeatFastS) / 2);
  });

  it('clamps out-of-range noise', () => {
    expect(heartbeatIntervalS(-3)).toBeCloseTo(CONFIG.heartbeatSlowS);
    expect(heartbeatIntervalS(CONFIG.noiseMax * 4)).toBeCloseTo(CONFIG.heartbeatFastS);
  });
});

describe('soundPlanFor', () => {
  const events: GameEvent[] = [
    { type: 'cardDrawn', cardId: 'muffle' },
    { type: 'lootFound', amount: 2 },
    { type: 'hazard', tiles: 6 },
    { type: 'baneAdded' },
    { type: 'artifactTaken', value: 12 },
    { type: 'caught' },
  ];

  it('gives every blip event a non-empty plan with finite, bounded levels', () => {
    for (const ev of events) {
      const plan = soundPlanFor(ev);
      expect(plan.length, ev.type).toBeGreaterThan(0);
      for (const note of plan) {
        expect(note.vol).toBeGreaterThan(0);
        expect(note.vol).toBeLessThanOrEqual(1);
        expect(note.durS).toBeGreaterThan(0);
        expect(note.atS).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('plays the escape fanfare and stays silent for events without a cue', () => {
    expect(soundPlanFor({ type: 'escaped', result: { status: 'escaped', coinsBanked: 0, embersBanked: 0, artifactValue: 0 } }).length).toBeGreaterThan(1);
    expect(soundPlanFor({ type: 'detected' })).toEqual([]);
    expect(soundPlanFor({ type: 'noise', amount: 1, source: 'creak' })).toEqual([]);
  });
});
