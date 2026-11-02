# Stacked Out — v0.1 implementation spec (Dev, 2026-11-02)

Source brief: /opt/data/projects/_briefs/stacked-out/BRIEF.md. Mechanics research: /opt/data/projects/_research/decked-out-clank-research.md (sections 2–5).
Original 2D stealth-greed dungeon deckbuilder. IP rule: no "Clank"/"Decked Out"/Minecraft names, card names, text, art or sounds. Placeholder shapes + WebAudio-synthesised sounds only.

## Stack
TypeScript (strict) + Vite + React 18 + @react-three/fiber + three. Vitest for tests. No other runtime deps (no drei unless a single tiny import is clearly worth it; prefer none). `base: './'` in the build config; preview server `allowedHosts: ['.trycloudflare.com']`, port 4180, host 127.0.0.1.
npm scripts: `dev`, `build` (= tsc -b && bundle), `preview` (port 4180), `typecheck` (tsc --noEmit), `test` (vitest run).

## Layout
- `src/config.ts` — EVERY tunable lives here (one exported `CONFIG` object, commented). Nothing numeric hard-coded elsewhere.
- `src/game/rng.ts` — seeded RNG (mulberry32). All sim randomness goes through it.
- `src/game/level.ts` — the hand-authored ASCII map + parser → `Level` (width, height, tiles grid, spawn/exit, artifact candidate spots, guardian patrol waypoints, flood-able tiles).
- `src/game/cards.ts` — card definitions (data) + effect application.
- `src/game/path.ts` — grid BFS (or A*) pathfinding on walkable tiles.
- `src/game/sim.ts` — pure deterministic sim: `createRun(deckCardIds, seed, level?) => RunState` and `step(state, dt, input: {moveX, moveY}) => RunState` (may mutate a cloned state; must be deterministic for a given seed + input sequence). Events emitted on the state (`state.events: GameEvent[]`, cleared each step) for UI/sound: cardDrawn, baneAdded, noise, lootFound, hazard, artifactTaken, detected, caught, escaped.
- `src/game/persist.ts` — localStorage profile under key `stacked-out:v1`: `{ coins, embers, collection: CardId[], lastDeck: CardId[] }` with safe defaults + corrupt-data fallback. Also `bankRun(profile, result)` and `buyCard(profile, cardId)` pure helpers.
- `src/ui/*`, `src/render/*` — React HUD + R3F scene (phase 2).
- Tests in `src/game/*.test.ts`.

## Map
One hand-authored level ~24x32 tiles (portrait-friendly), legend:
`#` wall, `.` floor, `,` creaky floor (+1 noise when the player enters the tile; per-tile cooldown CONFIG.creakCooldownS), `S` entrance/exit (player spawns here; stepping back on it with the artifact = escape), `A` artifact candidate spot (4 spots, deeper = higher value range), `1`–`6` guardian patrol waypoints (floor), `~` flood-able floor (normal floor until a hazard floods it).
Must be fully connected; tests assert every non-wall tile is reachable from S.

## Run rules
- Player: continuous position in tile units, circle radius CONFIG.playerRadius, grid collision against walls (axis-separated slide). Speed CONFIG.playerSpeed tiles/s, ×CONFIG.quickstepMult while Quickstep active, ×CONFIG.floodSlowMult on flooded tiles.
- Deck: chosen deck (≤ CONFIG.deckCap cards) shuffled at run start. First card drawn after CONFIG.firstDrawS, then every CONFIG.drawIntervalS (30). Drawn cards auto-resolve. Empty draw pile = no more draws (UI shows "deck empty").
- Bane card "Clatter" (+2 noise) shuffled into the draw pile every CONFIG.baneIntervalS (120).
- Noise: 0..CONFIG.noiseMax (15). Sources: creaky tile +1, Clatter +2, taking the artifact +3, Greedy Grab +2. Noise is first absorbed by `noiseBlock` counters (1 per point). At max: loot drops stop; every further point is overflow → absorbed by `hazardBlock` counters, otherwise triggers a hazard: flood CONFIG.floodTilesPerHazard `~` tiles (nearest to the player first) for CONFIG.floodDurationS.
- Loot: every CONFIG.lootIntervalS while noise < max, +rand(CONFIG.lootMin..lootMax) run coins.
- Guardian: patrols waypoints 1→6 in order via pathfinding at CONFIG.guardSpeed. Detection radius = CONFIG.detectBase + noise × CONFIG.detectPerNoise tiles (Still Air reduces it). Player inside radius → chase (CONFIG.guardChaseSpeed, path re-planned every CONFIG.repathS); loses the player after CONFIG.loseInterestS outside radius, then returns to patrol. Distance < CONFIG.catchDist → run failed, run coins/artifact lost (embers from cards are kept, see cards).
- Artifact: placed at one random `A` spot (seeded), value rand within that spot's range. Compass bearing (radians) toward artifact until held, then toward exit; exposed on state for the UI.
- End: player on S with artifact → escaped: bank runCoins + artifactValue (coins) + runEmbers. On S without artifact the run doesn't end (show hint "No artifact — no payout"); there is a "Give up" button that ends the run with only embers banked.
- Post-run: results + shop offering CONFIG.shopOffers random card types at their prices (coins); buy at most 1 per post-run; bought card joins collection. Deck builder only allows cards from the collection (duplicates allowed as owned).

## Cards (8 originals + bane)
| id | name | type | effect | shop price |
|---|---|---|---|---|
| muffle | Muffle | block-noise | +2 noiseBlock | 6 |
| deep_hush | Deep Hush | block-noise | +4 noiseBlock | 14 |
| ward_stone | Ward Stone | block-hazard | +2 hazardBlock | 8 |
| pocket_find | Pocket Find | loot | +3 run coins | 8 |
| ember_pouch | Ember Pouch | ember | +2 run embers (embers bank even on give-up, lost if caught) | 10 |
| quickstep | Quickstep | speed | speed ×1.4 for 15 s | 10 |
| greedy_grab | Greedy Grab | greedy | +7 run coins, +2 noise | 12 |
| still_air | Still Air | stealth | guardian detection radius −2 for 20 s | 12 |
| clatter (bane) | Clatter | bane | +2 noise | — |
Starter collection: muffle, muffle, ward_stone, pocket_find, ember_pouch, quickstep, greedy_grab. deckCap 6. Card text written fresh; all numbers come from CONFIG.

## Sound
WebAudio synthesised only: heartbeat (two low thumps) whose interval lerps CONFIG.heartbeatSlowS → heartbeatFastS with noise/noiseMax; short blips for card draw, loot, hazard, caught, escape. Audio starts on first user gesture (mobile autoplay rules). Mute toggle.

## UI (mobile-first, portrait)
Screens: Title/Deck builder → Run → Post-run (results + shop) → back to Deck builder.
Run HUD: noise meter (with block/hazard-block counters), next-draw countdown + last drawn card, deck remaining, run coins/embers, compass arrow, give-up button, status hints. Controls: virtual joystick (bottom area, pointer events, works with touch + mouse) and WASD/arrows. All touch targets ≥ 44 px; `touch-action: none` on the play area; no page scroll/zoom during play.
Rendering: orthographic top-down camera following the player; tiles via InstancedMesh per tile type; simple coloured quads/circles for player, guardian (with translucent detection ring), artifact, exit; flooded tiles tinted blue.
