import { describe, expect, it } from 'vitest';
import { rankFor } from '../shared/rank';

describe('rankFor', () => {
  it('starts as Naya Yatri', () => {
    const r = rankFor(0);
    expect(r.title).toBe('Naya Yatri');
    expect(r.next).toBe('Porter');
    expect(r.toNext).toBe(300);
  });
  it('progress and max rank', () => {
    expect(rankFor(150).progress).toBeCloseTo(0.5);
    expect(rankFor(9999).title).toBe('Himal Vijeta');
    expect(rankFor(9999).progress).toBe(1);
  });
});
