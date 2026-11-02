import { CONFIG } from './config';
import type { GameEvent } from './game/sim';

/**
 * WebAudio sound, synthesised at runtime (oscillators and noise buffers only, no asset files).
 * The AudioContext is created or resumed from a user gesture (see unlockAudio) to satisfy
 * mobile autoplay rules. Every function is a safe no-op before unlock or without WebAudio.
 */

const MUTE_KEY = 'stacked-out:mute';
const HEARTBEAT_TICK_MS = 50;
const HEARTBEAT_LEAD_S = 0.3;

export interface Note {
  /** Start frequency, Hz. Ignored for noise notes. */
  freq: number;
  /** End frequency for a sweep; defaults to freq. */
  freqEnd?: number;
  /** Start offset from the play time, s. */
  atS: number;
  durS: number;
  type: OscillatorType;
  /** Peak gain, before master volume. */
  vol: number;
  /** Plays a filtered noise burst instead of an oscillator. */
  noise?: boolean;
  cutoffHz?: number;
}

function arpeggio(freqs: readonly number[], gapS: number, type: OscillatorType, vol: number): Note[] {
  return freqs.map((freq, i) => ({ freq, atS: i * gapS, durS: gapS * 1.6, type, vol }));
}

/** The notes played for a sim event. Events without a sound return an empty plan. */
export function soundPlanFor(ev: GameEvent): Note[] {
  switch (ev.type) {
    case 'cardDrawn':
      return [{ freq: 660, freqEnd: 880, atS: 0, durS: 0.09, type: 'triangle', vol: 0.18 }];
    case 'lootFound':
      return [
        { freq: 880, freqEnd: 1000, atS: 0, durS: 0.07, type: 'sine', vol: 0.16 },
        { freq: 1320, atS: 0.07, durS: 0.09, type: 'sine', vol: 0.14 },
      ];
    case 'hazard':
      return [
        { freq: 0, atS: 0, durS: 0.35, type: 'sine', vol: 0.5, noise: true, cutoffHz: 500 },
        { freq: 240, freqEnd: 90, atS: 0, durS: 0.3, type: 'sawtooth', vol: 0.08 },
      ];
    case 'baneAdded':
      return [{ freq: 180, freqEnd: 140, atS: 0, durS: 0.2, type: 'square', vol: 0.07 }];
    case 'artifactTaken':
      return arpeggio([523, 659, 784], 0.07, 'triangle', 0.18);
    case 'caught':
      return [{ freq: 440, freqEnd: 110, atS: 0, durS: 0.7, type: 'sawtooth', vol: 0.12 }];
    case 'escaped':
      return arpeggio([523, 659, 784, 1047], 0.1, 'triangle', 0.2);
    default:
      return [];
  }
}

/** Heartbeat interval for a noise level: lerps slow→fast as noise approaches max. */
export function heartbeatIntervalS(noise: number, noiseMax: number = CONFIG.noiseMax): number {
  const t = noiseMax > 0 ? Math.min(1, Math.max(0, noise / noiseMax)) : 0;
  return CONFIG.heartbeatSlowS + (CONFIG.heartbeatFastS - CONFIG.heartbeatSlowS) * t;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = readMuted();
let heartTimer: number | null = null;
let heartNoise = 0;
let nextBeatAt = 0;

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Creates the AudioContext on first call and resumes it. Call from a user gesture. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : CONFIG.sfxVolume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // Storage refused the write (private mode); the mute still applies for this session.
  }
  if (master) master.gain.value = next ? 0 : CONFIG.sfxVolume;
}

/** Suspends output while the page is hidden; pairs with resumeAudio. */
export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend();
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/** Plays the sound plan for each sim event, in order. */
export function playEvents(events: readonly GameEvent[]): void {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  for (const ev of events) {
    for (const note of soundPlanFor(ev)) playNote(note, t0 + note.atS);
  }
}

/** Sets the noise level the heartbeat tempo follows. */
export function setHeartbeatNoise(noise: number): void {
  heartNoise = noise;
}

/** Starts the heartbeat scheduler (run start). Idempotent. */
export function startHeartbeat(): void {
  if (heartTimer !== null || typeof window === 'undefined') return;
  nextBeatAt = -1;
  heartTimer = window.setInterval(scheduleHeartbeat, HEARTBEAT_TICK_MS);
}

export function stopHeartbeat(): void {
  if (heartTimer !== null) window.clearInterval(heartTimer);
  heartTimer = null;
}

function scheduleHeartbeat(): void {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (nextBeatAt < 0) nextBeatAt = now + HEARTBEAT_LEAD_S;
  if (now < nextBeatAt) return;
  thump(nextBeatAt, CONFIG.heartbeatVolume);
  thump(nextBeatAt + CONFIG.heartbeatDubGapS, CONFIG.heartbeatVolume * 0.7);
  nextBeatAt = Math.max(nextBeatAt, now) + heartbeatIntervalS(heartNoise);
}

function thump(when: number, vol: number): void {
  playNote({ freq: 70, freqEnd: 45, atS: 0, durS: 0.14, type: 'sine', vol }, when);
}

function playNote(note: Note, when: number): void {
  if (!ctx || !master) return;
  const end = when + note.durS;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(note.vol, when + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(master);

  if (note.noise) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = note.cutoffHz ?? 1000;
    src.connect(filter).connect(gain);
    src.start(when, 0, note.durS + 0.02);
    src.stop(end + 0.02);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = note.type;
  osc.frequency.setValueAtTime(note.freq, when);
  if (note.freqEnd !== undefined && note.freqEnd !== note.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.freqEnd), end);
  }
  osc.connect(gain);
  osc.start(when);
  osc.stop(end + 0.02);
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}
