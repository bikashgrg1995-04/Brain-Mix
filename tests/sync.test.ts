import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle, type Action, type Result, type ServerProfile, type Store } from '../server/game';
import type { Remote } from '../src/state/remote';
import { Sync, type SyncHooks } from '../src/state/sync';
import { loadProfile, type Profile } from '../src/state/profile';

class MemStore implements Store {
  rows = new Map<string, { profile: ServerProfile; version: number }>();
  async load(id: string) { const r = this.rows.get(id); return r ? { profile: structuredClone(r.profile), version: r.version } : null; }
  async save(id: string, profile: ServerProfile, version: number | null) {
    const r = this.rows.get(id);
    if (version === null ? !!r : r?.version !== version) return false;
    this.rows.set(id, { profile: structuredClone(profile), version: (r?.version ?? 0) + 1 });
    return true;
  }
}

class FakeRemote implements Remote {
  store = new MemStore();
  online = true;
  calls: Action[] = [];
  async call(a: Action): Promise<Result> {
    if (!this.online) throw new Error('offline');
    this.calls.push(a);
    return handle(this.store, 'u1', a, Date.now());
  }
}

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }
const win = (level: number): Action => ({ a: 'complete', level, kind: 'grid', tries: 1 });

let remote: FakeRemote; let storage: Mem; let profile: Profile; let hooks: SyncHooks & { updates: number; warns: string[]; gained: unknown[] };
const mk = (p = profile) => new Sync(p, remote, hooks, { storage, gapMs: 2200, retryMs: 4000 });
const flush = async (ms = 0) => { await vi.advanceTimersByTimeAsync(ms); };

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 10, 2, 6, 15));
  remote = new FakeRemote(); storage = new Mem(); profile = loadProfile();
  hooks = { updates: 0, warns: [], gained: [], onUpdate(g) { this.updates++; this.gained.push(g); }, onWarn(m) { this.warns.push(m); } };
});
afterEach(() => vi.useRealTimers());

describe('Sync', () => {
  it('start: server gets the local progress once and local object is updated in place', async () => {
    profile.levels = { '0': 3, '1': 2 }; profile.xp = 300; profile.coins = 80;
    const ref = profile; const s = mk(); s.start(); await flush();
    expect(profile).toBe(ref);
    expect(remote.calls[0]).toMatchObject({ a: 'sync', local: { xp: 300, coins: 80 } });
    expect(profile.levels).toEqual({ '0': 3, '1': 2 }); expect(profile.coins).toBe(80 + 10); // + 'first' badge ko inam
    expect(profile.badges.first).toBeTruthy(); // server le badge dilaayo
    expect(s.pending).toBe(0); expect(hooks.updates).toBe(1);
  });

  it('server numbers win: optimistic local values are replaced after the round trip', async () => {
    const s = mk(); s.start(); await flush();
    profile.coins += 999; profile.xp += 999; profile.levels['0'] = 3; // local ma ramrari cheat/optimistic
    s.push(win(0)); await flush();
    expect(profile.coins).toBe(30 + 30 + 10); // start + 3 star + 'first' badge
    expect(profile.xp).toBe(70);
    expect(hooks.gained.at(-1)).toMatchObject({ xp: 70, coins: 40, badges: ['first'] });
  });

  it('offline: warns once, keeps the outbox, then replays in order with gaps when back online', async () => {
    const s = mk(); remote.online = false; s.start(); await flush();
    s.push(win(0)); s.push(win(1)); await flush(3000);
    expect(hooks.warns).toHaveLength(1);
    expect(s.pending).toBe(3);
    remote.online = true;
    await flush(70_000);
    expect(s.pending).toBe(0);
    expect(remote.calls.map((c) => c.a === 'complete' ? `c${c.level}` : c.a)).toEqual(['sync', 'c0', 'c1']);
    expect(profile.levels).toEqual({ '0': 3, '1': 3 });
  });

  it('outbox survives an app restart', async () => {
    remote.online = false; const s1 = mk(); s1.start(); s1.push(win(0)); await flush(1000); s1.stop();
    expect(JSON.parse(storage.getItem('shabda_outbox_v1')!).map((a: Action) => a.a)).toEqual(['sync', 'complete']);
    remote.online = true;
    const p2 = loadProfile(); const s2 = mk(p2); s2.start(); await flush(30_000);
    expect(s2.pending).toBe(0); expect(p2.levels['0']).toBe(3);
    expect(remote.calls.filter((c) => c.a === 'sync')).toHaveLength(1); // dohoriyeko sync ek matra
  });

  it('too_fast waits and retries instead of dropping the action', async () => {
    const s = mk(); s.start(); await flush();
    s.push(win(0)); s.push(win(1)); s.push(win(2)); await flush(60_000);
    expect(profile.levels).toEqual({ '0': 3, '1': 3, '2': 3 });
    expect(s.pending).toBe(0);
  });

  it('rejected actions are dropped, server state is applied, user is told when coins are short', async () => {
    const s = mk(); s.start(); await flush();
    profile.coins = 500; // local ma jhutho
    for (let i = 0; i < 4; i++) { s.push({ a: 'spend', item: 'hint', level: 0 }); await flush(300); }
    expect(profile.coins).toBe(0 + (30 - 30)); // 30 coin = 3 hint (10 each), chautho refuse
    expect(hooks.warns.some((w) => /Coin/.test(w))).toBe(true);
    expect(s.pending).toBe(0);
  });

  it('does not regress the screen while later actions are still queued', async () => {
    const s = mk(); s.start(); await flush();
    remote.online = false; s.push(win(0)); await flush(100);
    profile.coins = 123; // optimistic
    expect(profile.coins).toBe(123); // offline: server le chhoeko chhaina
    remote.online = true; await flush(10_000); expect(profile.coins).toBe(70);
  });

  it('caps the outbox size', async () => {
    remote.online = false; const s = mk();
    for (let i = 0; i < 260; i++) s.push({ a: 'mp', won: false });
    expect(s.pending).toBeLessThanOrEqual(200);
    s.stop();
  });
});
