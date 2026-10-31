import { normalizeExact } from './normalize';
import { RUSH_WORDS, wordPoints } from './score';

/**
 * Online multiplayer (2-5 jana). Host-authoritative: host le round banaucha, jawaf (answer) kasai lai pathaudaina,
 * sabai ko submission host le score garchha. Phase 2 ma yehi protocol server (Edge Function) ma sarna sakinchha.
 */
export const MAX_PLAYERS = 5;
export const MIN_PLAYERS = 2;
export const MP_ROUNDS = 5;
export const REVEAL_MS = 6000; // round pachhi scoreboard dekhine samay
export const GRACE_MS = 2000; // client ko timer sakiyepachhi submission pugna dine samay
export const NAME_MAX = 12;
export const MAX_BONUS = 50;

/** Room code: 5 akshar, 0/O/1/I jastai mikne akshar chhadera. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;

export function makeCode(rng: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.floor(rng() * CODE_ALPHABET.length))];
  return s;
}

/** User le lekheko code (space, lowercase, "o" -> "0" jasto galti) thik pardai. Galat bhaye null. */
export function normalizeCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === CODE_LEN && [...c].every((ch) => CODE_ALPHABET.includes(ch)) ? c : null;
}

export function cleanName(input: string): string {
  return input.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

// ---------- rounds ----------
export type SecretRound =
  | { kind: 'quiz'; question: string; options: string[]; correct: number; category: string; timer: number }
  | { kind: 'photo'; emoji: string; answer: string; category: string; hint?: string; timer: number }
  | { kind: 'rush'; words: { answer: string; category: string; hint?: string }[]; timer: number };

/** Kheladdi lai pathaune version: jawaf chhaina, length matra. */
export type PublicRound =
  | { kind: 'quiz'; question: string; options: string[]; category: string }
  | { kind: 'photo'; emoji: string; len: number; category: string; hint?: string }
  | { kind: 'rush'; words: { len: number; category: string; hint?: string }[] };

export function toPublic(r: SecretRound): PublicRound {
  if (r.kind === 'quiz') return { kind: 'quiz', question: r.question, options: [...r.options], category: r.category };
  if (r.kind === 'photo') return { kind: 'photo', emoji: r.emoji, len: r.answer.length, category: r.category, hint: r.hint };
  return { kind: 'rush', words: r.words.map((w) => ({ len: w.answer.length, category: w.category, hint: w.hint })) };
}

/** Round khatam bhaepachhi dekhaune sahi jawaf. */
export function revealText(r: SecretRound): string {
  if (r.kind === 'quiz') return r.options[r.correct] ?? '';
  if (r.kind === 'photo') return r.answer;
  return r.words.map((w) => w.answer).join(', ');
}

export type Submission =
  | { kind: 'quiz'; pick: number }
  | { kind: 'photo'; guess: string }
  | { kind: 'rush'; guesses: string[] };

/** Untrusted network input ko shape check. */
export function isSubmission(v: unknown): v is Submission {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  if (s.kind === 'quiz') return typeof s.pick === 'number';
  if (s.kind === 'photo') return typeof s.guess === 'string' && s.guess.length <= 40;
  if (s.kind === 'rush') return Array.isArray(s.guesses) && s.guesses.length <= RUSH_WORDS && s.guesses.every((g) => typeof g === 'string' && g.length <= 40);
  return false;
}

/**
 * Ek round ko point (0-150). Sahi/pura-sahi bhaye 100 + chhito bhaye bonus (<= 50).
 * Photo: pura sahi nabhaye placement anusar (<= 99), bonus chhaina. Rush: 5 shabda ko placement ko ausat, bonus chhaina.
 * `usedMs` = round suru bhayeko dekhi submission aayeko samay (host ko ghadi).
 */
export function scoreSubmission(r: SecretRound, sub: Submission | undefined, usedMs: number): number {
  if (!sub || sub.kind !== r.kind) return 0;
  const left = Math.max(0, Math.min(1, 1 - usedMs / (r.timer * 1000)));
  const bonus = Math.round(MAX_BONUS * left);
  if (r.kind === 'quiz' && sub.kind === 'quiz') return sub.pick === r.correct ? 100 + bonus : 0;
  if (r.kind === 'photo' && sub.kind === 'photo') {
    const g = normalizeExact(sub.guess);
    const p = wordPoints(g, r.answer);
    return p === 100 ? 100 + bonus : p;
  }
  if (r.kind === 'rush' && sub.kind === 'rush') {
    let sum = 0;
    r.words.forEach((w, i) => { sum += wordPoints(normalizeExact(sub.guesses[i] ?? ''), w.answer); });
    return Math.round(sum / r.words.length);
  }
  return 0;
}

// ---------- ranking ----------
export interface Standing { id: string; name: string; score: number; rank: number }

/** Score anusar ranking; barabar bhaye same rank (1,1,3). */
export function rankPlayers(players: { id: string; name: string; score: number }[]): Standing[] {
  const sorted = [...players].sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
  const out: Standing[] = [];
  sorted.forEach((p, i) => out.push({ ...p, rank: i > 0 && sorted[i - 1]!.score === p.score ? out[i - 1]!.rank : i + 1 }));
  return out;
}

// ---------- messages ----------
export interface PlayerInfo { id: string; name: string; score: number; here: boolean }

export type Msg =
  // host -> sabai
  | { t: 'lobby'; host: string; players: PlayerInfo[]; started: boolean }
  | { t: 'reject'; id: string; why: 'full' | 'started' }
  | { t: 'round'; i: number; total: number; duration: number; view: PublicRound }
  | { t: 'reveal'; i: number; answer: string; gains: Record<string, number>; players: PlayerInfo[]; last: boolean }
  | { t: 'final'; players: PlayerInfo[] }
  // player -> host
  | { t: 'submit'; from: string; i: number; sub: Submission };

export interface Peer { id: string; name: string; host: boolean; at: number }

export const MSG_TYPES = ['lobby', 'reject', 'round', 'reveal', 'final', 'submit'] as const;
export const isMsg = (v: unknown): v is Msg =>
  typeof v === 'object' && v !== null && (MSG_TYPES as readonly string[]).includes((v as { t?: string }).t ?? '');
