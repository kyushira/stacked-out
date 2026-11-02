import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';
import { startHeartbeat, stopHeartbeat } from '../audio';
import type { CardId } from '../game/cards';
import { createRun, type RunState } from '../game/sim';
import { RunScene } from '../render/Scene';
import { Hud } from './Hud';
import { isMoveKey, ZERO, type Vec } from './input';
import { Joystick } from './Joystick';
import { createController, endRun, snapshotOf, type HudSnapshot, type RunController } from './controller';

export interface RunProps {
  deck: CardId[];
  seed: number;
  /** Called once, a short moment after the run ends, with the final state. */
  onEnd: (state: RunState) => void;
}

/**
 * One dungeon run. The sim lives in a ref-held controller that the R3F scene advances per
 * frame; React only sees a HUD snapshot at CONFIG.hudRefreshS. Unmounting ends the listeners
 * and the heartbeat; it does not end the run.
 */
export function Run({ deck, seed, onEnd }: RunProps) {
  const ctrlRef = useRef<RunController | null>(null);
  if (ctrlRef.current === null) ctrlRef.current = createController(createRun(deck, seed));
  const ctrl = ctrlRef.current;

  const [hud, setHud] = useState<HudSnapshot>(() => snapshotOf(ctrl));
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const endSeenAt = useRef<number | null>(null);
  const delivered = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isMoveKey(e.code)) return;
      e.preventDefault();
      ctrl.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      ctrl.keys.delete(e.code);
    };
    const releaseAll = () => {
      ctrl.keys.clear();
      ctrl.stick = ZERO;
    };
    const onVisibility = () => {
      ctrl.paused = document.hidden;
      if (document.hidden) releaseAll();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    startHeartbeat();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
      stopHeartbeat();
    };
  }, [ctrl]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHud(snapshotOf(ctrl));
      if (ctrl.state.status === 'playing' || delivered.current) return;
      const now = performance.now();
      if (endSeenAt.current === null) endSeenAt.current = now;
      else if (now - endSeenAt.current >= CONFIG.runEndDelayS * 1000) {
        delivered.current = true;
        onEndRef.current(ctrl.state);
      }
    }, CONFIG.hudRefreshS * 1000);
    return () => window.clearInterval(id);
  }, [ctrl]);

  const onMove = useCallback(
    (v: Vec) => {
      ctrl.stick = v;
    },
    [ctrl],
  );

  const onGiveUp = useCallback(() => {
    if (ctrl.state.status !== 'playing') return;
    endRun(ctrl);
    setHud(snapshotOf(ctrl));
  }, [ctrl]);

  return (
    <div className="run">
      <RunScene ctrl={ctrl} />
      <Joystick onMove={onMove} />
      <Hud hud={hud} onGiveUp={onGiveUp} />
    </div>
  );
}
