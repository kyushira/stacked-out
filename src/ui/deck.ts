import { CONFIG } from '../config';
import { CARD_DEFS, type CardId } from '../game/cards';

/** Cards a player can put in a deck. Bane cards are shuffled in by the sim, never chosen. */
export const BUILDABLE_CARDS: readonly CardId[] = (Object.keys(CARD_DEFS) as CardId[]).filter(
  (id) => CARD_DEFS[id].type !== 'bane',
);

export function copiesOwned(collection: readonly CardId[], id: CardId): number {
  return collection.filter((c) => c === id).length;
}

export function copiesInDeck(deck: readonly CardId[], id: CardId): number {
  return deck.filter((c) => c === id).length;
}

/**
 * Makes a stored deck legal against the current collection: drops cards no longer
 * owned (respecting duplicate counts), drops bane cards, and trims to the cap.
 * Order is preserved.
 */
export function sanitizeDeck(
  deck: readonly CardId[],
  collection: readonly CardId[],
  cap: number = CONFIG.deckCap,
): CardId[] {
  const remaining = new Map<CardId, number>();
  for (const id of BUILDABLE_CARDS) remaining.set(id, copiesOwned(collection, id));
  const out: CardId[] = [];
  for (const id of deck) {
    if (out.length >= cap) break;
    const left = remaining.get(id) ?? 0;
    if (left <= 0) continue;
    remaining.set(id, left - 1);
    out.push(id);
  }
  return out;
}

export function canAddToDeck(
  deck: readonly CardId[],
  collection: readonly CardId[],
  id: CardId,
  cap: number = CONFIG.deckCap,
): boolean {
  return deck.length < cap && copiesInDeck(deck, id) < copiesOwned(collection, id);
}

export function addToDeck(deck: readonly CardId[], id: CardId): CardId[] {
  return [...deck, id];
}

/** Removes the copy at `index`. Out-of-range indices return an unchanged copy. */
export function removeFromDeck(deck: readonly CardId[], index: number): CardId[] {
  return deck.filter((_, i) => i !== index);
}
