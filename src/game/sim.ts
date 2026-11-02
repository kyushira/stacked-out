import { CONFIG } from '../config';
import { CARD_DEFS, cardEffect, isCardId, type CardId } from './cards';
import { LEVEL, type Cell, type Level } from './level';
import { distanceMap, findPath, walkable } from './path';
import { createRng, nextInt, shuffle, type Rng } from './rng';

/**
 * Pure, deterministic run simulation: no DOM, no Math.random, no Date.
 * step() never mutates its input; it works on a structured clone.
 */

export type RunStatus = 'playing' | 'escaped' | 'caught' | 'gaveUp';
export type GuardMode = 'patrol' | 'chase';
export type NoiseSource = 'creak' | 'clatter' | 'artifact' | 'greedy';
export type BuffKind = 'quickstep' | 'still_air';

export interface RunResult {
  status: Exclude<RunStatus, 'playing'>;
  /** Coins to bank. On escape this already includes the artifact value. */
  coinsBanked: number;
  embersBanked: number;
  artifactValue: number;
}

export type GameEvent =
  | { type: 'cardDrawn'; cardId: CardId }
  | { type: 'baneAdded' }
  | { type: 'noise'; amount: number; source: NoiseSource }
  | { type: 'lootFound'; amount: number }
  | { type: 'hazard'; tiles: number }
  | { type: 'artifactTaken'; value: number }
  | { type: 'detected' }
  | { type: 'caught' }
  | { type: 'escaped'; result: RunResult };

export interface Input {
  /** -1..1 on x (right is +). */
  moveX: number;
  /** -1..1 on y (down is +). */
  moveY: number;
}

export interface Guardian {
  /** Continuous position, tile units (tile centres sit at c + 0.5). */
  x: number;
  y: number;
  mode: GuardMode;
  /** Index into level.waypoints of the next patrol target. */
  target: number;
  path: Cell[];
  repathTimer: number;
  loseTimer: number;
}

export interface Buff {
  kind: BuffKind;
  remaining: number;
}

export interface FloodedTile {
  c: number;
  r: number;
  remaining: number;
}

export interface Artifact {
  c: number;
  r: number;
  value: number;
  held: boolean;
}

export interface RunState {
  /** Shared, read-only map. Not cloned per step. */
  level: Level;
  rng: Rng;
  seed: number;
  status: RunStatus;
  /** Seconds of run time. */
  elapsed: number;
  player: { x: number; y: number };
  /** True when the player stands on the entrance/exit tile. */
  onExit: boolean;
  guardian: Guardian;
  /** Current detection radius, tiles. */
  detectRadius: number;
  noise: number;
  noiseBlock: number;
  hazardBlock: number;
  flooded: FloodedTile[];
  /** Per-tile remaining cooldown for creaky tiles, indexed like level.tiles. */
  creakCooldown: number[];
  /** Top of the pile is index 0. */
  drawPile: CardId[];
  /** Internal countdown to the next scheduled draw, s. */
  drawTimer: number;
  /** Seconds until the next draw, or null when the draw pile is empty. */
  nextDrawIn: number | null;
  lastDrawn: CardId | null;
  baneTimer: number;
  lootTimer: number;
  runCoins: number;
  runEmbers: number;
  artifact: Artifact;
  /** Radians, from the player toward the artifact or, once held, the exit. */
  compassAngle: number;
  buffs: Buff[];
  events: GameEvent[];
}

const cellOf = (x: number, y: number): Cell => ({ c: Math.floor(x), r: Math.floor(y) });
const centreOf = (cell: Cell): { x: number; y: number } => ({ x: cell.c + 0.5, y: cell.r + 0.5 });
const sameCell = (a: Cell, b: Cell): boolean => a.c === b.c && a.r === b.r;
const tileIndex = (level: Level, cell: Cell): number => cell.r * level.width + cell.c;

export function detectionRadius(noise: number, stillAir: boolean): number {
  return Math.max(
    0,
    CONFIG.detectBase + noise * CONFIG.detectPerNoise - (stillAir ? CONFIG.cards.stillAirReduce : 0),
  );
}

/** Starts a run. Throws if the deck is over deckCap. */
export function createRun(deckCardIds: readonly CardId[], seed: number, level: Level = LEVEL): RunState {
  if (deckCardIds.length > CONFIG.deckCap) {
    throw new RangeError(`deck has ${deckCardIds.length} cards, cap is ${CONFIG.deckCap}`);
  }
  if (level.waypoints.length === 0) throw new Error('level needs at least one guardian waypoint');
  for (const id of deckCardIds) {
    if (!isCardId(id)) throw new Error(`unknown card id in deck: ${String(id)}`);
    if (CARD_DEFS[id].type === 'bane') throw new Error(`${id} is a bane card and cannot be chosen for a deck`);
  }

  const rng = createRng(seed);

  // Artifact spots, shallowest first; value range index follows depth rank.
  const depth = distanceMap(level, level.start);
  const spots = level.spots
    .map((spot) => ({ cell: spot.cell, depth: depth[tileIndex(level, spot.cell)] }))
    .filter((spot) => spot.depth >= 0)
    .sort((a, b) => a.depth - b.depth || a.cell.r - b.cell.r || a.cell.c - b.cell.c);
  if (spots.length === 0) throw new Error('level has no reachable artifact spot');

  const spotIndex = nextInt(rng, 0, spots.length - 1);
  const [lo, hi] = CONFIG.artifactRanges[Math.min(spotIndex, CONFIG.artifactRanges.length - 1)];
  const value = nextInt(rng, lo, hi);
  const spot = spots[spotIndex].cell;

  const drawPile = shuffle(rng, deckCardIds);
  const guardStart = centreOf(level.waypoints[0]);

  const s: RunState = {
    level,
    rng,
    seed,
    status: 'playing',
    elapsed: 0,
    player: centreOf(level.start),
    onExit: true,
    guardian: {
      x: guardStart.x,
      y: guardStart.y,
      mode: 'patrol',
      target: level.waypoints.length > 1 ? 1 : 0,
      path: [],
      repathTimer: 0,
      loseTimer: 0,
    },
    detectRadius: detectionRadius(0, false),
    noise: 0,
    noiseBlock: 0,
    hazardBlock: 0,
    flooded: [],
    creakCooldown: new Array<number>(level.width * level.height).fill(0),
    drawPile,
    drawTimer: CONFIG.firstDrawS,
    nextDrawIn: null,
    lastDrawn: null,
    baneTimer: 0,
    lootTimer: 0,
    runCoins: 0,
    runEmbers: 0,
    artifact: { c: spot.c, r: spot.r, value, held: false },
    compassAngle: 0,
    buffs: [],
    events: [],
  };
  refreshDerived(s);
  return s;
}

/** Advances the run by dt seconds. Returns a new state; the input is untouched. */
export function step(prev: RunState, dtIn: number, input: Input): RunState {
  const s = cloneState(prev);
  s.events = [];
  if (s.status !== 'playing') return s;

  // A NaN or infinite frame time would poison every timer and position; treat it as no time passing.
  const dt = Number.isFinite(dtIn) ? Math.min(Math.max(dtIn, 0), CONFIG.maxStepS) : 0;
  s.elapsed += dt;
  decayCreakCooldowns(s, dt);
  movePlayer(s, input, dt);
  pickUpArtifact(s);

  if (s.artifact.held && isOnExit(s)) {
    finish(s, 'escaped');
    refreshDerived(s);
    return s;
  }

  tickLoot(s, dt);
  tickBane(s, dt);
  tickDraws(s, dt);
  decayTimedEffects(s, dt);
  updateGuardian(s, dt);
  refreshDerived(s);
  return s;
}

/** Ends the run now with only run embers banked. No-op once the run has ended. */
export function giveUp(prev: RunState): RunState {
  const s = cloneState(prev);
  s.events = [];
  if (s.status !== 'playing') return s;
  finish(s, 'gaveUp');
  refreshDerived(s);
  return s;
}

/** What a finished run banks. Null while the run is still playing. */
export function resultOf(s: RunState): RunResult | null {
  switch (s.status) {
    case 'playing':
      return null;
    case 'escaped':
      return {
        status: 'escaped',
        coinsBanked: s.runCoins + s.artifact.value,
        embersBanked: s.runEmbers,
        artifactValue: s.artifact.value,
      };
    case 'gaveUp':
      return { status: 'gaveUp', coinsBanked: 0, embersBanked: s.runEmbers, artifactValue: 0 };
    case 'caught':
      return { status: 'caught', coinsBanked: 0, embersBanked: 0, artifactValue: 0 };
  }
}

function cloneState(s: RunState): RunState {
  const { level, ...rest } = s;
  return { ...structuredClone(rest), level };
}

function finish(s: RunState, status: Exclude<RunStatus, 'playing'>): void {
  s.status = status;
  if (status === 'escaped') {
    const result = resultOf(s);
    if (result) s.events.push({ type: 'escaped', result });
  } else if (status === 'caught') {
    s.events.push({ type: 'caught' });
  }
}

/** Recomputes fields the UI reads but that are functions of other state. */
function refreshDerived(s: RunState): void {
  const { level, player } = s;
  s.onExit = sameCell(cellOf(player.x, player.y), level.start);
  s.nextDrawIn = s.drawPile.length > 0 ? Math.max(0, s.drawTimer) : null;
  const target = s.artifact.held ? centreOf(level.start) : centreOf({ c: s.artifact.c, r: s.artifact.r });
  s.compassAngle = Math.atan2(target.y - player.y, target.x - player.x);
}

function decayCreakCooldowns(s: RunState, dt: number): void {
  for (let i = 0; i < s.creakCooldown.length; i++) {
    if (s.creakCooldown[i] > 0) s.creakCooldown[i] = Math.max(0, s.creakCooldown[i] - dt);
  }
}

function hasBuff(s: RunState, kind: BuffKind): boolean {
  return s.buffs.some((b) => b.kind === kind);
}

function addBuff(s: RunState, kind: BuffKind, durationS: number): void {
  const existing = s.buffs.find((b) => b.kind === kind);
  if (existing) existing.remaining = durationS;
  else s.buffs.push({ kind, remaining: durationS });
}

function isFlooded(s: RunState, cell: Cell): boolean {
  return s.flooded.some((f) => f.c === cell.c && f.r === cell.r);
}

function isOnExit(s: RunState): boolean {
  return sameCell(cellOf(s.player.x, s.player.y), s.level.start);
}

/** True if a circle of `radius` at (x, y) overlaps any wall tile (or out-of-bounds). */
function collides(level: Level, x: number, y: number, radius: number): boolean {
  const c0 = Math.floor(x - radius);
  const c1 = Math.floor(x + radius);
  const r0 = Math.floor(y - radius);
  const r1 = Math.floor(y + radius);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (walkable(level, c, r)) continue;
      const dx = Math.max(c - x, 0, x - (c + 1));
      const dy = Math.max(r - y, 0, y - (r + 1));
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/** Moves along one axis in small sub-steps, stopping flush against the first wall. */
function moveAxis(level: Level, pos: { x: number; y: number }, axis: 'x' | 'y', delta: number): void {
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / CONFIG.collisionSubstepTiles));
  const inc = delta / steps;
  for (let i = 0; i < steps; i++) {
    const nx = axis === 'x' ? pos.x + inc : pos.x;
    const ny = axis === 'y' ? pos.y + inc : pos.y;
    if (collides(level, nx, ny, CONFIG.playerRadius)) return;
    pos.x = nx;
    pos.y = ny;
  }
}

function movePlayer(s: RunState, input: Input, dt: number): void {
  const { level, player } = s;
  let mx = Math.max(-1, Math.min(1, input.moveX));
  let my = Math.max(-1, Math.min(1, input.moveY));
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }

  const before = cellOf(player.x, player.y);
  let speed = CONFIG.playerSpeed;
  if (hasBuff(s, 'quickstep')) speed *= CONFIG.quickstepMult;
  if (isFlooded(s, before)) speed *= CONFIG.floodSlowMult;

  moveAxis(level, player, 'x', mx * speed * dt);
  moveAxis(level, player, 'y', my * speed * dt);

  const after = cellOf(player.x, player.y);
  if (!sameCell(before, after)) {
    const idx = tileIndex(level, after);
    if (level.tiles[idx] === 'creak' && s.creakCooldown[idx] <= 0) {
      s.creakCooldown[idx] = CONFIG.creakCooldownS;
      addNoise(s, CONFIG.creakNoise, 'creak');
    }
  }
}

function pickUpArtifact(s: RunState): void {
  const a = s.artifact;
  if (a.held) return;
  const at = centreOf({ c: a.c, r: a.r });
  if (Math.hypot(at.x - s.player.x, at.y - s.player.y) >= CONFIG.artifactPickupDist) return;
  a.held = true;
  s.events.push({ type: 'artifactTaken', value: a.value });
  addNoise(s, CONFIG.artifactNoise, 'artifact');
}

/**
 * Noise is soaked by noiseBlock first. Past that it fills the meter up to noiseMax.
 * Each point beyond max is overflow: hazardBlock soaks it, otherwise it floods.
 */
function addNoise(s: RunState, amount: number, source: NoiseSource): void {
  if (amount <= 0) return;
  for (let i = 0; i < amount; i++) {
    if (s.noiseBlock > 0) {
      s.noiseBlock--;
    } else if (s.noise < CONFIG.noiseMax) {
      s.noise++;
    } else if (s.hazardBlock > 0) {
      s.hazardBlock--;
    } else {
      triggerHazard(s);
    }
  }
  s.events.push({ type: 'noise', amount, source });
}

/** Floods the flood-able tiles nearest the player. Already-flooded tiles get their timer refreshed. */
function triggerHazard(s: RunState): void {
  const { level, player } = s;
  const candidates: { c: number; r: number; d: number; i: number }[] = [];
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const i = r * level.width + c;
      if (level.tiles[i] !== 'flood') continue;
      const dx = c + 0.5 - player.x;
      const dy = r + 0.5 - player.y;
      candidates.push({ c, r, d: dx * dx + dy * dy, i });
    }
  }
  candidates.sort((a, b) => a.d - b.d || a.i - b.i);
  const picked = candidates.slice(0, CONFIG.floodTilesPerHazard);
  for (const p of picked) {
    const existing = s.flooded.find((f) => f.c === p.c && f.r === p.r);
    if (existing) existing.remaining = Math.max(existing.remaining, CONFIG.floodDurationS);
    else s.flooded.push({ c: p.c, r: p.r, remaining: CONFIG.floodDurationS });
  }
  s.events.push({ type: 'hazard', tiles: picked.length });
}

function tickLoot(s: RunState, dt: number): void {
  s.lootTimer += dt;
  if (s.lootTimer < CONFIG.lootIntervalS) return;
  s.lootTimer -= CONFIG.lootIntervalS;
  if (s.noise >= CONFIG.noiseMax) return;
  const amount = nextInt(s.rng, CONFIG.lootMin, CONFIG.lootMax);
  s.runCoins += amount;
  s.events.push({ type: 'lootFound', amount });
}

function tickBane(s: RunState, dt: number): void {
  s.baneTimer += dt;
  if (s.baneTimer < CONFIG.baneIntervalS) return;
  s.baneTimer -= CONFIG.baneIntervalS;
  const idx = nextInt(s.rng, 0, s.drawPile.length);
  s.drawPile.splice(idx, 0, 'clatter');
  s.events.push({ type: 'baneAdded' });
}

/** Scheduled draws. A tick that finds the pile empty draws nothing; a later Clatter can refill it. */
function tickDraws(s: RunState, dt: number): void {
  s.drawTimer -= dt;
  if (s.drawTimer > 0) return;
  s.drawTimer += CONFIG.drawIntervalS;
  const card = s.drawPile.shift();
  if (card === undefined) return;
  s.lastDrawn = card;
  s.events.push({ type: 'cardDrawn', cardId: card });
  applyCard(s, card);
}

function applyCard(s: RunState, cardId: CardId): void {
  const eff = cardEffect(cardId);
  switch (eff.kind) {
    case 'noiseBlock':
      s.noiseBlock += eff.amount;
      break;
    case 'hazardBlock':
      s.hazardBlock += eff.amount;
      break;
    case 'coins':
      s.runCoins += eff.amount;
      break;
    case 'embers':
      s.runEmbers += eff.amount;
      break;
    case 'buff':
      addBuff(s, eff.buff, eff.durationS);
      break;
    case 'greedy':
      s.runCoins += eff.coins;
      addNoise(s, eff.noise, 'greedy');
      break;
    case 'noise':
      addNoise(s, eff.amount, 'clatter');
      break;
  }
}

function decayTimedEffects(s: RunState, dt: number): void {
  s.buffs = s.buffs.map((b) => ({ kind: b.kind, remaining: b.remaining - dt })).filter((b) => b.remaining > 0);
  s.flooded = s.flooded
    .map((f) => ({ c: f.c, r: f.r, remaining: f.remaining - dt }))
    .filter((f) => f.remaining > 0);
}

/** Moves the guardian one step along its path; advances to the next waypoint when it arrives. */
function followPath(g: Guardian, speed: number, dt: number): void {
  let remaining = speed * dt;
  while (remaining > 0 && g.path.length > 0) {
    const next = g.path[0];
    const tx = next.c + 0.5;
    const ty = next.r + 0.5;
    const dx = tx - g.x;
    const dy = ty - g.y;
    const d = Math.hypot(dx, dy);
    if (d <= remaining) {
      g.x = tx;
      g.y = ty;
      g.path.shift();
      remaining -= d;
    } else {
      g.x += (dx / d) * remaining;
      g.y += (dy / d) * remaining;
      remaining = 0;
    }
  }
}

function patrol(s: RunState, dt: number): void {
  const { level, guardian: g } = s;
  const n = level.waypoints.length;
  if (g.path.length === 0) {
    const here = cellOf(g.x, g.y);
    if (sameCell(here, level.waypoints[g.target])) g.target = (g.target + 1) % n;
    const path = findPath(level, here, level.waypoints[g.target]);
    if (path === null) g.target = (g.target + 1) % n;
    else g.path = path;
  }
  followPath(g, CONFIG.guardSpeed, dt);
}

function chase(s: RunState, dt: number): void {
  const { level, guardian: g, player } = s;
  g.repathTimer -= dt;
  if (g.repathTimer <= 0 || g.path.length === 0) {
    g.path = findPath(level, cellOf(g.x, g.y), cellOf(player.x, player.y)) ?? [];
    g.repathTimer = CONFIG.repathS;
  }
  if (sameCell(cellOf(g.x, g.y), cellOf(player.x, player.y))) {
    // findPath is [] within one cell, so close straight in. One tile has no walls inside it.
    g.path = [];
    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      const move = Math.min(CONFIG.guardChaseSpeed * dt, d);
      g.x += (dx / d) * move;
      g.y += (dy / d) * move;
    }
    return;
  }
  followPath(g, CONFIG.guardChaseSpeed, dt);
}

function updateGuardian(s: RunState, dt: number): void {
  const { guardian: g, player } = s;
  s.detectRadius = detectionRadius(s.noise, hasBuff(s, 'still_air'));
  const dist = Math.hypot(g.x - player.x, g.y - player.y);

  if (g.mode === 'patrol') {
    if (dist < s.detectRadius) {
      g.mode = 'chase';
      g.path = [];
      g.repathTimer = 0;
      g.loseTimer = 0;
      s.events.push({ type: 'detected' });
    }
  } else if (dist < s.detectRadius) {
    g.loseTimer = 0;
  } else {
    g.loseTimer += dt;
    if (g.loseTimer >= CONFIG.loseInterestS) {
      g.mode = 'patrol';
      g.path = [];
      g.loseTimer = 0;
    }
  }

  if (g.mode === 'chase') chase(s, dt);
  else patrol(s, dt);

  if (Math.hypot(g.x - player.x, g.y - player.y) < CONFIG.catchDist) finish(s, 'caught');
}
