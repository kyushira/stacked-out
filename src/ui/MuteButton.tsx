import { useState } from 'react';
import { isMuted, setMuted } from '../audio';

export function MuteButton() {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      type="button"
      className="btn-chip"
      aria-pressed={muted}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  );
}
