import type { SecretRound } from '../../shared/multiplayer';
import { buildRound, type Rng } from '../game/rounds';
import type { Env } from './session';

/** Round 1..5 ko difficulty (sajilo bata kathin). */
export const MP_DIFFICULTY = [1, 1, 2, 3, 4] as const;
const KINDS = ['quiz', 'photo', 'rush'] as const;

/** Grid multiplayer ma chhaina (dherai try). Ek-pachhi-arko eutai type aaudaina. */
export function mpRoundBuilder(rng: Rng): (i: number) => SecretRound {
  let lastKind = '';
  const seen = new Set<string>();
  return (i) => {
    const kinds = KINDS.filter((k) => k !== lastKind);
    const kind = kinds[Math.min(kinds.length - 1, Math.floor(rng() * kinds.length))]!;
    let r = buildRound(kind, MP_DIFFICULTY[Math.min(i, MP_DIFFICULTY.length - 1)]!, 'Multiplayer', rng);
    for (let t = 0; t < 5 && seen.has(r.id) && r.kind !== 'rush'; t++) r = buildRound(kind, MP_DIFFICULTY[Math.min(i, MP_DIFFICULTY.length - 1)]!, 'Multiplayer', rng, r.id);
    seen.add(r.id);
    lastKind = kind;
    return r as SecretRound;
  };
}

export const realEnv = (): Env => ({
  rng: Math.random,
  now: Date.now,
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
  buildRound: mpRoundBuilder(Math.random),
});

export function newPlayerId(): string {
  return (crypto.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`).slice(0, 8);
}
