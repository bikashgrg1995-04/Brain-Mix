import { describe, expect, it } from 'vitest';
import { DAILY_COINS } from '../shared/rewards';
import { MIN_GAP_MS, handle, newProfile, nextLevel, type Action, type ServerProfile, type Store } from '../server/game';

class MemStore implements Store {
  rows = new Map<string, { profile: ServerProfile; version: number }>();
  conflicts = 0; // aaune save ma kati patak "kasai le badlyo" bhannu
  async load(id: string) { const r = this.rows.get(id); return r ? { profile: structuredClone(r.profile), version: r.version } : null; }
  async save(id: string, profile: ServerProfile, version: number | null) {
    if (this.conflicts > 0) { this.conflicts--; return false; }
    const r = this.rows.get(id);
    if (version === null ? !!r : r?.version !== version) return false;
    this.rows.set(id, { profile: structuredClone(profile), version: (r?.version ?? 0) + 1 });
    return true;
  }
}
// 2026-11-02 12:00 Nepal
const T0 = Date.UTC(2026, 10, 2, 6, 15);
const DAY = 86_400_000;
let t = T0;
const run = (s: Store, a: Action, id = 'u1', now = t) => handle(s, id, a, now);
const ok = async (s: Store, a: Action, now = t) => { const r = await run(s, a, 'u1', now); if (!r.ok) throw new Error(r.error); return r; };
const win = (level: number, tries = 1): Action => ({ a: 'complete', level, kind: 'grid', tries });

describe('sync', () => {
  it('creates a fresh profile with starting coins; second sync is the same row', async () => {
    const s = new MemStore();
    const r = await ok(s, { a: 'sync' });
    expect(r.profile.coins).toBe(30); expect(r.profile.levels).toEqual({});
    await ok(s, { a: 'sync' });
    expect(s.rows.get('u1')!.version).toBe(2);
  });
  it('imports local progress once, with caps and validation', async () => {
    const s = new MemStore();
    const r = await ok(s, { a: 'sync', local: { xp: 999_999, coins: 99_999, levels: { '0': 3, '1': 2, '500': 3, x: 3, '2': 9 } } });
    expect(r.profile.levels).toEqual({ '0': 3, '1': 2 });
    expect(r.profile.xp).toBe(5000); expect(r.profile.coins).toBeGreaterThanOrEqual(500);
    const again = await ok(s, { a: 'sync', local: { xp: 1, coins: 1, levels: { '9': 3 } } });
    expect(again.profile.levels).toEqual({ '0': 3, '1': 2 }); // dosro import chaldaina
    expect((await ok(new MemStore(), { a: 'sync', local: 'junk' })).profile.coins).toBe(30);
  });
});

describe('complete', () => {
  it('server works out stars, xp and coins; client amounts are not trusted', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    t += 5000;
    const r = await run(s, { a: 'complete', level: 0, kind: 'grid', tries: 1, coins: 9999, xp: 9999, stars: 1 } as any);
    expect(r.ok && r.gained).toMatchObject({ xp: 70, coins: 30 + 10 }); // 70xp (1 try, easy); 30 coin (3 star) + 'first' badge 10
    expect(r.ok && r.profile.levels['0']).toBe(3);
    expect(r.ok && r.gained.badges).toContain('first');
  });
  it('non-grid rounds use the client stars (1-3) with server xp/coins; replay gives nothing', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    t += 5000; const a = await ok(s, { a: 'complete', level: 0, kind: 'quiz', stars: 2 });
    expect(a.gained.xp).toBe(50); expect(a.profile.stats.wins.quiz).toBe(1);
    t += 5000; const b = await ok(s, { a: 'complete', level: 0, kind: 'quiz', stars: 3 });
    expect(b.gained.xp).toBe(0); expect(b.profile.levels['0']).toBe(3); // star badhyo, xp/coin chhaina
    t += 5000; const c = await ok(s, { a: 'complete', level: 0, kind: 'quiz', stars: 1 });
    expect(c.profile.levels['0']).toBe(3); // star ghatdaina
  });
  it('cannot skip levels, bad input rejected, too-fast refused but still returns profile', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    t += 5000;
    expect(await run(s, win(5))).toMatchObject({ ok: false, error: 'not_unlocked' });
    for (const bad of [{ a: 'complete', level: -1, kind: 'grid', tries: 1 }, { a: 'complete', level: 100, kind: 'grid', tries: 1 }, { a: 'complete', level: 0, kind: 'x', tries: 1 }, { a: 'complete', level: 0, kind: 'grid', tries: 9 }, { a: 'complete', level: 0, kind: 'quiz', stars: 4 }, { a: 'complete', level: 0, kind: 'quiz' }, { a: 'complete', level: 1.5, kind: 'quiz', stars: 1 }, null, 5, { a: 'hack' }]) {
      expect((await run(s, bad as any)).ok, JSON.stringify(bad)).toBe(false);
    }
    await ok(s, win(0));
    const fast = await run(s, win(1), 'u1', t + 500);
    expect(fast).toMatchObject({ ok: false, error: 'too_fast' });
    expect(fast.ok === false && fast.profile?.levels['0']).toBe(3);
    expect((await run(s, win(1), 'u1', t + MIN_GAP_MS.complete!)).ok).toBe(true);
  });
  it('players do not share data', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' }); t += 5000; await ok(s, win(0));
    const other = await run(s, { a: 'sync' }, 'u2');
    expect(other.ok && other.profile.levels).toEqual({});
  });
  it('retries when someone else saved in between, gives up as busy', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' }); t += 5000;
    s.conflicts = 2; expect((await run(s, win(0))).ok).toBe(true);
    s.conflicts = 5; expect(await run(s, win(1), 'u1', t + 5000)).toMatchObject({ ok: false, error: 'busy' });
  });
});

describe('spend', () => {
  it('charges the server price, refuses without coins and counts the power-up', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    const r = await ok(s, { a: 'spend', item: 'hint', level: 0 });
    expect(r.profile.coins).toBe(20); expect(r.profile.stats.powerups).toBe(1);
    t += 1000; expect((await ok(s, { a: 'spend', item: 'time', level: 0 })).profile.coins).toBe(10);
    t += 1000; expect((await ok(s, { a: 'spend', item: 'fifty', level: 0 })).profile.coins).toBe(0);
    t += 1000; expect(await run(s, { a: 'spend', item: 'hint', level: 0 })).toMatchObject({ ok: false, error: 'no_coins' });
  });
  it('difficulty claim is clamped to the place band (cannot buy a hard hint for the easy price)', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync', local: { coins: 100 } });
    expect((await ok(s, { a: 'spend', item: 'hint', level: 0, difficulty: 4 })).profile.coins).toBe(90); // band [1]: 10
    t += 1000;
    expect((await ok(s, { a: 'spend', item: 'hint', level: 99, difficulty: 1 })).profile.coins).toBe(65); // band [4]: 25
    t += 1000;
    expect((await ok(s, { a: 'spend', item: 'hint', level: 99, difficulty: 'x' as any })).profile.coins).toBe(40);
    expect((await run(s, { a: 'spend', item: 'cheat' as any, level: 0 })).ok).toBe(false);
  });
});

describe('daily reward, daily word, multiplayer', () => {
  it('daily claim: server date, once per day, cycle advances, a missed day restarts', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    const d1 = await ok(s, { a: 'daily' }, T0);
    expect(d1.profile.coins).toBe(30 + DAILY_COINS[0]);
    expect(await run(s, { a: 'daily' }, 'u1', T0 + 3_600_000)).toMatchObject({ ok: false, error: 'already' });
    expect((await ok(s, { a: 'daily' }, T0 + DAY)).gained.coins).toBe(DAILY_COINS[1]);
    expect((await ok(s, { a: 'daily' }, T0 + 4 * DAY)).gained.coins).toBe(DAILY_COINS[0]); // 2 din chhutyo
  });
  it('the day rolls over at Nepal midnight, not UTC', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    await ok(s, { a: 'daily' }, Date.UTC(2026, 10, 2, 17, 0)); // Nepal 22:45 (Nov 2)
    expect((await run(s, { a: 'daily' }, 'u1', Date.UTC(2026, 10, 2, 18, 20))).ok).toBe(true); // Nepal 00:05 (Nov 3), UTC ma ahile Nov 2
  });
  it('daily word: once a day, streak counted on server, streak badge', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    let last: any;
    for (let i = 0; i < 3; i++) last = await ok(s, { a: 'dailyWord', tries: 3, won: true }, T0 + i * DAY);
    expect(last.profile.streak).toBe(3); expect(last.gained.badges).toContain('streak3');
    expect(await run(s, { a: 'dailyWord', tries: 1, won: true }, 'u1', T0 + 2 * DAY + 1000)).toMatchObject({ ok: false, error: 'already' });
    expect((await run(s, { a: 'dailyWord', tries: 9, won: true }, 'u1', T0 + 9 * DAY)).ok).toBe(false);
  });
  it('multiplayer result is rate limited', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' });
    const a = await ok(s, { a: 'mp', won: true });
    expect(a.profile.stats).toMatchObject({ mpPlayed: 1, mpWon: 1 }); expect(a.gained.badges).toEqual(expect.arrayContaining(['mp1', 'mpwin']));
    expect(await run(s, { a: 'mp', won: true }, 'u1', t + 1000)).toMatchObject({ ok: false, error: 'too_fast' });
    expect((await run(s, { a: 'mp', won: false }, 'u1', t + 61_000)).ok).toBe(true);
  });
  it('badge coin rewards go to the server profile once; nextLevel/newProfile sanity', async () => {
    const s = new MemStore(); await ok(s, { a: 'sync' }); t += 5000;
    const r = await ok(s, win(0, 6));
    expect(r.profile.badges.first).toBeTruthy();
    const again = await ok(s, { a: 'sync' });
    expect(again.gained.badges).toEqual([]);
    expect(nextLevel({ '0': 1, '1': 2, '3': 1 })).toBe(2); expect(nextLevel({})).toBe(0); expect(newProfile().coins).toBe(30);
  });
});
