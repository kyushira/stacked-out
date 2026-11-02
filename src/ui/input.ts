import { CONFIG } from '../config';

export interface Vec {
  x: number;
  y: number;
}

export const ZERO: Vec = { x: 0, y: 0 };

/**
 * Maps a thumb offset from the joystick origin (css px) to a move vector in -1..1.
 * Radial deadzone: anything inside the deadzone is zero; beyond it the magnitude
 * is rescaled so motion starts smoothly at the deadzone edge.
 */
export function stickVector(
  dx: number,
  dy: number,
  radiusPx: number = CONFIG.joystickRadiusPx,
  deadzone: number = CONFIG.joystickDeadzone,
): Vec {
  const mag = Math.hypot(dx, dy);
  if (radiusPx <= 0 || mag === 0) return ZERO;
  const norm = Math.min(mag, radiusPx) / radiusPx;
  if (norm <= deadzone) return ZERO;
  const scaled = (norm - deadzone) / (1 - deadzone);
  return { x: (dx / mag) * scaled, y: (dy / mag) * scaled };
}

/** Keyboard bindings by KeyboardEvent.code, so they work on any layout. Up is -y (sim y grows downward). */
const KEY_VECTORS: Readonly<Record<string, Vec>> = {
  KeyW: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  KeyS: { x: 0, y: 1 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowRight: { x: 1, y: 0 },
};

export function isMoveKey(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(KEY_VECTORS, code);
}

/** Sums the held movement keys into one vector, each axis clamped to -1..1. */
export function keyVector(held: ReadonlySet<string>): Vec {
  let x = 0;
  let y = 0;
  for (const code of held) {
    if (!isMoveKey(code)) continue;
    x += KEY_VECTORS[code].x;
    y += KEY_VECTORS[code].y;
  }
  return { x: clampUnit(x), y: clampUnit(y) };
}

/** Adds two input sources (keyboard + joystick), clamping each axis. */
export function combine(a: Vec, b: Vec): Vec {
  return { x: clampUnit(a.x + b.x), y: clampUnit(a.y + b.y) };
}

function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
