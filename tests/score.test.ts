import { describe, expect, it } from 'vitest';
import { photoStars, placementFraction, roundXp, rushFraction, rushPassed, rushStars, timedStars, wordPoints } from '../shared/score';

describe('placement scoring', () => {
  it('exact = 100, right letters wrong place < 100, length mismatch = 0', () => {
    expect(wordPoints('momo', 'momo')).toBe(100);
    expect(wordPoints('xxxx', 'momo')).toBe(0);
    expect(wordPoints('mom', 'momo')).toBe(0);
  });
  it('more letters in the right place scores higher', () => {
    expect(wordPoints('momx', 'momo')).toBeGreaterThan(wordPoints('mxxx', 'momo'));
    expect(wordPoints('momx', 'momo')).toBe(75);
    // right letters, wrong places: half credit each
    expect(wordPoints('omom', 'momo')).toBe(50);
  });
  it('never reaches 100 unless exact', () => {
    expect(wordPoints('momx', 'momo')).toBeLessThan(100);
  });
});

describe('rush / stars / xp', () => {
  it('pass at 50%, stars at 70% and 90%', () => {
    expect(rushFraction([100, 100, 100, 100, 100])).toBe(1);
    expect(rushStars([100, 100, 100, 100, 100])).toBe(3);
    expect(rushStars([100, 100, 100, 50, 0])).toBe(2); // 70%
    expect(rushStars([100, 100, 50, 0, 0])).toBe(1); // 50%
    expect(rushStars([100, 50, 0, 0, 0])).toBe(0);
    expect(rushPassed([100, 100, 50, 0, 0])).toBe(true);
    expect(rushPassed([0, 0, 0, 0, 0])).toBe(false);
  });
  it('quiz: wrong = 0, faster = more stars', () => {
    expect(timedStars(false, 30, 30)).toBe(0);
    expect(timedStars(true, 25, 30)).toBe(3);
    expect(timedStars(true, 15, 30)).toBe(2);
    expect(timedStars(true, 2, 30)).toBe(1);
  });
  it('photo: out of time or tries = 0', () => {
    expect(photoStars(1, 50, 60)).toBe(3);
    expect(photoStars(2, 50, 60)).toBe(2);
    expect(photoStars(3, 5, 60)).toBe(1);
    expect(photoStars(1, 0, 60)).toBe(0);
    expect(photoStars(0, 40, 60)).toBe(0);
  });
  it('xp only on first clear, scaled by difficulty', () => {
    expect(roundXp(3, 1, true)).toBe(70);
    expect(roundXp(3, 4, true)).toBe(210);
    expect(roundXp(3, 1, false)).toBe(0);
    expect(roundXp(0, 1, true)).toBe(0);
  });
});
