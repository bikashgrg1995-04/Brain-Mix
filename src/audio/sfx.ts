/**
 * Chhoto sound effects (Web Audio, file chhaina). Awaj band (mute) bhaye kehi bajdaina.
 * Mute ambience.ts sanga eutai localStorage key: `shabda.muted`.
 */
export type Sfx = 'tap' | 'ok' | 'bad' | 'win' | 'lose' | 'coin' | 'tick';
interface Note { f: number; at: number; d: number; type?: OscillatorType; v?: number }

export const SEQUENCES: Record<Sfx, Note[]> = {
  tap: [{ f: 520, at: 0, d: 0.05, v: 0.05 }],
  ok: [{ f: 660, at: 0, d: 0.09 }, { f: 880, at: 0.09, d: 0.14 }],
  bad: [{ f: 220, at: 0, d: 0.16, type: 'square', v: 0.05 }, { f: 165, at: 0.1, d: 0.2, type: 'square', v: 0.05 }],
  win: [523, 659, 784, 1047].map((f, i) => ({ f, at: i * 0.1, d: i === 3 ? 0.45 : 0.14 })),
  lose: [{ f: 392, at: 0, d: 0.18, type: 'triangle' }, { f: 330, at: 0.16, d: 0.18, type: 'triangle' }, { f: 262, at: 0.32, d: 0.4, type: 'triangle' }],
  coin: [{ f: 988, at: 0, d: 0.07 }, { f: 1319, at: 0.07, d: 0.2 }],
  tick: [{ f: 900, at: 0, d: 0.04, v: 0.06 }],
};

const KEY = 'shabda.muted';
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

export const setSfxMuted = (m: boolean): void => { muted = m; };

export function play(name: Sfx): void {
  if (muted) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of SEQUENCES[name]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = n.type ?? 'sine';
      o.frequency.value = n.f;
      const s = t0 + n.at;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(n.v ?? 0.09, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + n.d);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + n.d + 0.03);
    }
  } catch { /* awaj nabajda ni khel chalchha */ }
}
