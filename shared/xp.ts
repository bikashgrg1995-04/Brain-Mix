import { DIFFICULTY, type Difficulty } from './types';

export const BASE_XP = [70, 60, 50, 40, 30, 20] as const; // 1..6 tries

/** XP = base(tries) x difficulty multiplier x (bonus round ? 2 : 1). Server ma calculate garne. */
export function xpFor(tries: number, difficulty: Difficulty, bonusRound = false): number {
  const base = BASE_XP[tries - 1];
  if (base === undefined) throw new Error(`invalid tries: ${tries}`);
  if (tries > DIFFICULTY[difficulty].maxTries) throw new Error('tries exceeds max for difficulty');
  return Math.round(base * DIFFICULTY[difficulty].xpMult * (bonusRound ? 2 : 1));
}
