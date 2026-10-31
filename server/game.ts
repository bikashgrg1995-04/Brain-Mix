import { type Kind } from '../shared/achievements';
import { START_COINS, TIME_COST, hintCost, roundCoins } from '../shared/powerups';
import { roundXp } from '../shared/score';
import type { Difficulty } from '../shared/types';
import { xpFor } from '../shared/xp';
import { CHAPTERS, TOTAL_LEVELS, chapterOf, starsFor } from '../src/game/chapters';
import { difficultyFor } from '../src/game/rounds';
import { nepalDay, recordDaily, type Profile } from '../src/state/profile';
import { awardBadges, claimReward, recordMultiplayer, recordPowerup, recordWin } from '../src/state/progress';
import { emptyStats } from '../shared/achievements';

/**
 * Server (Supabase Edge Function) ko khel ko niyam. Coin, XP, badge, daily inam sabai yaha ma hisab huncha:
 * client le "kati coin paye" bhandaina, "kun level jite" matra bhancha. Edge function (supabase/functions/game)
 * le yehi bundle garera chalaunchha; test yaha in-memory store sanga.
 *
 * Sima (honest): jawaf client ma chha, tesaile "jite" bhanne dabi server le pakka verify garna sakdaina. Roka gareko:
 * unlock krama (level skip nahune), star badhne matra, tez-gati (rate limit), ra hisab sabai server ma.
 * Pakka upaya: round ra jawaf pani server le dine (arko phase).
 */

export type Action =
  | { a: 'sync'; local?: unknown }
  | { a: 'complete'; level: number; kind: Kind; stars?: number; tries?: number }
  | { a: 'spend'; item: 'hint' | 'fifty' | 'time'; level: number; difficulty?: number }
  | { a: 'daily' }
  | { a: 'dailyWord'; tries: number; won: boolean }
  | { a: 'mp'; won: boolean };

export interface ServerProfile extends Profile {
  meta: { last: Record<string, number> }; // action -> aghilo samay (ms), rate limit ko lagi
}

export interface Store {
  load(id: string): Promise<{ profile: ServerProfile; version: number } | null>;
  /** version === null: naya row. Natra tyo version bhaye matra update. false = kasai le badlyo (feri try). */
  save(id: string, profile: ServerProfile, version: number | null): Promise<boolean>;
}

export type Err = 'bad_request' | 'not_unlocked' | 'too_fast' | 'no_coins' | 'already' | 'busy';
export interface Gained { xp: number; coins: number; badges: string[] }
export type Result =
  | { ok: true; profile: ServerProfile; gained: Gained }
  | { ok: false; error: Err; profile?: ServerProfile };

export const MIN_GAP_MS: Record<string, number> = { complete: 2000, mp: 60_000, spend: 150 };
export const IMPORT_CAPS = { xp: 5000, coins: 500 };
const KINDS: Kind[] = ['grid', 'quiz', 'photo', 'rush'];

export function newProfile(): ServerProfile {
  return { xp: 0, coins: START_COINS, streak: 0, lastWin: '', levels: {}, stats: emptyStats(), badges: {}, meta: { last: {} } };
}

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Sabai bhanda tallo level jun abhai jitieko chhaina (map ma "cur"). */
export function nextLevel(levels: Record<string, number>): number {
  let i = 0;
  while (i < TOTAL_LEVELS && (levels[String(i)] ?? 0) > 0) i++;
  return i;
}

/** Local profile bata ek patak matra, sima sahit. Sirf level/star, xp, coin (cap). Badge/inam server le afai. */
export function importLocal(raw: unknown): Partial<ServerProfile> {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const levels: Record<string, number> = {};
  if (typeof r.levels === 'object' && r.levels !== null) {
    for (const [k, v] of Object.entries(r.levels as Record<string, unknown>)) {
      if (isInt(Number(k), 0, TOTAL_LEVELS - 1) && isInt(v, 1, 3)) levels[String(Number(k))] = v;
    }
  }
  const xp = isInt(r.xp, 0, 10_000_000) ? Math.min(r.xp, IMPORT_CAPS.xp) : 0;
  const coins = isInt(r.coins, 0, 10_000_000) ? Math.min(r.coins, IMPORT_CAPS.coins) : START_COINS;
  return { levels, xp, coins };
}

function fix(raw: ServerProfile): ServerProfile {
  const base = newProfile();
  return {
    ...base, ...raw,
    stats: { ...base.stats, ...raw.stats, wins: { ...base.stats.wins, ...raw.stats?.wins } },
    badges: { ...raw.badges }, levels: { ...raw.levels }, meta: { last: { ...raw.meta?.last } },
  };
}

function gap(p: ServerProfile, key: string, now: number): boolean {
  const min = MIN_GAP_MS[key];
  return !min || now - (p.meta.last[key] ?? 0) >= min;
}

function apply(p: ServerProfile, act: Action, now: number): Err | Gained {
  const today = nepalDay(0, now).key;
  const before = { xp: p.xp, coins: p.coins };
  const done = (badges: string[] = []): Gained => ({ xp: p.xp - before.xp, coins: p.coins - before.coins, badges });
  const award = (): string[] => awardBadges(p, today).map((b) => b.id);

  switch (act.a) {
    case 'sync':
      return done(award());

    case 'complete': {
      if (!isInt(act.level, 0, TOTAL_LEVELS - 1) || !KINDS.includes(act.kind)) return 'bad_request';
      if (act.kind === 'grid' ? !isInt(act.tries, 1, 6) : !isInt(act.stars, 1, 3)) return 'bad_request';
      if (act.level > nextLevel(p.levels)) return 'not_unlocked';
      if (!gap(p, 'complete', now)) return 'too_fast';
      p.meta.last.complete = now;
      const first = (p.levels[String(act.level)] ?? 0) === 0;
      const d = difficultyFor(act.level);
      const grid = act.kind === 'grid';
      const stars = (grid ? starsFor(act.tries!) : act.stars!) as 1 | 2 | 3;
      p.xp += grid ? (first ? xpFor(act.tries!, d) : 0) : roundXp(stars, d, first);
      p.coins += roundCoins(stars, first);
      p.levels[String(act.level)] = Math.max(p.levels[String(act.level)] ?? 0, stars);
      recordWin(p, act.kind, stars);
      return done(award());
    }

    case 'spend': {
      if (!isInt(act.level, 0, TOTAL_LEVELS - 1) || !['hint', 'fifty', 'time'].includes(act.item)) return 'bad_request';
      if (!gap(p, 'spend', now)) return 'too_fast';
      // Difficulty client le pathaucha, tara thau ko band bhitra matra (sasto gardina)
      const band = CHAPTERS[chapterOf(act.level)]!.band;
      const claimed = isInt(act.difficulty, 1, 4) ? act.difficulty : band[0]!;
      const d = Math.min(Math.max(...band), Math.max(Math.min(...band), claimed)) as Difficulty;
      const cost = act.item === 'time' ? TIME_COST : hintCost(d);
      if (p.coins < cost) return 'no_coins';
      p.coins -= cost;
      p.meta.last.spend = now;
      recordPowerup(p);
      return done(award());
    }

    case 'daily': {
      if (!claimReward(p, now)) return 'already';
      return done(award());
    }

    case 'dailyWord': {
      if (!isInt(act.tries, 1, 6) || typeof act.won !== 'boolean') return 'bad_request';
      if (p.daily?.date === today) return 'already'; // aaja ko ek patak matra
      recordDaily(p, act.tries, act.won, now);
      return done(award());
    }

    case 'mp': {
      if (typeof act.won !== 'boolean') return 'bad_request';
      if (!gap(p, 'mp', now)) return 'too_fast';
      p.meta.last.mp = now;
      recordMultiplayer(p, act.won);
      return done(award());
    }

    default:
      return 'bad_request'; // chinina bhane kehi gardaina
  }
}

/** Ek request. Store ma kasai le badlyo bhane (version) 3 patak samma feri. */
export async function handle(store: Store, id: string, act: Action, now: number): Promise<Result> {
  if (typeof act !== 'object' || act === null || typeof (act as { a?: unknown }).a !== 'string') return { ok: false, error: 'bad_request' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await store.load(id);
    const p = row ? fix(row.profile) : newProfile();
    if (!row && act.a === 'sync') Object.assign(p, importLocal(act.local));
    const r = apply(p, act, now);
    if (typeof r === 'string') return { ok: false, error: r, profile: row ? p : undefined };
    if (await store.save(id, p, row ? row.version : null)) return { ok: true, profile: p, gained: r };
  }
  return { ok: false, error: 'busy' };
}
