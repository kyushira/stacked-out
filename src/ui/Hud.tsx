import { useEffect, useState } from 'react';
import { CONFIG } from '../config';
import { CARD_DEFS } from '../game/cards';
import type { RunStatus } from '../game/sim';
import { cssVars } from './css';
import type { HudSnapshot } from './controller';
import { MuteButton } from './MuteButton';

const BANNER: Record<Exclude<RunStatus, 'playing'>, string> = {
  escaped: 'Escaped!',
  caught: 'Caught',
  gaveUp: 'Gave up',
};

export function Hud({ hud, onGiveUp }: { hud: HudSnapshot; onGiveUp: () => void }) {
  const ended = hud.status !== 'playing';
  const flashStyle = { animationDuration: `${CONFIG.flashS}s` };
  return (
    <div className="hud">
      <div className="hud-top">
        <NoiseMeter noise={hud.noise} max={hud.noiseMax} noiseBlock={hud.noiseBlock} hazardBlock={hud.hazardBlock} />
        <div className="hud-actions">
          <MuteButton />
          <GiveUpButton disabled={ended} onConfirm={onGiveUp} />
        </div>
      </div>

      <div className="hud-row">
        <DrawStatus nextIn={hud.nextDrawIn} cardsInPile={hud.cardsInPile} />
        <div className="wallet">
          <span className="chip">Coins {hud.runCoins}</span>
          <span className="chip">Embers {hud.runEmbers}</span>
        </div>
        <Compass angle={hud.compassAngle} target={hud.artifactHeld ? 'exit' : 'artifact'} />
      </div>

      {hud.buffs.length > 0 && (
        <ul className="buffs" aria-label="Active effects">
          {hud.buffs.map((b) => (
            <li key={b.kind} className="chip">
              {CARD_DEFS[b.kind].name} {Math.ceil(b.remaining)} s
            </li>
          ))}
        </ul>
      )}

      <Hint hud={hud} />

      {hud.counts.draw > 0 && hud.lastDrawn && (
        <div key={`draw${hud.counts.draw}`} className="toast" role="status" style={{ animationDuration: `${CONFIG.toastS}s` }}>
          Drew {CARD_DEFS[hud.lastDrawn].name}
        </div>
      )}
      {hud.counts.hazard > 0 && <div key={`hz${hud.counts.hazard}`} className="flash flash-hazard" style={flashStyle} />}
      {hud.counts.detected > 0 && <div key={`det${hud.counts.detected}`} className="flash flash-detect" style={flashStyle} />}

      {ended && (
        <div className="banner" role="status">
          {BANNER[hud.status as Exclude<RunStatus, 'playing'>]}
        </div>
      )}
    </div>
  );
}

function NoiseMeter({ noise, max, noiseBlock, hazardBlock }: { noise: number; max: number; noiseBlock: number; hazardBlock: number }) {
  const pct = max > 0 ? (noise / max) * 100 : 0;
  return (
    <div className="noise" role="meter" aria-label="Noise" aria-valuemin={0} aria-valuemax={max} aria-valuenow={noise} aria-valuetext={`${noise} of ${max}`}>
      <div className="noise-head">
        <span>Noise</span>
        <strong>
          {noise}/{max}
        </strong>
      </div>
      <div className="meter-track">
        <div className="meter-fill" data-level={noise >= max ? 'max' : 'normal'} style={cssVars({ '--fill': `${pct}%` })} />
      </div>
      <div className="noise-sub">
        Absorbs {noiseBlock} noise · {hazardBlock} hazard
      </div>
    </div>
  );
}

function DrawStatus({ nextIn, cardsInPile }: { nextIn: number | null; cardsInPile: number }) {
  return (
    <div className="draw-status">
      <span className="draw-main">{nextIn === null ? 'Deck empty' : `Next card in ${Math.ceil(nextIn)} s`}</span>
      <span className="draw-sub">{cardsInPile} left in pile</span>
    </div>
  );
}

function Compass({ angle, target }: { angle: number; target: 'exit' | 'artifact' }) {
  return (
    <div className="compass-wrap">
      <div className="compass" role="img" aria-label={`Compass points to the ${target}`} style={cssVars({ '--angle': `${angle}rad` })}>
        <span className="needle" />
      </div>
      <span className="compass-label">{target}</span>
    </div>
  );
}

function Hint({ hud }: { hud: HudSnapshot }) {
  let text: string | null = null;
  if (hud.guardMode === 'chase') text = 'Chased: get outside its ring and keep moving.';
  else if (hud.onExit && !hud.artifactHeld) text = 'No artifact — no payout';
  else if (hud.artifactHeld && !hud.onExit) text = 'Artifact taken. Back to the entrance.';
  else if (hud.floodedTiles > 0) text = 'Flooded floor slows you down.';
  if (text === null) return null;
  return (
    <p className="hint" role="status">
      {text}
    </p>
  );
}

function GiveUpButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), CONFIG.giveUpArmS * 1000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={armed ? 'btn-danger armed' : 'btn-danger'}
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? 'Tap to confirm' : 'Give up'}
    </button>
  );
}
