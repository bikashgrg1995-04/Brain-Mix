import { describe, expect, it } from 'vitest';
import { CHAPTERS, TOTAL_LEVELS, altitudeText, autoLevelWord, bandLabel, chapterOf, levelWord, starsFor } from '../src/game/chapters';
import { MAP_H, chapterAtY, pos } from '../src/game/map';
import { buildScenery } from '../src/game/scenery';
import { contrast } from '../src/game/theme';

describe('Yatra map data', () => {
  it('has 10 chapters x 10 levels', () => {
    expect(CHAPTERS).toHaveLength(10);
    expect(TOTAL_LEVELS).toBe(100);
    expect(chapterOf(0)).toBe(0);
    expect(chapterOf(99)).toBe(9);
  });
  it('every auto level word is inside its chapter difficulty band', () => {
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      expect(CHAPTERS[chapterOf(i)]!.band).toContain(autoLevelWord(i).difficulty);
    }
  });
  it('same level always gives the same word', () => {
    expect(levelWord(37).answer).toBe(levelWord(37).answer);
  });
  it('stars by tries', () => {
    expect([1, 2, 3, 4, 5, 6].map(starsFor)).toEqual([3, 3, 2, 2, 1, 1]);
  });
});

describe('climb: lowest point of Nepal to Sagarmatha', () => {
  it('altitude only goes up, from the lowest place to Sagarmatha', () => {
    const alt = CHAPTERS.map((c) => c.altitude);
    for (let i = 1; i < alt.length; i++) expect(alt[i]!).toBeGreaterThan(alt[i - 1]!);
    expect(alt[0]!).toBeLessThan(100); // Terai, close to sea level
    expect(CHAPTERS[9]!.place).toBe('Sagarmatha');
    expect(alt[9]!).toBe(8849);
  });
  it('difficulty never drops as you climb, easiest at level 1, hardest at level 100', () => {
    let prevLo = 0;
    let prevHi = 0;
    for (const c of CHAPTERS) {
      const lo = Math.min(...c.band);
      const hi = Math.max(...c.band);
      expect(lo).toBeGreaterThanOrEqual(prevLo);
      expect(hi).toBeGreaterThanOrEqual(prevHi);
      prevLo = lo;
      prevHi = hi;
    }
    expect(CHAPTERS[0]!.band).toEqual([1]);
    expect(CHAPTERS[9]!.band).toEqual([4]);
  });
  it('formats altitude and band for the map', () => {
    expect(altitudeText(8849)).toBe('8,849 m');
    expect(bandLabel([1])).toBe('Easy');
    expect(bandLabel([2, 3])).toBe('Medium-Hard');
  });
});

describe('per-place theme', () => {
  it('every place has its own colours and its own scene', () => {
    expect(new Set(CHAPTERS.map((c) => c.theme.scene.kind)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.theme.accent)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.theme.palette.skyBottom)).size).toBe(CHAPTERS.length);
  });
  it('accent text and buttons are readable in light and dark mode (WCAG AA 4.5:1)', () => {
    for (const c of CHAPTERS) {
      const { accent, accentDark } = c.theme;
      // light: white button text on the accent, and accent text on the page background
      expect(contrast(accent, '#ffffff'), `${c.place} light on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, '#eef2f5'), `${c.place} light on bg`).toBeGreaterThanOrEqual(4.5);
      // dark: dark ink on the accent button, and accent text on the dark page background
      expect(contrast(accentDark, '#14202b'), `${c.place} dark on ink`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accentDark, '#0f1a22'), `${c.place} dark on bg`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('builds a clean scenery svg for every place, full map section and game banner', () => {
    CHAPTERS.forEach((c, i) => {
      for (const banner of [false, true]) {
        const svg = buildScenery(c, `t${i}`, { banner });
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).not.toContain('NaN');
        expect(svg).not.toContain('undefined');
      }
    });
  });
});

describe('map layout', () => {
  it('level 1 is at the bottom and level 100 at the top, in order', () => {
    let prev = Infinity;
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const { y } = pos(i);
      expect(y).toBeLessThan(prev);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MAP_H);
      prev = y;
    }
  });
  it('scrolling to a level shows that level\'s own place', () => {
    for (let i = 0; i < TOTAL_LEVELS; i++) expect(chapterAtY(pos(i).y)).toBe(chapterOf(i));
    expect(chapterAtY(-1000)).toBe(CHAPTERS.length - 1);
    expect(chapterAtY(MAP_H + 1000)).toBe(0);
  });
});
