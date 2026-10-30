import { describe, expect, it } from 'vitest';
import { xpFor } from '../shared/xp';
import { normalizeBoard, normalizeExact } from '../shared/normalize';

describe('xpFor', () => {
  it('matches the XP table', () => {
    expect(xpFor(1, 1)).toBe(70);
    expect(xpFor(1, 2)).toBe(105);
    expect(xpFor(3, 2)).toBe(75);
    expect(xpFor(1, 3)).toBe(140);
    expect(xpFor(5, 3)).toBe(60);
    expect(xpFor(1, 4)).toBe(210);
    expect(xpFor(6, 1)).toBe(20);
  });
  it('bonus round doubles', () => {
    expect(xpFor(1, 3, true)).toBe(280);
  });
  it('rejects tries above max for difficulty', () => {
    expect(() => xpFor(6, 3)).toThrow();
    expect(() => xpFor(0, 1)).toThrow();
  });
});

describe('normalize', () => {
  it('board: daalbhat = dal bhat = dalbhat', () => {
    const a = normalizeBoard('daalbhat');
    expect(a).toBe(normalizeBoard('dal bhat'));
    expect(a).toBe(normalizeBoard('Dal-Bhat'));
  });
  it('exact keeps repeated letters', () => {
    expect(normalizeExact(' Aama ')).toBe('aama');
  });
});
