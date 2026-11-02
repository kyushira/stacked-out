import { describe, it, expect } from 'vitest';
import {
  STORAGE_KEY,
  bankRun,
  buyCard,
  defaultProfile,
  loadProfile,
  sanitizeProfile,
  saveProfile,
  type KeyValueStore,
  type Profile,
} from './persist';
import { CONFIG } from '../config';

class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  constructor(initial?: string) {
    if (initial !== undefined) this.data.set(STORAGE_KEY, initial);
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const rich = (coins: number): Profile => ({ coins, embers: 0, collection: [], lastDeck: [] });

describe('profile defaults', () => {
  it('starts with zero coins and embers and the starter collection', () => {
    const p = loadProfile(new MemoryStore());
    expect(p.coins).toBe(CONFIG.startCoins);
    expect(p.embers).toBe(CONFIG.startEmbers);
    expect([...p.collection].sort()).toEqual([...CONFIG.starterCollection].sort());
    expect(p.lastDeck).toEqual([]);
  });

  it('falls back to defaults when there is no storage at all', () => {
    expect(loadProfile(undefined)).toEqual(defaultProfile());
  });

  it('falls back to defaults on corrupt JSON', () => {
    expect(loadProfile(new MemoryStore('{not json'))).toEqual(defaultProfile());
  });

  it('falls back to defaults when the stored value is not an object', () => {
    expect(loadProfile(new MemoryStore('42'))).toEqual(defaultProfile());
  });

  it('sanitises bad fields individually and drops unknown card ids', () => {
    const raw = JSON.stringify({
      coins: -5,
      embers: 'x',
      collection: ['muffle', 'bogus'],
      lastDeck: 'nope',
    });
    const p = loadProfile(new MemoryStore(raw));
    expect(p.coins).toBe(CONFIG.startCoins);
    expect(p.embers).toBe(CONFIG.startEmbers);
    expect(p.collection).toEqual(['muffle']);
    expect(p.lastDeck).toEqual([]);
  });

  it('round-trips a saved profile', () => {
    const store = new MemoryStore();
    const p: Profile = { coins: 17, embers: 4, collection: ['muffle', 'still_air'], lastDeck: ['muffle'] };
    expect(saveProfile(p, store)).toBe(true);
    expect(loadProfile(store)).toEqual(p);
  });
});

describe('sanitising stored decks', () => {
  it('never keeps Clatter in the collection or the last deck', () => {
    const raw = JSON.stringify({ collection: ['muffle', 'clatter'], lastDeck: ['clatter', 'muffle'] });
    const p = sanitizeProfile(JSON.parse(raw));
    expect(p.collection).toEqual(['muffle']);
    expect(p.lastDeck).toEqual(['muffle']);
  });

  it('keeps lastDeck a multiset subset of the collection', () => {
    const raw = JSON.stringify({ collection: ['muffle', 'ward_stone'], lastDeck: ['muffle', 'muffle', 'ward_stone'] });
    const p = sanitizeProfile(JSON.parse(raw));
    expect(p.lastDeck).toEqual(['muffle', 'ward_stone']);
  });

  it('drops lastDeck cards that are not owned', () => {
    const raw = JSON.stringify({ collection: ['muffle'], lastDeck: ['still_air', 'muffle'] });
    expect(sanitizeProfile(JSON.parse(raw)).lastDeck).toEqual(['muffle']);
  });

  it('trims lastDeck to deckCap, keeping order', () => {
    const many = Array(CONFIG.deckCap + 3).fill('muffle');
    const raw = JSON.stringify({ collection: many, lastDeck: many });
    expect(sanitizeProfile(JSON.parse(raw)).lastDeck).toEqual(Array(CONFIG.deckCap).fill('muffle'));
  });
});

describe('bankRun', () => {
  it('adds coinsBanked and embersBanked to the profile', () => {
    const p: Profile = { coins: 10, embers: 1, collection: [], lastDeck: [] };
    const after = bankRun(p, { status: 'escaped', coinsBanked: 25, embersBanked: 3, artifactValue: 20 });
    expect(after.coins).toBe(35);
    expect(after.embers).toBe(4);
  });

  it('does not mutate the input profile', () => {
    const p = rich(5);
    bankRun(p, { status: 'gaveUp', coinsBanked: 0, embersBanked: 2, artifactValue: 0 });
    expect(p.coins).toBe(5);
  });
});

describe('buyCard', () => {
  it('deducts the price and adds the card to the collection', () => {
    const p: Profile = { coins: 20, embers: 0, collection: ['muffle'], lastDeck: [] };
    const res = buyCard(p, 'muffle');
    expect(res.ok).toBe(true);
    expect(res.profile.coins).toBe(14);
    expect(res.profile.collection).toEqual(['muffle', 'muffle']);
  });

  it('refuses when the player cannot afford it and leaves the profile unchanged', () => {
    const p: Profile = { coins: 5, embers: 0, collection: [], lastDeck: [] };
    const res = buyCard(p, 'muffle');
    expect(res.ok).toBe(false);
    expect(res.profile).toEqual(p);
  });

  it('refuses cards that are not for sale', () => {
    const res = buyCard(rich(100), 'clatter');
    expect(res.ok).toBe(false);
  });
});
