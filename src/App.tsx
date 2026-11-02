import { useCallback, useEffect, useRef, useState } from 'react';
import { resumeAudio, suspendAudio, unlockAudio } from './audio';
import type { CardId } from './game/cards';
import { bankRun, buyCard, loadProfile, saveProfile, type Profile } from './game/persist';
import { resultOf, type RunResult, type RunState } from './game/sim';
import { DeckBuilder } from './ui/DeckBuilder';
import { PostRun } from './ui/PostRun';
import { Run } from './ui/Run';
import { summarizeRun, type RunSummary } from './ui/controller';

type Screen =
  | { name: 'camp' }
  | { name: 'run'; deck: CardId[]; seed: number }
  | { name: 'post'; summary: RunSummary; result: RunResult; shopSeed: number };

/** Run seeds come from the browser here, outside the sim, which stays seeded and deterministic. */
const randomSeed = (): number => Math.floor(Math.random() * 0x100000000);

export function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const profileRef = useRef(profile);
  const [screen, setScreen] = useState<Screen>({ name: 'camp' });

  const commit = useCallback((next: Profile) => {
    profileRef.current = next;
    saveProfile(next);
    setProfile(next);
  }, []);

  useEffect(() => {
    // Audio needs a user gesture on mobile; any first press creates or resumes the context.
    const unlock = () => unlockAudio();
    const onVisibility = () => (document.hidden ? suspendAudio() : resumeAudio());
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const onDeckChange = useCallback((deck: CardId[]) => commit({ ...profileRef.current, lastDeck: deck }), [commit]);

  const startRun = useCallback(
    (deck: CardId[]) => {
      commit({ ...profileRef.current, lastDeck: deck });
      setScreen({ name: 'run', deck, seed: randomSeed() });
    },
    [commit],
  );

  const onRunEnd = useCallback(
    (state: RunState) => {
      const result = resultOf(state);
      const summary = summarizeRun(state);
      if (!result || !summary) return;
      commit(bankRun(profileRef.current, result));
      setScreen({ name: 'post', summary, result, shopSeed: state.seed ^ 0x9e3779b9 });
    },
    [commit],
  );

  const onBuy = useCallback(
    (id: CardId) => {
      const r = buyCard(profileRef.current, id);
      if (!r.ok) return false;
      commit(r.profile);
      return true;
    },
    [commit],
  );

  if (screen.name === 'run') {
    return <Run key={screen.seed} deck={screen.deck} seed={screen.seed} onEnd={onRunEnd} />;
  }
  if (screen.name === 'post') {
    return (
      <PostRun
        summary={screen.summary}
        result={screen.result}
        profile={profile}
        shopSeed={screen.shopSeed}
        onBuy={onBuy}
        onBack={() => setScreen({ name: 'camp' })}
      />
    );
  }
  return <DeckBuilder profile={profile} onDeckChange={onDeckChange} onStart={startRun} />;
}
