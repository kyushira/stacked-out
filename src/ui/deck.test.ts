import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { CardId } from '../game/cards';
import { addToDeck, BUILDABLE_CARDS, canAddToDeck, copiesInDeck, removeFromDeck, sanitizeDeck } from './deck';

const starter: CardId[] = [...CONFIG.starterCollection];

describe('deck helpers', () => {
  it('never offers the bane card', () => {
    expect(BUILDABLE_CARDS).not.toContain('clatter');
    expect(BUILDABLE_CARDS).toHaveLength(8);
  });

  it('allows duplicates only up to the number owned', () => {
    let deck: CardId[] = [];
    expect(canAddToDeck(deck, starter, 'muffle')).toBe(true);
    deck = addToDeck(deck, 'muffle');
    expect(canAddToDeck(deck, starter, 'muffle')).toBe(true);
    deck = addToDeck(deck, 'muffle');
    expect(copiesInDeck(deck, 'muffle')).toBe(2);
    expect(canAddToDeck(deck, starter, 'muffle')).toBe(false);
  });

  it('refuses unowned cards and anything past the deck cap', () => {
    expect(canAddToDeck([], starter, 'still_air')).toBe(false);
    const full = Array.from({ length: CONFIG.deckCap }, () => 'pocket_find' as CardId);
    expect(canAddToDeck(full, ['pocket_find', ...starter], 'pocket_find')).toBe(false);
  });

  it('removes one copy at an index', () => {
    expect(removeFromDeck(['muffle', 'muffle', 'quickstep'], 1)).toEqual(['muffle', 'quickstep']);
  });

  it('sanitizes a stored deck against the collection and cap', () => {
    const stored: CardId[] = ['muffle', 'muffle', 'muffle', 'still_air', 'clatter' as CardId, 'quickstep'];
    expect(sanitizeDeck(stored, starter)).toEqual(['muffle', 'muffle', 'quickstep']);

    const big: CardId[] = Array.from({ length: 10 }, () => 'pocket_find');
    const collection: CardId[] = Array.from({ length: 10 }, () => 'pocket_find');
    expect(sanitizeDeck(big, collection)).toHaveLength(CONFIG.deckCap);
  });
});
