export type Tile = 'green' | 'yellow' | 'grey';
export type Difficulty = 1 | 2 | 3 | 4;

export interface DifficultyRule {
  name: string;
  xpMult: number;
  maxTries: number;
  hintCost: number;
}

// Source: Difficulty Settings sheet. Medium hint cost (10) assumption ho.
export const DIFFICULTY: Record<Difficulty, DifficultyRule> = {
  1: { name: 'Easy', xpMult: 1, maxTries: 6, hintCost: 10 },
  2: { name: 'Medium', xpMult: 1.5, maxTries: 6, hintCost: 10 },
  3: { name: 'Hard', xpMult: 2, maxTries: 5, hintCost: 15 },
  4: { name: 'Expert', xpMult: 3, maxTries: 5, hintCost: 25 },
};

export const MIN_LEN = 4;
export const MAX_LEN = 7;

export interface WordEntry {
  answer: string; // canonical Romanized spelling, lowercase
  difficulty: Difficulty;
  category: string;
  hint?: string;
  aliases?: string[];
}
