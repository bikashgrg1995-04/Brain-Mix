import { DIFFICULTY, type Difficulty } from './types';

/** Coin ra power-up ko niyam. Phase 2 ma server ma pani yehi (coin server-side ma). */
export const START_COINS = 30;
export const TIME_BONUS_SEC = 15;
export const TIME_COST = 10;

/** Hint / 50:50 ko daam difficulty anusar (types.ts ko hintCost). */
export const hintCost = (d: Difficulty): number => DIFFICULTY[d].hintCost;

/** Level pahilo patak jitda coin: har star 10. Replay ma 0 (XP jastai). */
export function roundCoins(stars: 0 | 1 | 2 | 3, firstClear: boolean): number {
  return firstClear ? stars * 10 : 0;
}

/**
 * Akshar hint: jawaf ko sabai bhanda baayaa ko thau jaha sahi akshar (green) abhai pakadiyeko chhaina.
 * `greens` = ahile samma green bhaeko thau. Sabai bhetisakeko bhaye null.
 */
export function revealPosition(answer: string, greens: ReadonlySet<number>, shown: ReadonlySet<number> = new Set()): number | null {
  for (let i = 0; i < answer.length; i++) if (!greens.has(i) && !shown.has(i)) return i;
  return null;
}

/** 50:50: 2 ota galat option hataucha (random). Sahi option kahile hatdaina. */
export function fiftyFifty(optionCount: number, correct: number, rng: () => number = Math.random): number[] {
  const wrong = Array.from({ length: optionCount }, (_, i) => i).filter((i) => i !== correct);
  const out: number[] = [];
  while (out.length < 2 && wrong.length) out.push(wrong.splice(Math.min(wrong.length - 1, Math.floor(rng() * wrong.length)), 1)[0]!);
  return out.sort((a, b) => a - b);
}
