import { describe, expect, it } from 'vitest';
import { CHAPTERS, TOTAL_LEVELS, chapterOf, levelWord, starsFor } from '../src/game/chapters';

describe('Yatra map data', () => {
  it('has 10 chapters x 10 levels', () => {
    expect(CHAPTERS).toHaveLength(10);
    expect(TOTAL_LEVELS).toBe(100);
    expect(chapterOf(0)).toBe(0);
    expect(chapterOf(99)).toBe(9);
  });
  it('every level word is inside its chapter difficulty band', () => {
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      expect(CHAPTERS[chapterOf(i)]!.band).toContain(levelWord(i).difficulty);
    }
  });
  it('same level always gives the same word', () => {
    expect(levelWord(37).answer).toBe(levelWord(37).answer);
  });
  it('stars by tries', () => {
    expect([1, 2, 3, 4, 5, 6].map(starsFor)).toEqual([3, 3, 2, 2, 1, 1]);
  });
});
