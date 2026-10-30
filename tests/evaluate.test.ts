import { describe, expect, it } from 'vitest';
import { evaluate, isWin } from '../shared/evaluate';

const G = 'green', Y = 'yellow', X = 'grey';

describe('evaluate', () => {
  it('all green on exact match (length 4)', () => {
    expect(isWin(evaluate('momo', 'momo'))).toBe(true);
  });
  it('repeated letters: extra guess letter grey', () => {
    expect(evaluate('aaaba', 'abaca')).toEqual([G, X, G, Y, G]);
  });
  it('classic speed vs abide', () => {
    expect(evaluate('speed', 'abide')).toEqual([X, X, Y, X, Y]);
  });
  it('works for length 6 and 7', () => {
    expect(evaluate('sherpa', 'sherpa')).toEqual(Array(6).fill(G));
    expect(evaluate('dashain', 'dalbhat')).toHaveLength(7);
  });
  it('throws on length mismatch', () => {
    expect(() => evaluate('momo', 'chiya')).toThrow();
  });
});
