import { useState } from 'react';
import { CONFIG } from '../config';
import { CARD_DEFS, type CardId } from '../game/cards';
import type { Profile } from '../game/persist';
import { addToDeck, BUILDABLE_CARDS, canAddToDeck, copiesInDeck, copiesOwned, removeFromDeck, sanitizeDeck } from './deck';
import { TYPE_LABEL } from './cardInfo';
import { MuteButton } from './MuteButton';

export interface DeckBuilderProps {
  profile: Profile;
  /** Fired on every edit so the last deck survives a reload. */
  onDeckChange: (deck: CardId[]) => void;
  onStart: (deck: CardId[]) => void;
}

export function DeckBuilder({ profile, onDeckChange, onStart }: DeckBuilderProps) {
  const [deck, setDeck] = useState<CardId[]>(() => sanitizeDeck(profile.lastDeck, profile.collection));
  const update = (next: CardId[]) => {
    setDeck(next);
    onDeckChange(next);
  };

  return (
    <main className="screen">
      <header className="top">
        <div>
          <h1>Stacked Out</h1>
          <p className="muted">Build a deck of up to {CONFIG.deckCap} cards, then go in.</p>
        </div>
        <MuteButton />
      </header>

      <div className="wallet" aria-label="Wallet">
        <span className="chip">Coins {profile.coins}</span>
        <span className="chip">Embers {profile.embers}</span>
      </div>

      <section aria-labelledby="deck-title" className="section">
        <h2 id="deck-title">
          Deck {deck.length}/{CONFIG.deckCap}
        </h2>
        <ol className="deck-slots">
          {Array.from({ length: CONFIG.deckCap }, (_, i) => {
            const id = deck[i];
            if (id === undefined) {
              return (
                <li key={`empty${i}`} className="slot slot-empty">
                  Empty
                </li>
              );
            }
            return (
              <li key={`slot${i}`}>
                <button type="button" className="slot" onClick={() => update(removeFromDeck(deck, i))}>
                  <span>{CARD_DEFS[id].name}</span>
                  <small>Tap to remove</small>
                </button>
              </li>
            );
          })}
        </ol>
        {deck.length === 0 && <p className="muted">An empty deck means no cards get drawn this run.</p>}
      </section>

      <section aria-labelledby="collection-title" className="section">
        <h2 id="collection-title">Collection</h2>
        <ul className="card-grid">
          {BUILDABLE_CARDS.map((id) => {
            const def = CARD_DEFS[id];
            const owned = copiesOwned(profile.collection, id);
            const inDeck = copiesInDeck(deck, id);
            const addable = canAddToDeck(deck, profile.collection, id);
            return (
              <li key={id}>
                <button type="button" className="card" disabled={!addable} onClick={() => update(addToDeck(deck, id))}>
                  <span className="card-type">{TYPE_LABEL[def.type]}</span>
                  <span className="card-name">{def.name}</span>
                  <span className="card-text">{def.text}</span>
                  <span className="card-meta">{owned === 0 ? 'Not owned' : `Owned ×${owned} · In deck ${inDeck}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="bottom-bar">
        <button type="button" className="btn-primary btn-big" onClick={() => onStart(deck)}>
          Enter the dungeon
        </button>
      </footer>
    </main>
  );
}
