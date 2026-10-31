import { describe, expect, it } from 'vitest';
import { TIME_BONUS_SEC, fiftyFifty, hintCost, revealPosition, roundCoins } from '../shared/powerups';
import { SEQUENCES } from '../src/audio/sfx';

describe('powerups', () => {
  it('hint cost follows difficulty; time bonus is a sensible size', () => {
    expect([1, 2, 3, 4].map((d) => hintCost(d as 1))).toEqual([10, 10, 15, 25]);
    expect(TIME_BONUS_SEC).toBeGreaterThanOrEqual(10);
  });
  it('coins only on first clear, 10 per star', () => {
    expect(roundCoins(3, true)).toBe(30);
    expect(roundCoins(1, true)).toBe(10);
    expect(roundCoins(3, false)).toBe(0);
    expect(roundCoins(0, true)).toBe(0);
  });
  it('reveals the leftmost position that is not already green or shown', () => {
    expect(revealPosition('momo', new Set())).toBe(0);
    expect(revealPosition('momo', new Set([0, 1]))).toBe(2);
    expect(revealPosition('momo', new Set([0]), new Set([1]))).toBe(2);
    expect(revealPosition('momo', new Set([0, 1, 2, 3]))).toBeNull();
  });
  it('50:50 removes exactly two wrong options, never the right one', () => {
    for (let c = 0; c < 4; c++) for (const r of [0, 0.4, 0.99, 0.5]) {
      const gone = fiftyFifty(4, c, () => r);
      expect(gone).toHaveLength(2);
      expect(gone).not.toContain(c);
      expect(new Set(gone).size).toBe(2);
    }
    for (let i = 0; i < 200; i++) expect(fiftyFifty(4, 1)).not.toContain(1);
  });
  it('every sound effect has notes in a hearable, short range', () => {
    for (const [name, notes] of Object.entries(SEQUENCES)) {
      expect(notes.length, name).toBeGreaterThan(0);
      for (const n of notes) { expect(n.f).toBeGreaterThan(100); expect(n.f).toBeLessThan(3000); expect(n.at + n.d).toBeLessThan(1.2); }
    }
  });
});
