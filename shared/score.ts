import { evaluate } from './evaluate';
import { DIFFICULTY, type Difficulty } from './types';

/** Round (MCQ / photo / rush) ko score niyam. Phase 2 ma server ma pani yehi chalaune. */

export const RUSH_WORDS = 5;
export const WORD_MAX_POINTS = 100;
export const RUSH_PASS = 0.5; // jamma score ko aadha bhanda mathi bhaye level pass

/**
 * Placement score (0-1): sahi thau ma sahi akshar = 1, galat thau ma (tara shabda ma chha) = 0.5, natra 0.
 * Length milena bhane 0 (caller le pahile length check garne).
 */
export function placementFraction(guess: string, answer: string): number {
  if (guess.length !== answer.length) return 0;
  const sum = evaluate(guess, answer).reduce((s, t) => s + (t === 'green' ? 1 : t === 'yellow' ? 0.5 : 0), 0);
  return sum / answer.length;
}

/** Ek shabda ko point (0-100). Pura sahi = 100, nabhaye placement anusar, pura sahi nabhaeko ma 99 bhanda mathi jadaina. */
export function wordPoints(guess: string, answer: string): number {
  if (guess === answer) return WORD_MAX_POINTS;
  return Math.min(WORD_MAX_POINTS - 1, Math.round(placementFraction(guess, answer) * WORD_MAX_POINTS));
}

export const rushFraction = (points: number[]): number =>
  points.reduce((s, p) => s + p, 0) / (RUSH_WORDS * WORD_MAX_POINTS);

export const rushPassed = (points: number[]): boolean => rushFraction(points) >= RUSH_PASS;

export function rushStars(points: number[]): 0 | 1 | 2 | 3 {
  const f = rushFraction(points);
  return f >= 0.9 ? 3 : f >= 0.7 ? 2 : f >= RUSH_PASS ? 1 : 0;
}

/** Quiz: sahi bhaye matra pass. Chhito jawaf = dherai star (samay ko > 2/3 = 3, > 1/3 = 2, natra 1). */
export function timedStars(correct: boolean, secondsLeft: number, timer: number): 0 | 1 | 2 | 3 {
  if (!correct) return 0;
  const f = secondsLeft / timer;
  return f > 2 / 3 ? 3 : f > 1 / 3 ? 2 : 1;
}

/** Photo: kati try ma milyo (1-3), samay ko sath. 0 try = fail. */
export function photoStars(tries: number, secondsLeft: number, timer: number): 0 | 1 | 2 | 3 {
  if (tries < 1 || secondsLeft <= 0) return 0;
  if (tries === 1) return timedStars(true, secondsLeft, timer);
  return tries === 2 ? 2 : 1;
}

export const STAR_XP = { 1: 30, 2: 50, 3: 70 } as const;

/** Level pahilo patak jitda matra XP (replay ma 0), difficulty multiplier sahit. */
export function roundXp(stars: 0 | 1 | 2 | 3, difficulty: Difficulty, firstClear: boolean): number {
  if (stars === 0 || !firstClear) return 0;
  return Math.round(STAR_XP[stars] * DIFFICULTY[difficulty].xpMult);
}
