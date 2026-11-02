import { CONFIG } from '../config';
import { CARD_DEFS, isCardId, type CardId } from './cards';
import type { RunResult } from './sim';

/** localStorage key for the player profile. */
export const STORAGE_KEY = 'stacked-out:v1';

export interface Profile {
  coins: number;
  embers: number;
  collection: CardId[];
  lastDeck: CardId[];
}

/** The slice of the Web Storage API we use; lets tests pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type BuyResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'unknown_card' | 'not_for_sale' | 'too_poor'; profile: Profile };

export function defaultProfile(): Profile {
  return {
    coins: CONFIG.startCoins,
    embers: CONFIG.startEmbers,
    collection: [...CONFIG.starterCollection],
    lastDeck: [],
  };
}

function browserStore(): KeyValueStore | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

function nonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function cardList(value: unknown): CardId[] {
  return Array.isArray(value) ? value.filter(isCardId) : [];
}

/** Bane cards (Clatter) are shuffled in by the sim, so they are never collected or deck-built. */
const isCollectable = (id: CardId): boolean => CARD_DEFS[id].type !== 'bane';

/** Keeps the cards of `deck` that `owned` can cover, counting duplicates, in order. */
function multisetSubset(deck: readonly CardId[], owned: readonly CardId[]): CardId[] {
  const left = new Map<CardId, number>();
  for (const id of owned) left.set(id, (left.get(id) ?? 0) + 1);
  return deck.filter((id) => {
    const n = left.get(id) ?? 0;
    if (n <= 0) return false;
    left.set(id, n - 1);
    return true;
  });
}

/** Coerces unknown stored data into a valid Profile, field by field. */
export function sanitizeProfile(raw: unknown): Profile {
  const base = defaultProfile();
  if (typeof raw !== 'object' || raw === null) return base;
  const o = raw as Record<string, unknown>;
  const collection = Array.isArray(o.collection) ? cardList(o.collection).filter(isCollectable) : base.collection;
  const lastDeck = multisetSubset(cardList(o.lastDeck).filter(isCollectable), collection).slice(0, CONFIG.deckCap);
  return {
    coins: nonNegativeInt(o.coins, base.coins),
    embers: nonNegativeInt(o.embers, base.embers),
    collection,
    lastDeck,
  };
}

/** Loads the profile. Missing, unreadable or corrupt data falls back to defaults. */
export function loadProfile(store: KeyValueStore | undefined = browserStore()): Profile {
  let raw: string | null;
  try {
    raw = store ? store.getItem(STORAGE_KEY) : null;
  } catch {
    return defaultProfile();
  }
  if (raw === null) return defaultProfile();
  try {
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return defaultProfile();
  }
}

/** Saves the profile. Returns false if storage refuses the write (quota, private mode). */
export function saveProfile(profile: Profile, store: KeyValueStore | undefined = browserStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Credits a finished run. Pure: returns a new profile. */
export function bankRun(profile: Profile, result: RunResult): Profile {
  return {
    ...profile,
    coins: profile.coins + result.coinsBanked,
    embers: profile.embers + result.embersBanked,
  };
}

/** Buys one card for its shop price. Pure: returns a new profile. */
export function buyCard(profile: Profile, cardId: CardId): BuyResult {
  if (!isCardId(cardId)) return { ok: false, reason: 'unknown_card', profile };
  const price = CARD_DEFS[cardId].price;
  if (price === null) return { ok: false, reason: 'not_for_sale', profile };
  if (profile.coins < price) return { ok: false, reason: 'too_poor', profile };
  return {
    ok: true,
    profile: {
      ...profile,
      coins: profile.coins - price,
      collection: [...profile.collection, cardId],
    },
  };
}
