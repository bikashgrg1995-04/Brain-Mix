import { beforeEach, describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET, MAX_PLAYERS, MP_ROUNDS, REVEAL_MS, cleanName, isSubmission, makeCode, normalizeCode, rankPlayers, scoreSubmission, toPublic,
  type SecretRound,
} from '../shared/multiplayer';
import { Session, type Env, type View } from '../src/mp/session';
import { Hub, MemoryTransport } from './helpers/memory-transport';

const quiz: SecretRound = { kind: 'quiz', question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 2, category: 'x', timer: 30 };
const photo: SecretRound = { kind: 'photo', emoji: '🥟', answer: 'momo', category: 'x', timer: 60 };
const rush: SecretRound = { kind: 'rush', timer: 90, words: ['momo', 'pani', 'ghar', 'chiya', 'kitab'].map((answer) => ({ answer, category: 'c' })) };

describe('protocol helpers', () => {
  it('room code: 5 chars, no look-alike letters, user input is forgiven', () => {
    for (let i = 0; i < 50; i++) { const c = makeCode(); expect(c).toHaveLength(5); expect([...c].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true); }
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/);
    expect(normalizeCode(' ab-c2 d ')).toBe('ABC2D');
    expect(normalizeCode('ABC')).toBeNull();
    expect(normalizeCode('ABCD0')).toBeNull(); // 0 alphabet ma chhaina
  });
  it('names are trimmed, stripped of tags/control chars, capped', () => {
    expect(cleanName('  Bikash   Gurung <b>x</b> thisistoolong ')).toBe('Bikash Gurun');
    expect(cleanName('a\u0000b')).toBe('ab');
  });
  it('public view never contains the answer', () => {
    expect(JSON.stringify(toPublic(quiz))).not.toContain('correct');
    expect(toPublic(photo)).toEqual({ kind: 'photo', emoji: '🥟', len: 4, category: 'x', hint: undefined });
    expect(JSON.stringify(toPublic(photo))).not.toContain('momo');
    expect(JSON.stringify(toPublic(rush))).not.toContain('kitab');
  });
  it('submission shape check rejects junk from the network', () => {
    expect(isSubmission({ kind: 'quiz', pick: 1 })).toBe(true);
    for (const bad of [null, 1, {}, { kind: 'quiz' }, { kind: 'photo', guess: 5 }, { kind: 'rush', guesses: new Array(6).fill('a') }, { kind: 'rush', guesses: [1] }, { kind: 'photo', guess: 'x'.repeat(41) }]) {
      expect(isSubmission(bad)).toBe(false);
    }
  });
  it('scoring: quiz right+fast > right+slow > wrong; late bonus never negative', () => {
    expect(scoreSubmission(quiz, { kind: 'quiz', pick: 2 }, 0)).toBe(150);
    expect(scoreSubmission(quiz, { kind: 'quiz', pick: 2 }, 15_000)).toBe(125);
    expect(scoreSubmission(quiz, { kind: 'quiz', pick: 2 }, 999_000)).toBe(100);
    expect(scoreSubmission(quiz, { kind: 'quiz', pick: 1 }, 0)).toBe(0);
    expect(scoreSubmission(quiz, undefined, 0)).toBe(0);
    expect(scoreSubmission(quiz, { kind: 'photo', guess: 'momo' }, 0)).toBe(0); // galat type
  });
  it('scoring: photo placement, rush average of placements', () => {
    expect(scoreSubmission(photo, { kind: 'photo', guess: ' MOMO ' }, 0)).toBe(150);
    expect(scoreSubmission(photo, { kind: 'photo', guess: 'momx' }, 0)).toBe(75);
    expect(scoreSubmission(photo, { kind: 'photo', guess: 'mo' }, 0)).toBe(0);
    expect(scoreSubmission(rush, { kind: 'rush', guesses: ['momo', 'pani', 'ghar', 'chiya', 'kitab'] }, 0)).toBe(100);
    expect(scoreSubmission(rush, { kind: 'rush', guesses: ['momo', 'pano'] }, 0)).toBe(35); // (100+75)/5
  });
  it('ranking shares ranks on ties (1,1,3)', () => {
    const r = rankPlayers([{ id: 'a', name: 'A', score: 10 }, { id: 'b', name: 'B', score: 30 }, { id: 'c', name: 'C', score: 30 }]);
    expect(r.map((p) => [p.name, p.rank])).toEqual([['B', 1], ['C', 1], ['A', 3]]);
  });
});

// ---------- full game over the memory transport ----------
interface Peerg { s: Session; views: View[]; id: string }
let hub: Hub;
let clock: number;
let timers: { at: number; fn: () => void; id: number }[];
let nextId: number;
const env: Env = {
  rng: () => 0.42,
  now: () => clock,
  setTimeout: (fn, ms) => { const id = ++nextId; timers.push({ at: clock + ms, fn, id }); return id; },
  clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
  buildRound: (i) => [quiz, photo, rush, quiz, photo][i]!,
};
/** Samay aaghi badhaune: timer chalaune, har step ma message flush garne. */
function advance(ms: number): void {
  const end = clock + ms;
  for (;;) {
    hub.flush();
    const next = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    timers = timers.filter((t) => t !== next);
    clock = Math.max(clock, next.at);
    next.fn();
  }
  clock = end;
  hub.flush();
}
function mk(id: string): Peerg {
  const views: View[] = [];
  return { id, views, s: new Session(new MemoryTransport(hub), env, (v) => views.push(v)) };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); hub.flush(); };

beforeEach(() => { hub = new Hub(); clock = 1_000_000; timers = []; nextId = 0; });

async function lobby(n: number) {
  const host = mk('h');
  const code = await host.s.create('h', 'Host');
  await settle();
  const others: Peerg[] = [];
  for (let i = 1; i < n; i++) {
    const p = mk(`p${i}`);
    await p.s.join(p.id, `P${i}`, code.toLowerCase());
    await settle();
    others.push(p);
  }
  return { host, others, code };
}

describe('multiplayer game', () => {
  it('lobby: players appear for everyone, only host can start, needs 2+', async () => {
    const solo = await lobby(1);
    solo.host.s.start();
    advance(0);
    expect(solo.host.s.v.phase).toBe('lobby');
    const { host, others } = await lobby(3);
    expect(host.s.v.players.map((p) => p.name)).toEqual(['Host', 'P1', 'P2']);
    expect(others[1]!.s.v.players).toHaveLength(3);
    expect(others[0]!.s.v.host).toBe('h');
    others[0]!.s.start(); // kheladdi le start garna sakdaina
    advance(0);
    expect(host.s.v.phase).toBe('lobby');
  });

  it('plays all rounds with 3 players and ends with the right totals', async () => {
    const { host, others } = await lobby(3);
    const all = [host, ...others];
    host.s.start();
    advance(0);
    expect(all.every((p) => p.s.v.phase === 'round' && p.s.v.i === 0)).toBe(true);
    expect(JSON.stringify(others[0]!.s.v.round)).not.toContain('correct');

    // R1 quiz: host sahi (turuntai), p1 sahi (15s pachhi), p2 galat
    host.s.submit({ kind: 'quiz', pick: 2 });
    advance(15_000);
    others[0]!.s.submit({ kind: 'quiz', pick: 2 });
    others[1]!.s.submit({ kind: 'quiz', pick: 0 });
    advance(0);
    expect(host.s.v.phase).toBe('reveal');
    expect(host.s.v.reveal).toMatchObject({ answer: 'c', last: false });
    expect(host.s.v.reveal!.gains).toEqual({ h: 150, p1: 125, p2: 0 });
    advance(REVEAL_MS);

    // R2 photo: kasai le submit nagarda timer + grace pachhi 0
    expect(all.every((p) => p.s.v.i === 1)).toBe(true);
    host.s.submit({ kind: 'photo', guess: 'momx' });
    advance(60_000 + 2000 + 1);
    expect(host.s.v.reveal!.gains).toEqual({ h: 75, p1: 0, p2: 0 });
    advance(REVEAL_MS);

    // R3 rush
    others[1]!.s.submit({ kind: 'rush', guesses: ['momo', 'pani', 'ghar', 'chiya', 'kitab'] });
    host.s.submit({ kind: 'rush', guesses: [] });
    others[0]!.s.submit({ kind: 'rush', guesses: ['momo'] });
    advance(REVEAL_MS);
    // R4, R5: sabai sahi / photo
    for (const p of all) p.s.submit({ kind: 'quiz', pick: 2 });
    advance(REVEAL_MS);
    for (const p of all) p.s.submit({ kind: 'photo', guess: 'momo' });
    advance(0);
    expect(others[0]!.s.v.reveal!.last).toBe(true);
    advance(REVEAL_MS);

    for (const p of all) expect(p.s.v.phase).toBe('final');
    const total = Object.fromEntries(host.s.v.players.map((p) => [p.id, p.score]));
    // p2: 0+0+100+150+150 ; host: 150+75+0+150+150 ; p1: 125+0+20+150+150 (rush 'momo' = 100/5)
    expect(total).toEqual({ h: 525, p1: 445, p2: 400 });
    expect(MP_ROUNDS).toBe(5);
  });

  it('ignores duplicate, late, wrong-round, unknown and malformed submissions', async () => {
    const { host, others } = await lobby(2);
    host.s.start(); advance(0);
    const raw = (m: any) => (host.s as any).tp.send(m);
    raw({ t: 'submit', from: 'ghost', i: 0, sub: { kind: 'quiz', pick: 2 } });
    raw({ t: 'submit', from: 'p1', i: 7, sub: { kind: 'quiz', pick: 2 } });
    raw({ t: 'submit', from: 'p1', i: 0, sub: { kind: 'quiz', pick: 'x' } });
    advance(0);
    expect(host.s.v.phase).toBe('round');
    others[0]!.s.submit({ kind: 'quiz', pick: 2 });
    raw({ t: 'submit', from: 'p1', i: 0, sub: { kind: 'quiz', pick: 0 } }); // duplicate, pahilo ginchha
    host.s.submit({ kind: 'quiz', pick: 1 });
    advance(0);
    expect(host.s.v.reveal!.gains.p1).toBe(150);
    others[0]!.s.submit({ kind: 'quiz', pick: 2 }); // reveal ma, ignored
    advance(0);
    expect(host.s.v.reveal!.gains).toMatchObject({ h: 0, p1: 150 });
  });

  it('6th player is rejected (room full) and the others are unaffected', async () => {
    const { host } = await lobby(MAX_PLAYERS);
    const late = mk('late');
    const code = host.s.v.code;
    await late.s.join('late', 'Late', code).catch(() => undefined);
    advance(0);
    expect(late.s.v.phase).toBe('closed');
    expect(late.s.v.error).toMatch(/bhari/);
    expect(host.s.v.players).toHaveLength(MAX_PLAYERS);
    expect(host.s.v.phase).toBe('lobby');
  });

  it('joining after start is rejected; a bad or unknown code fails cleanly', async () => {
    const { host } = await lobby(2);
    host.s.start(); advance(0);
    const late = mk('late');
    await late.s.join('late', 'Late', host.s.v.code).catch(() => undefined);
    advance(0);
    expect(late.s.v.error).toMatch(/suru bhaisakyo/);
    const ghost = mk('g');
    await ghost.s.join('g', 'G', 'ZZZZZ').catch(() => undefined);
    expect(ghost.s.v.error).toMatch(/room chhaina/);
    const bad = mk('b');
    await bad.s.join('b', 'B', 'abc').catch(() => undefined);
    expect(bad.s.v.error).toMatch(/5 akshar/);
  });

  it('a player leaving mid-round does not block the round; their score stays', async () => {
    const { host, others } = await lobby(3);
    host.s.start(); advance(0);
    others[1]!.s.leave();
    advance(0);
    host.s.submit({ kind: 'quiz', pick: 2 });
    others[0]!.s.submit({ kind: 'quiz', pick: 2 });
    advance(0);
    expect(host.s.v.phase).toBe('reveal');
    expect(host.s.v.players.find((p) => p.id === 'p2')!.here).toBe(false);
    expect(host.s.v.players).toHaveLength(3);
  });

  it('players are told when the host leaves; leaving in the lobby removes you', async () => {
    const { host, others } = await lobby(3);
    others[1]!.s.leave(); advance(0);
    expect(host.s.v.players.map((p) => p.id)).toEqual(['h', 'p1']);
    host.s.leave(); advance(0);
    expect(others[0]!.s.v.phase).toBe('closed');
    expect(others[0]!.s.v.error).toMatch(/Host/);
  });
});
