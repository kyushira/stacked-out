import { useMemo, useState } from 'react';
import { CARD_DEFS, type CardId } from '../game/cards';
import { rollShop } from '../game/cards';
import type { Profile } from '../game/persist';
import { createRng } from '../game/rng';
import type { RunResult } from '../game/sim';
import type { RunSummary } from './controller';
import { TYPE_LABEL } from './cardInfo';
import { MuteButton } from './MuteButton';

export interface PostRunProps {
  summary: RunSummary;
  result: RunResult;
  /** Profile after this run's banking; the shop spends from it. */
  profile: Profile;
  shopSeed: number;
  /** Buys one card. Returns false if the purchase did not go through. */
  onBuy: (id: CardId) => boolean;
  onBack: () => void;
}

const HEADLINE: Record<RunSummary['status'], string> = {
  escaped: 'Escaped with the artifact',
  caught: 'Caught',
  gaveUp: 'Gave up',
};

export function PostRun({ summary, result, profile, shopSeed, onBuy, onBack }: PostRunProps) {
  const offers = useMemo(() => rollShop(createRng(shopSeed)), [shopSeed]);
  const [bought, setBought] = useState<CardId | null>(null);
  const escaped = summary.status === 'escaped';

  const artifactTotal = summary.artifactHeld ? summary.artifactValue : 0;
  const rows = [
    { label: 'Run coins', total: summary.runCoins, banked: escaped ? summary.runCoins : 0 },
    { label: 'Artifact', total: artifactTotal, banked: escaped ? artifactTotal : 0 },
    { label: 'Embers', total: summary.runEmbers, banked: result.embersBanked },
  ];

  return (
    <main className="screen">
      <header className="top">
        <div>
          <h1>{HEADLINE[summary.status]}</h1>
          <p className="muted">{escaped ? 'The artifact is yours.' : 'Here is what you keep.'}</p>
        </div>
        <MuteButton />
      </header>

      <section aria-labelledby="breakdown-title" className="section">
        <h2 id="breakdown-title">Breakdown</h2>
        <table className="breakdown">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Banked</th>
              <th scope="col">Lost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{r.banked}</td>
                <td>{r.total - r.banked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!summary.artifactHeld && <p className="muted">The artifact was never taken, so no artifact value.</p>}
        <p className="totals">
          Total now: <strong>{profile.coins}</strong> coins · <strong>{profile.embers}</strong> embers
        </p>
      </section>

      <section aria-labelledby="shop-title" className="section">
        <h2 id="shop-title">Shop</h2>
        <p className="muted">One purchase per run. Bought cards join your collection.</p>
        <ul className="offer-list">
          {offers.map((id) => {
            const def = CARD_DEFS[id];
            const price = def.price ?? 0;
            const afford = profile.coins >= price;
            const isBought = bought === id;
            return (
              <li key={id} className="offer">
                <div className="offer-body">
                  <span className="card-type">{TYPE_LABEL[def.type]}</span>
                  <span className="card-name">{def.name}</span>
                  <span className="card-text">{def.text}</span>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={bought !== null || !afford}
                  onClick={() => {
                    if (onBuy(id)) setBought(id);
                  }}
                >
                  {isBought ? 'Bought' : `Buy · ${price}`}
                </button>
                {!afford && bought === null && <span className="muted small">Need {price - profile.coins} more coins</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="bottom-bar">
        <button type="button" className="btn-primary btn-big" onClick={onBack}>
          Back to camp
        </button>
      </footer>
    </main>
  );
}
