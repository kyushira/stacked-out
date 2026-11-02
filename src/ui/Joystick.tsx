import { useRef, useState, type PointerEvent } from 'react';
import { CONFIG } from '../config';
import { stickVector, ZERO, type Vec } from './input';

interface View {
  ox: number;
  oy: number;
  kx: number;
  ky: number;
}

/**
 * Floating virtual stick. The thumb's touch point becomes the stick centre, so it works
 * wherever the thumb lands in the lower zone. Mouse works too (primary button only).
 * Output goes to onMove every pointer move; it is not React state, so the sim reads it per frame.
 */
export function Joystick({ onMove }: { onMove: (v: Vec) => void }) {
  const grab = useRef<{ id: number; x: number; y: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const radius = CONFIG.joystickRadiusPx;

  const release = (e: PointerEvent<HTMLDivElement>) => {
    if (!grab.current || grab.current.id !== e.pointerId) return;
    grab.current = null;
    setView(null);
    onMove(ZERO);
  };

  return (
    <div
      className="stick-zone"
      aria-hidden="true"
      onPointerDown={(e) => {
        if (grab.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        grab.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        setView({ ox: e.clientX, oy: e.clientY, kx: 0, ky: 0 });
        onMove(ZERO);
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g || g.id !== e.pointerId) return;
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        onMove(stickVector(dx, dy));
        const mag = Math.hypot(dx, dy);
        const k = mag > radius ? radius / mag : 1;
        setView({ ox: g.x, oy: g.y, kx: dx * k, ky: dy * k });
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {view && (
        <>
          <div className="stick-base" style={{ left: view.ox, top: view.oy, width: radius * 2, height: radius * 2 }} />
          <div className="stick-knob" style={{ left: view.ox + view.kx, top: view.oy + view.ky }} />
        </>
      )}
    </div>
  );
}
