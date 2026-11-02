# Stacked Out

A small top-down stealth-greed dungeon deckbuilder (v0.1 vertical slice), inspired by classic push-your-luck dungeon deckbuilders. Sneak in, grab the artifact, get out before the guardian hears you.

Stack: TypeScript, Vite, React 18, React Three Fiber (three.js), Vitest. Design contract: `docs/SPEC-v0.1.md`.

## Run it

    npm ci
    npm run dev        # local dev server
    npm test           # unit tests (sim, persistence, input, audio scheduling)
    npm run typecheck
    npm run build      # production build into dist/
    npm run preview    # serve dist/ on 127.0.0.1:4180

## Controls

- Phone: touch anywhere in the lower part of the screen and drag to move (floating joystick).
- Desktop: WASD or arrow keys.
- HUD buttons: mute, give up (tap twice to confirm).

## Rules (v0.1)

1. At camp, pick up to 6 cards from your collection and enter the dungeon.
2. Your deck is shuffled. A card is drawn and auto-played every 30 s (timer on the HUD). Every 2 minutes a "Clatter" (+2 noise) is shuffled into your deck.
3. Noise (0-15) rises from creaky floor (+1), Clatter (+2) and taking the artifact (+3). Block counters soak noise first. At max noise loot stops dropping and each extra point floods nearby tiles (slows you) unless a hazard block absorbs it. The heartbeat speeds up with noise.
4. The guardian patrols; its detection ring grows with noise. If it touches you, the run fails and you lose run loot.
5. The compass points to the artifact, then to the exit. Escape with it to bank run coins + artifact value + embers. Without the artifact there is no payout (Give up keeps embers only).
6. After the run, buy one card from the shop into your persistent collection (saved in localStorage).

## Cards

Muffle (+2 noise block), Deep Hush (+4 noise block), Ward Stone (+2 hazard block), Pocket Find (+3 coins), Ember Pouch (+2 embers), Quickstep (faster for 15 s), Greedy Grab (+7 coins, +2 noise), Still Air (guardian detection -2 for 20 s). Bane: Clatter (+2 noise).

## Tunables

Every number lives in `src/config.ts` (one `CONFIG` object, commented). Main groups:

| Area | Keys |
|---|---|
| Movement | playerSpeed, playerRadius, quickstepMult, floodSlowMult |
| Deck / timing | deckCap, firstDrawS, drawIntervalS, baneIntervalS |
| Noise / hazards | noiseMax, creakNoise, creakCooldownS, artifactNoise, floodTilesPerHazard, floodDurationS |
| Loot | lootIntervalS, lootMin, lootMax, artifactRanges |
| Guardian | guardSpeed, guardChaseSpeed, detectBase, detectPerNoise, repathS, loseInterestS, catchDist |
| Cards / shop | cards.*, prices.*, shopOffers, starterCollection, startCoins, startEmbers |
| Audio | heartbeatSlowS, heartbeatFastS, sfxVolume, heartbeatVolume |
| Camera / UI | cameraTilesWide, cameraTilesTall, hudRefreshS, joystickDeadzone, joystickRadiusPx |

The map is the ASCII grid in `src/game/level.ts` (`#` wall, `.` floor, `,` creaky, `~` floodable, `S` entrance/exit, `A` artifact spot, `1`-`6` patrol waypoints).

## Credits

No third-party art or audio. All visuals are plain shapes; all sounds are synthesised with WebAudio at runtime. Names, card text and the map are original.
