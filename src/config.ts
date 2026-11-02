import type { CardId } from './game/cards';

/**
 * Every tunable for v0.1 lives here. Nothing numeric is hard-coded in sim, UI or render code.
 * Units: tiles, seconds, and tiles/second unless the name says otherwise.
 */
export const CONFIG = {
  // --- Player ---
  /** Collision circle radius, tiles. */
  playerRadius: 0.35,
  /** Walk speed, tiles/s. */
  playerSpeed: 3.0,
  /** Speed multiplier while Quickstep is active. */
  quickstepMult: 1.4,
  /** Speed multiplier while standing on a flooded tile. */
  floodSlowMult: 0.5,
  /** Distance from artifact centre at which it is picked up, tiles. */
  artifactPickupDist: 0.7,
  /** Frame deltas above this are clamped (keeps collision and timers sane after a stall). */
  maxStepS: 0.1,
  /** Collision is swept in sub-steps of this length so the player stops flush against walls. */
  collisionSubstepTiles: 0.05,

  // --- Deck and draws ---
  deckCap: 6,
  /** Time before the first card is drawn, s. */
  firstDrawS: 20,
  /** Interval between draws after the first, s. */
  drawIntervalS: 30,
  /** Clatter (bane) is shuffled into the draw pile this often, s. */
  baneIntervalS: 120,

  // --- Noise and hazards ---
  noiseMax: 15,
  /** Noise added when the player enters a creaky tile. */
  creakNoise: 1,
  /** Per-tile cooldown before a creaky tile can add noise again, s. */
  creakCooldownS: 3,
  /** Noise added when the artifact is taken. */
  artifactNoise: 3,
  /** Flood-able tiles flooded per hazard. */
  floodTilesPerHazard: 6,
  /** How long a flooded tile stays flooded, s. */
  floodDurationS: 12,

  // --- Loot ---
  lootIntervalS: 8,
  lootMin: 1,
  lootMax: 3,

  // --- Guardian ---
  /** Patrol speed, tiles/s. */
  guardSpeed: 1.8,
  /** Chase speed, tiles/s. */
  guardChaseSpeed: 2.8,
  /** Detection radius = detectBase + noise * detectPerNoise, tiles. */
  detectBase: 3,
  detectPerNoise: 0.4,
  /** Chase path is re-planned this often, s. */
  repathS: 0.5,
  /** Time outside detection radius before the guardian gives up the chase, s. */
  loseInterestS: 4,
  /** Distance at which the guardian catches the player, tiles. */
  catchDist: 0.8,

  // --- Artifact ---
  /** Value range [min, max] per artifact candidate spot, shallowest first. */
  artifactRanges: [
    [5, 10],
    [10, 18],
    [18, 28],
    [28, 40],
  ] as [number, number][],

  // --- Cards ---
  cards: {
    muffleBlock: 2,
    deepHushBlock: 4,
    wardHazardBlock: 2,
    pocketCoins: 3,
    emberPouchEmbers: 2,
    quickstepDurationS: 15,
    greedyCoins: 7,
    greedyNoise: 2,
    stillAirReduce: 2,
    stillAirDurationS: 20,
    clatterNoise: 2,
    /** Shop prices in coins. Clatter is not sold, so it has no entry. */
    prices: {
      muffle: 6,
      deep_hush: 14,
      ward_stone: 8,
      pocket_find: 8,
      ember_pouch: 10,
      quickstep: 10,
      greedy_grab: 12,
      still_air: 12,
    } as Partial<Record<CardId, number>>,
  },
  /** Random cards offered in each post-run shop. */
  shopOffers: 3,
  startCoins: 0,
  startEmbers: 0,
  starterCollection: [
    'muffle',
    'muffle',
    'ward_stone',
    'pocket_find',
    'ember_pouch',
    'quickstep',
    'greedy_grab',
  ] as CardId[],

  // --- Sound ---
  /** Heartbeat interval at zero noise, s. */
  heartbeatSlowS: 1.4,
  /** Heartbeat interval at max noise, s. */
  heartbeatFastS: 0.45,
  /** Gap between the two thumps of one heartbeat, s. */
  heartbeatDubGapS: 0.18,
  /** Master level for sound effects (0..1). */
  sfxVolume: 0.5,
  /** Heartbeat thump level (0..1, before master). */
  heartbeatVolume: 0.6,

  // --- Simulation loop (UI) ---
  /** Fixed timestep the sim advances by, s. */
  simStepS: 1 / 60,
  /** Frame time fed to the accumulator is clamped to this, s (covers tab stalls). */
  maxFrameS: 0.25,
  /** Upper bound on sim steps per rendered frame (spiral-of-death guard). */
  maxStepsPerFrame: 8,
  /** How often the HUD snapshot is pushed into React state, s. */
  hudRefreshS: 0.1,
  /** Pause between the run ending and the post-run screen, s. */
  runEndDelayS: 1,
  /** How long the card-drawn toast stays on screen, s. */
  toastS: 2.5,
  /** Length of the hazard / detected screen flash, s. */
  flashS: 0.6,
  /** How long give-up stays armed waiting for a second tap, s. */
  giveUpArmS: 3,

  // --- Camera and scene ---
  /** Tiles visible across the screen width and height; the zoom fits both. */
  cameraTilesWide: 9.5,
  cameraTilesTall: 12,
  /** Guardian half-size, tiles. */
  guardianSize: 0.7,
  /** Artifact glow radius, tiles. */
  artifactSize: 0.9,
  /** Exit ring outer radius, tiles. */
  exitRadius: 0.5,
  /** Tile quad size as a fraction of a cell, so grid lines show between tiles. */
  tileInset: 0.94,

  // --- Input ---
  /** Joystick deadzone as a fraction of its travel radius. */
  joystickDeadzone: 0.15,
  /** Joystick travel radius, css px. */
  joystickRadiusPx: 56,
};
