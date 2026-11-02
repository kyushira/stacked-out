import type { CardType } from '../game/cards';

/** Human labels for card types, shown on card faces. */
export const TYPE_LABEL: Record<CardType, string> = {
  'block-noise': 'Noise block',
  'block-hazard': 'Hazard block',
  loot: 'Loot',
  ember: 'Embers',
  speed: 'Speed',
  greedy: 'Greedy',
  stealth: 'Stealth',
  bane: 'Bane',
};
