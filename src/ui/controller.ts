import { CONFIG } from '../config';
import type { CardId } from '../game/cards';
import { giveUp, step, type BuffKind, type GameEvent, type GuardMode, type Input, type RunState, type RunStatus } from '../game/sim';
import { combine, keyVector, ZERO, type Vec } from './input';

/**
 * Glue between the pure sim and the React/R3F layer. The sim state lives in a plain
 * object (ref-held by the UI), advanced on a fixed timestep by advanceRun().
 */
export interface RunController {
  state: RunState;
  /** Unconsumed frame time, s. */
  acc: number;
  paused: boolean;
  /** KeyboardEvent.code values currently held. */
  keys: Set<string>;
  /** Joystick output. */
  stick: Vec;
  /** Monotonic event counters the HUD watches to trigger toasts and flashes. */
  counts: { draw: number; hazard: number; detected: number };
}

export function createController(state: RunState): RunController {
  return { state, acc: 0, paused: false, keys: new Set<string>(), stick: ZERO, counts: { draw: 0, hazard: 0, detected: 0 } };
}

export function currentInput(c: RunController): Input {
  const v = combine(keyVector(c.keys), c.stick);
  return { moveX: v.x, moveY: v.y };
}

/**
 * Advances the run by a frame's wall-clock time using a fixed-timestep accumulator.
 * `onEvents` receives each step's events in order (sound is driven from it).
 * Returns the number of sim steps taken.
 */
export function advanceRun(c: RunController, frameDtS: number, onEvents?: (events: GameEvent[]) => void): number {
  if (c.paused || c.state.status !== 'playing') {
    c.acc = 0;
    return 0;
  }
  c.acc += Math.min(Math.max(frameDtS, 0), CONFIG.maxFrameS);
  let steps = 0;
  while (c.acc >= CONFIG.simStepS && steps < CONFIG.maxStepsPerFrame) {
    c.state = step(c.state, CONFIG.simStepS, currentInput(c));
    c.acc -= CONFIG.simStepS;
    steps++;
    tally(c, c.state.events);
    onEvents?.(c.state.events);
    if (c.state.status !== 'playing') {
      c.acc = 0;
      break;
    }
  }
  // Still behind after the per-frame cap: drop the backlog instead of spiralling.
  if (c.acc >= CONFIG.simStepS) c.acc = 0;
  return steps;
}

export function endRun(c: RunController): void {
  c.state = giveUp(c.state);
}

function tally(c: RunController, events: readonly GameEvent[]): void {
  for (const ev of events) {
    if (ev.type === 'cardDrawn') c.counts.draw++;
    else if (ev.type === 'hazard') c.counts.hazard++;
    else if (ev.type === 'detected') c.counts.detected++;
  }
}

export interface HudSnapshot {
  status: RunStatus;
  noise: number;
  noiseMax: number;
  noiseBlock: number;
  hazardBlock: number;
  /** Seconds to the next draw, or null when the pile is empty. */
  nextDrawIn: number | null;
  cardsInPile: number;
  lastDrawn: CardId | null;
  runCoins: number;
  runEmbers: number;
  compassAngle: number;
  artifactHeld: boolean;
  onExit: boolean;
  buffs: { kind: BuffKind; remaining: number }[];
  floodedTiles: number;
  guardMode: GuardMode;
  counts: { draw: number; hazard: number; detected: number };
}

export function snapshotOf(c: RunController): HudSnapshot {
  const s = c.state;
  return {
    status: s.status,
    noise: s.noise,
    noiseMax: CONFIG.noiseMax,
    noiseBlock: s.noiseBlock,
    hazardBlock: s.hazardBlock,
    nextDrawIn: s.nextDrawIn,
    cardsInPile: s.drawPile.length,
    lastDrawn: s.lastDrawn,
    runCoins: s.runCoins,
    runEmbers: s.runEmbers,
    compassAngle: s.compassAngle,
    artifactHeld: s.artifact.held,
    onExit: s.onExit,
    buffs: s.buffs.map((b) => ({ kind: b.kind, remaining: b.remaining })),
    floodedTiles: s.flooded.length,
    guardMode: s.guardian.mode,
    counts: { ...c.counts },
  };
}

export interface RunSummary {
  status: Exclude<RunStatus, 'playing'>;
  runCoins: number;
  runEmbers: number;
  /** Value of the artifact this run (0 if none was ever generated, which never happens). */
  artifactValue: number;
  artifactHeld: boolean;
}

export function summarizeRun(s: RunState): RunSummary | null {
  if (s.status === 'playing') return null;
  return {
    status: s.status,
    runCoins: s.runCoins,
    runEmbers: s.runEmbers,
    artifactValue: s.artifact.value,
    artifactHeld: s.artifact.held,
  };
}
