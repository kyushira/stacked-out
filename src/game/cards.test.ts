import { describe, it, expect } from 'vitest';
import { CARD_DEFS, SHOP_CARDS, rollShop } from './cards';
import { createRng } from './rng';
import { CONFIG } from '../config';

describe('card definitions', () => {
  it('matches the spec shop prices', () => {
    const prices = Object.fromEntries(SHOP_CARDS.map((id) => [id, CARD_DEFS[id].price]));
    expect(prices).toEqual({
      muffle: 6,
      deep_hush: 14,
      ward_stone: 8,
      pocket_find: 8,
      ember_pouch: 10,
      quickstep: 10,
      greedy_grab: 12,
      still_air: 12,
    });
  });

  it('bane Clatter is never for sale', () => {
    expect(CARD_DEFS.clatter.price).toBeNull();
    expect(SHOP_CARDS).not.toContain('clatter');
  });
});

describe('rollShop', () => {
  it('offers shopOffers distinct shop cards', () => {
    const offers = rollShop(createRng(3));
    expect(offers).toHaveLength(CONFIG.shopOffers);
    expect(new Set(offers).size).toBe(offers.length);
    for (const id of offers) expect(SHOP_CARDS).toContain(id);
  });

  it('is deterministic for a given seed', () => {
    expect(rollShop(createRng(11))).toEqual(rollShop(createRng(11)));
  });
});
