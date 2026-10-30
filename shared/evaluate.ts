import type { Tile } from './types';

/**
 * Wordle tile evaluation, variable length (4-7), repeated letters ko sahi handling.
 * Pass 1: greens. Pass 2: yellows (answer ko bachheko letter count bhaye matra).
 */
export function evaluate(guess: string, answer: string): Tile[] {
  if (guess.length !== answer.length) {
    throw new Error(`length mismatch: guess ${guess.length}, answer ${answer.length}`);
  }
  const n = answer.length;
  const result: Tile[] = Array(n).fill('grey');
  const left: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const a = answer[i]!;
    if (guess[i] === a) result[i] = 'green';
    else left[a] = (left[a] ?? 0) + 1;
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === 'green') continue;
    const g = guess[i]!;
    const c = left[g] ?? 0;
    if (c > 0) {
      result[i] = 'yellow';
      left[g] = c - 1;
    }
  }
  return result;
}

export const isWin = (tiles: Tile[]): boolean => tiles.every((t) => t === 'green');
