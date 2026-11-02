import { describe, it, expect } from 'vitest';
import { CONFIG } from '../config';
import { LEVEL, parseLevel } from './level';
import {
  createRun,
  detectionRadius,
  giveUp,
  resultOf,
  step,
  type GameEvent,
  type RunState,
} from './sim';

// 12x5 test room. S at (1,1); creaky tile at (3,1); artifact spot at (9,1);
// two flood-able tiles at (3,2),(4,2) and one at (10,2); the single guardian
// waypoint sits in the far corner at (10,3) so the guardian stays put unless
// the player comes close. Keeps timing/noise tests isolated from patrols.
const TINY = parseLevel([
  '############',
  '#S.,.....A.#',
  '#..~~.....~#',
  '#.........1#',
  '############',
]);

const IDLE = { moveX: 0, moveY: 0 };
const RIGHT = { moveX: 1, moveY: 0 };
const LEFT = { moveX: -1, moveY: 0 };

interface Timed {
  t: number;
  event: GameEvent;
}

function simulate(start: RunState, seconds: number, input = IDLE): { state: RunState; timed: Timed[] } {
  let state = start;
  const timed: Timed[] = [];
  const steps = Math.round(seconds / 0.1);
  for (let i = 0; i < steps; i++) {
    state = step(state, 0.1, input);
    for (const event of state.events) timed.push({ t: state.elapsed, event });
  }
  return { state, timed };
}

const eventsOf = (timed: Timed[], type: GameEvent['type']) => timed.filter((x) => x.event.type === type);

describe('movement and collision', () => {
  it('cannot walk into a wall: stops against it', () => {
    const s = createRun([], 1, TINY);
    s.player = { x: 1.5, y: 1.5 };
    const { state } = simulate(s, 2, LEFT);
    expect(state.player.x).toBeGreaterThanOrEqual(1 + CONFIG.playerRadius - 1e-9);
    expect(state.player.x).toBeLessThan(1 + CONFIG.playerRadius + 0.06);
    expect(state.player.y).toBeCloseTo(1.5, 9);
  });

  it('blocks each axis independently when moving diagonally into a corner', () => {
    const s = createRun([], 1, TINY);
    s.player = { x: 1.5, y: 1.5 };
    const { state } = simulate(s, 2, { moveX: -1, moveY: -1 });
    const edge = 1 + CONFIG.playerRadius;
    expect(state.player.x).toBeGreaterThanOrEqual(edge - 1e-9);
    expect(state.player.x).toBeLessThan(edge + 0.06);
    expect(state.player.y).toBeGreaterThanOrEqual(edge - 1e-9);
    expect(state.player.y).toBeLessThan(edge + 0.06);
  });
});

describe('draw cadence and bane', () => {
  it('draws nothing before firstDrawS, then one card every drawIntervalS', () => {
    const s = createRun(['muffle', 'pocket_find', 'ember_pouch'], 1, TINY);
    const early = simulate(s, CONFIG.firstDrawS - 0.5);
    expect(eventsOf(early.timed, 'cardDrawn')).toHaveLength(0);

    const { timed } = simulate(s, 85);
    const draws = eventsOf(timed, 'cardDrawn').map((x) => x.t);
    expect(draws).toHaveLength(3);
    expect(draws[0]).toBeGreaterThanOrEqual(CONFIG.firstDrawS - 0.05);
    expect(draws[0]).toBeLessThan(CONFIG.firstDrawS + 0.15);
    expect(draws[1] - draws[0]).toBeCloseTo(CONFIG.drawIntervalS, 0);
    expect(draws[2] - draws[1]).toBeCloseTo(CONFIG.drawIntervalS, 0);
  });

  it('adds Clatter to the draw pile every baneIntervalS', () => {
    const s = createRun([], 1, TINY);
    const { timed } = simulate(s, 245);
    const banes = eventsOf(timed, 'baneAdded').map((x) => x.t);
    expect(banes).toHaveLength(2);
    expect(banes[0]).toBeCloseTo(CONFIG.baneIntervalS, 0);
    expect(banes[1] - banes[0]).toBeCloseTo(CONFIG.baneIntervalS, 0);
  });
});

describe('noise and hazards', () => {
  it('noise block absorbs points before the meter moves', () => {
    const s = createRun([], 1, TINY);
    s.drawPile = ['clatter'];
    s.drawTimer = 0.05;
    s.noiseBlock = 1;
    const out = step(s, 0.1, IDLE);
    expect(out.noiseBlock).toBe(0);
    expect(out.noise).toBe(1); // Clatter is +2: one absorbed, one hits the meter
  });

  it('overflow at max noise triggers a hazard flood', () => {
    const s = createRun([], 1, TINY);
    s.noise = CONFIG.noiseMax;
    s.drawPile = ['clatter'];
    s.drawTimer = 0.05;
    const out = step(s, 0.1, IDLE);
    expect(out.noise).toBe(CONFIG.noiseMax);
    expect(out.events.filter((e) => e.type === 'hazard')).toHaveLength(2);
    expect(out.flooded).toHaveLength(3); // only three flood-able tiles exist here
  });

  it('hazard block absorbs overflow instead of flooding', () => {
    const s = createRun([], 1, TINY);
    s.noise = CONFIG.noiseMax;
    s.hazardBlock = 2;
    s.drawPile = ['clatter'];
    s.drawTimer = 0.05;
    const out = step(s, 0.1, IDLE);
    expect(out.hazardBlock).toBe(0);
    expect(out.flooded).toHaveLength(0);
    expect(out.events.filter((e) => e.type === 'hazard')).toHaveLength(0);
  });

  it('overflow floods the nearest flood-able tiles to the player first', () => {
    const s = createRun([], 1, LEVEL);
    s.noise = CONFIG.noiseMax;
    s.drawPile = ['clatter'];
    s.drawTimer = 0.05;
    const out = step(s, 0.1, IDLE);
    const flooded = out.flooded.map((f) => `${f.c},${f.r}`).sort();
    // The player spawns at the bottom of the map; row 11 is the nearest flood-able row.
    expect(flooded).toEqual(['10,11', '11,11', '12,11', '13,11', '14,11', '9,11'].sort());
  });

  it('loot is awarded every lootIntervalS while noise is below max', () => {
    const s = createRun([], 1, TINY);
    s.lootTimer = CONFIG.lootIntervalS - 0.05;
    const out = step(s, 0.1, IDLE);
    expect(out.events.filter((e) => e.type === 'lootFound')).toHaveLength(1);
    expect(out.runCoins).toBeGreaterThanOrEqual(CONFIG.lootMin);
    expect(out.runCoins).toBeLessThanOrEqual(CONFIG.lootMax);
  });

  it('loot stops once noise is at max', () => {
    const s = createRun([], 1, TINY);
    s.noise = CONFIG.noiseMax;
    s.lootTimer = CONFIG.lootIntervalS - 0.05;
    const out = step(s, 0.1, IDLE);
    expect(out.runCoins).toBe(0);
    expect(out.events.filter((e) => e.type === 'lootFound')).toHaveLength(0);
  });

  it('creaky tile adds +1 noise on entry and respects a per-tile cooldown', () => {
    let s = createRun([], 1, TINY);
    s.player = { x: 2.9, y: 1.5 };
    s = step(s, 0.1, RIGHT); // enters creaky (3,1)
    expect(s.noise).toBe(1);

    s.player = { x: 2.9, y: 1.5 };
    s = step(s, 0.1, RIGHT); // re-enters while on cooldown
    expect(s.noise).toBe(1);

    s = simulate(s, CONFIG.creakCooldownS + 0.5).state; // stand still until cooldown expires
    s.player = { x: 2.9, y: 1.5 };
    s = step(s, 0.1, RIGHT);
    expect(s.noise).toBe(1 + CONFIG.creakNoise);
  });
});

describe('artifact and escape', () => {
  it('picking up the artifact adds noise and flips the compass to the exit', () => {
    let s = createRun([], 1, TINY);
    expect(s.compassAngle).toBeCloseTo(0, 6); // artifact is due east of S

    s.player = { x: 9.5, y: 1.5 };
    s = step(s, 0.1, IDLE);
    expect(s.artifact.held).toBe(true);
    expect(s.noise).toBe(CONFIG.artifactNoise);
    expect(s.events.some((e) => e.type === 'artifactTaken')).toBe(true);
    expect(s.compassAngle).toBeCloseTo(Math.PI, 6); // exit is due west now
    expect(s.artifact.value).toBeGreaterThanOrEqual(CONFIG.artifactRanges[0][0]);
    expect(s.artifact.value).toBeLessThanOrEqual(CONFIG.artifactRanges[0][1]);
  });

  it('standing on S without the artifact does not end the run', () => {
    const { state } = simulate(createRun([], 1, TINY), 3);
    expect(state.status).toBe('playing');
    expect(state.onExit).toBe(true);
  });

  it('escape with the artifact banks run coins + artifact value + run embers', () => {
    let s = createRun([], 1, TINY);
    s.runCoins = 4;
    s.runEmbers = 2;
    s.player = { x: 9.5, y: 1.5 };
    s = step(s, 0.1, IDLE);
    s.player = { x: 1.5, y: 1.5 };
    s = step(s, 0.1, IDLE);
    expect(s.status).toBe('escaped');
    expect(resultOf(s)).toEqual({
      status: 'escaped',
      coinsBanked: 4 + s.artifact.value,
      embersBanked: 2,
      artifactValue: s.artifact.value,
    });
    expect(s.events.some((e) => e.type === 'escaped')).toBe(true);
  });
});

describe('caught and give-up', () => {
  it('being caught loses run coins, artifact and run embers', () => {
    let s = createRun([], 1, TINY);
    s.runCoins = 10;
    s.runEmbers = 3;
    s.player = { x: s.guardian.x, y: s.guardian.y };
    s = step(s, 0.1, IDLE);
    expect(s.status).toBe('caught');
    expect(s.events.some((e) => e.type === 'caught')).toBe(true);
    expect(resultOf(s)).toEqual({ status: 'caught', coinsBanked: 0, embersBanked: 0, artifactValue: 0 });
  });

  it('give-up banks run embers only', () => {
    const s = createRun([], 1, TINY);
    s.runCoins = 7;
    s.runEmbers = 3;
    const out = giveUp(s);
    expect(out.status).toBe('gaveUp');
    expect(resultOf(out)).toEqual({ status: 'gaveUp', coinsBanked: 0, embersBanked: 3, artifactValue: 0 });
  });
});

describe('guardian and detection', () => {
  it('detection radius grows with noise and Still Air shrinks it', () => {
    expect(detectionRadius(10, false)).toBeGreaterThan(detectionRadius(0, false));
    expect(detectionRadius(10, false)).toBeCloseTo(CONFIG.detectBase + 10 * CONFIG.detectPerNoise, 9);
    expect(detectionRadius(0, true)).toBe(detectionRadius(0, false) - CONFIG.cards.stillAirReduce);
  });

  it('guardian catches a stationary player standing near its patrol', () => {
    const s = createRun([], 7);
    s.player = { x: s.guardian.x, y: s.guardian.y + 2 };
    const { state, timed } = simulate(s, 30);
    expect(eventsOf(timed, 'detected').length).toBeGreaterThan(0);
    expect(state.status).toBe('caught');
  });
});

describe('determinism and purity', () => {
  const DECK = ['muffle', 'greedy_grab', 'pocket_find', 'ember_pouch', 'quickstep', 'still_air'] as const;
  const play = (seed: number, n: number): RunState => {
    let s = createRun([...DECK], seed);
    for (let i = 0; i < n; i++) {
      s = step(s, 0.1, { moveX: Math.sin(i * 0.37), moveY: Math.cos(i * 0.23) });
    }
    return s;
  };

  it('same seed + same inputs gives an identical state', () => {
    expect(JSON.stringify(play(42, 600))).toBe(JSON.stringify(play(42, 600)));
  });

  it('a different seed gives a different run', () => {
    expect(JSON.stringify(play(42, 600))).not.toBe(JSON.stringify(play(43, 600)));
  });

  it('step does not mutate its input state', () => {
    const s = createRun([...DECK], 5);
    const before = JSON.stringify(s);
    step(s, 0.1, RIGHT);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('createRun rejects a deck over deckCap', () => {
    expect(() => createRun(Array(CONFIG.deckCap + 1).fill('muffle'), 1)).toThrow(RangeError);
  });
});
