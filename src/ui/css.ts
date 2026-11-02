import type { CSSProperties } from 'react';

/** Sets CSS custom properties from values only known at runtime (meter fills, angles, positions). */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}
