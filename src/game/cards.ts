import { CONFIG } from '../config';
import { shuffle, type Rng } from './rng';

export type CardId =
  | 'muffle'
  | 'deep_hush'
  | 'ward_stone'
  | 'pocket_find'
  | 'ember_pouch'
  | 'quickstep'
  | 'greedy_grab'
  | 'still_air'
  | 'clatter';

export type CardType = 'block-noise' | 'block-hazard' | 'loot' | 'ember' | 'speed' | 'greedy' | 'stealth' | 'bane';

export interface CardDef {
  id: CardId;
  name: string;
  type: CardType;
  text: string;
  /** Shop price in coins; null when the card is not sold. */
  price: number | null;
}

/**
 * What a drawn card does to the run. The sim applies these (noise and hazard logic
 * live there). Numbers come from CONFIG.cards.
 */
export type CardEffect =
  | { kind: 'noiseBlock'; amount: number }
  | { kind: 'hazardBlock'; amount: number }
  | { kind: 'coins'; amount: number }
  | { kind: 'embers'; amount: number }
  | { kind: 'buff'; buff: 'quickstep' | 'still_air'; durationS: number }
  | { kind: 'greedy'; coins: number; noise: number }
  | { kind: 'noise'; amount: number };

const C = CONFIG.cards;

export const CARD_DEFS: Record<CardId, CardDef> = {
  muffle: {
    id: 'muffle',
    name: 'Muffle',
    type: 'block-noise',
    text: `Soaks up ${C.muffleBlock} noise before the meter moves.`,
    price: C.prices.muffle ?? null,
  },
  deep_hush: {
    id: 'deep_hush',
    name: 'Deep Hush',
    type: 'block-noise',
    text: `Soaks up ${C.deepHushBlock} noise before the meter moves.`,
    price: C.prices.deep_hush ?? null,
  },
  ward_stone: {
    id: 'ward_stone',
    name: 'Ward Stone',
    type: 'block-hazard',
    text: `Soaks up ${C.wardHazardBlock} overflow points so they cause no flood.`,
    price: C.prices.ward_stone ?? null,
  },
  pocket_find: {
    id: 'pocket_find',
    name: 'Pocket Find',
    type: 'loot',
    text: `+${C.pocketCoins} run coins.`,
    price: C.prices.pocket_find ?? null,
  },
  ember_pouch: {
    id: 'ember_pouch',
    name: 'Ember Pouch',
    type: 'ember',
    text: `+${C.emberPouchEmbers} run embers. Embers bank even on give-up; lost if caught.`,
    price: C.prices.ember_pouch ?? null,
  },
  quickstep: {
    id: 'quickstep',
    name: 'Quickstep',
    type: 'speed',
    text: `Speed x${CONFIG.quickstepMult} for ${C.quickstepDurationS} s.`,
    price: C.prices.quickstep ?? null,
  },
  greedy_grab: {
    id: 'greedy_grab',
    name: 'Greedy Grab',
    type: 'greedy',
    text: `+${C.greedyCoins} run coins, +${C.greedyNoise} noise.`,
    price: C.prices.greedy_grab ?? null,
  },
  still_air: {
    id: 'still_air',
    name: 'Still Air',
    type: 'stealth',
    text: `Guardian detection radius -${C.stillAirReduce} for ${C.stillAirDurationS} s.`,
    price: C.prices.still_air ?? null,
  },
  clatter: {
    id: 'clatter',
    name: 'Clatter',
    type: 'bane',
    text: `+${C.clatterNoise} noise. Shuffled into the draw pile every ${CONFIG.baneIntervalS} s.`,
    price: null,
  },
};

const EFFECTS: Record<CardId, CardEffect> = {
  muffle: { kind: 'noiseBlock', amount: C.muffleBlock },
  deep_hush: { kind: 'noiseBlock', amount: C.deepHushBlock },
  ward_stone: { kind: 'hazardBlock', amount: C.wardHazardBlock },
  pocket_find: { kind: 'coins', amount: C.pocketCoins },
  ember_pouch: { kind: 'embers', amount: C.emberPouchEmbers },
  quickstep: { kind: 'buff', buff: 'quickstep', durationS: C.quickstepDurationS },
  greedy_grab: { kind: 'greedy', coins: C.greedyCoins, noise: C.greedyNoise },
  still_air: { kind: 'buff', buff: 'still_air', durationS: C.stillAirDurationS },
  clatter: { kind: 'noise', amount: C.clatterNoise },
};

export function cardEffect(id: CardId): CardEffect {
  return EFFECTS[id];
}

/** Cards that can appear in the post-run shop. Clatter is never sold. */
export const SHOP_CARDS: CardId[] = [
  'muffle',
  'deep_hush',
  'ward_stone',
  'pocket_find',
  'ember_pouch',
  'quickstep',
  'greedy_grab',
  'still_air',
];

/** Picks CONFIG.shopOffers distinct random shop cards. */
export function rollShop(rng: Rng, count: number = CONFIG.shopOffers): CardId[] {
  return shuffle(rng, SHOP_CARDS).slice(0, count);
}

export function isCardId(value: unknown): value is CardId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CARD_DEFS, value);
}
