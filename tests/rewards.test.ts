import { describe, expect, it } from 'vitest';
import { BADGES, chaptersDone, emptyStats, newlyUnlocked, type Snapshot } from '../shared/achievements';
import { DAILY_COINS, claimDaily, dailyView } from '../shared/rewards';
import { loadProfile } from '../src/state/profile';
import { awardBadges, badgeCount, claimReward, recordMultiplayer, recordPowerup, recordWin } from '../src/state/progress';

const T = '2026-11-02', Y = '2026-11-01';

describe('daily reward', () => {
  it('first ever claim is day 1; same day twice is refused', () => {
    expect(dailyView(undefined, T, Y)).toEqual({ claimable: true, day: 1, coins: 10 });
    const c = claimDaily(undefined, T, Y)!;
    expect(c).toEqual({ state: { last: T, day: 1 }, coins: 10 });
    expect(claimDaily(c.state, T, Y)).toBeNull();
    expect(dailyView(c.state, T, Y)).toMatchObject({ claimable: false, day: 2, coins: 15 }); // kal ko preview
  });
  it('consecutive days climb the cycle, day 7 is the biggest, then wraps to day 1', () => {
    let st = undefined as { last: string; day: number } | undefined;
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    const got: number[] = [];
    days.forEach((d, i) => { const r = claimDaily(st, d, days[i - 1] ?? '2026-10-31')!; st = r.state; got.push(r.coins); });
    expect(got).toEqual([...DAILY_COINS, DAILY_COINS[0]]);
    expect(Math.max(...DAILY_COINS)).toBe(DAILY_COINS[6]);
  });
  it('missing a day restarts at day 1', () => {
    expect(dailyView({ last: '2026-10-29', day: 5 }, T, Y)).toEqual({ claimable: true, day: 1, coins: 10 });
  });
});

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ stats: emptyStats(), levels: {}, perChapter: 10, coins: 0, streak: 0, ...over });
const levels = (n: number, stars = 1): Record<string, number> => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), stars]));

describe('badges', () => {
  it('ids are unique and rewards positive', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const b of BADGES) { expect(b.reward).toBeGreaterThan(0); expect(b.need).toBeGreaterThan(0); }
  });
  it('level/star/chapter thresholds', () => {
    const ids = (s: Snapshot) => newlyUnlocked(s, new Set()).map((b) => b.id);
    expect(ids(snap())).toEqual([]);
    expect(ids(snap({ levels: levels(1) }))).toEqual(['first']);
    expect(ids(snap({ levels: levels(10, 3) }))).toEqual(expect.arrayContaining(['first', 'lv10', 'ch1', 'star30']));
    expect(ids(snap({ levels: levels(9) }))).not.toContain('ch1');
    expect(chaptersDone(snap({ levels: { ...levels(10), '15': 1, '19': 1 } }))).toBe(1); // doosro thau adhuro
    expect(chaptersDone(snap({ levels: levels(100) }))).toBe(10);
  });
  it('already-owned badges never fire again', () => {
    expect(newlyUnlocked(snap({ levels: levels(1) }), new Set(['first']))).toEqual([]);
  });
  it('all-rounder needs every type, not just the best one', () => {
    const wins = { grid: 5, quiz: 5, photo: 5, rush: 4 };
    expect(newlyUnlocked(snap({ stats: { ...emptyStats(), wins } }), new Set()).map((b) => b.id)).not.toContain('all5');
    expect(newlyUnlocked(snap({ stats: { ...emptyStats(), wins: { ...wins, rush: 5 } } }), new Set()).map((b) => b.id)).toContain('all5');
  });
});

describe('progress on a profile', () => {
  it('awards each badge once with its coins, and chains (coins reward can unlock 200-coin badge)', () => {
    const p = loadProfile();
    p.coins = 190;
    p.levels = levels(1);
    const got = awardBadges(p, '2026-11-02');
    expect(got.map((b) => b.id).sort()).toEqual(['coin200', 'first']); // 190 + 10 (first) = 200 -> coin200
    expect(p.coins).toBe(190 + 10 + 20);
    expect(p.badges.first).toBe('2026-11-02');
    expect(awardBadges(p)).toEqual([]);
    expect(badgeCount(p)).toBe(`2/${BADGES.length}`);
  });
  it('records wins, flawless, power-ups, multiplayer', () => {
    const p = loadProfile();
    recordWin(p, 'quiz', 3); recordWin(p, 'quiz', 1); recordPowerup(p); recordMultiplayer(p, true); recordMultiplayer(p, false);
    expect(p.stats).toMatchObject({ wins: { quiz: 2, grid: 0 }, flawless: 1, powerups: 1, mpPlayed: 2, mpWon: 1 });
  });
  it('claimReward adds coins once a day', () => {
    const p = loadProfile();
    const before = p.coins;
    const r = claimReward(p)!;
    expect(r.day).toBe(1);
    expect(p.coins).toBe(before + 10);
    expect(claimReward(p)).toBeNull();
  });
});
