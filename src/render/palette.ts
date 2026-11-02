/**
 * Scene colours. Pure presentation (not gameplay tunables), kept in one place so the
 * look can be changed without touching render logic.
 */
export const PALETTE = {
  background: '#0b0c10',
  wall: '#262a33',
  floor: '#171a21',
  floorFlood: '#1c212b',
  creak: '#3b3424',
  flooded: '#2b5fae',
  start: '#1b3a32',
  exit: '#5cc38a',
  player: '#ece9e0',
  playerCarry: '#f2c94c',
  guardPatrol: '#8891a6',
  guardChase: '#e0524c',
  detectPatrol: '#8891a6',
  detectChase: '#e0524c',
  artifact: '#f2c94c',
} as const;
