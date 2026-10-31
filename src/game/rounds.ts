import { DEFAULT_TIMER, type QuestFile } from '../../shared/quests';
import { RUSH_WORDS } from '../../shared/score';
import type { Difficulty, WordEntry } from '../../shared/types';
import { PHOTO_BANK, QUIZ_BANK } from './bank';
import { CHAPTERS, LEVELS_PER_CHAPTER, chapterOf } from './chapters';
import { QUESTS } from './quests';
import { WORDS } from './words';

/** Ek level ko round. Admin le quest set gareko bhaye tyahi, natra random type + bank bata. */
export type RoundKind = 'grid' | 'quiz' | 'photo' | 'rush';

export type Round =
  | { kind: 'grid'; id: string; admin: boolean; difficulty: Difficulty; timer: number; word: WordEntry }
  | { kind: 'quiz'; id: string; admin: boolean; difficulty: Difficulty; timer: number; category: string; question: string; options: string[]; correct: number }
  | { kind: 'photo'; id: string; admin: boolean; difficulty: Difficulty; timer: number; emoji: string; answer: string; category: string; hint?: string }
  | { kind: 'rush'; id: string; admin: boolean; difficulty: Difficulty; timer: number; words: WordEntry[] };

export const RUSH_TIMER = 90;
/** Random type ko tauli. */
export const KIND_WEIGHTS: Record<RoundKind, number> = { grid: 4, quiz: 2, photo: 2, rush: 2 };

export type Rng = () => number;

/** Level ko difficulty: place ko band bhitra, level badhdai badhne. */
export function difficultyFor(level: number): Difficulty {
  const band = CHAPTERS[chapterOf(level)]!.band;
  const pos = level % LEVELS_PER_CHAPTER;
  return band[Math.min(band.length - 1, Math.floor((pos / LEVELS_PER_CHAPTER) * band.length))]!;
}

const rand = (n: number, rng: Rng): number => Math.min(n - 1, Math.floor(rng() * n));

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1, rng);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Tyo difficulty ko item; chhaina bhane sabai bhanda najik difficulty ko. `avoid` = aghilo id (dohoriyos bhane). */
function pool<T extends { difficulty: Difficulty }>(items: readonly T[], d: Difficulty, id: (t: T) => string, avoid?: string): T[] {
  for (let off = 0; off <= 3; off++) {
    for (const dd of off === 0 ? [d] : [d - off, d + off]) {
      const hit = items.filter((t) => t.difficulty === dd && id(t) !== avoid);
      if (hit.length) return hit;
    }
  }
  return [...items];
}

function pickKind(rng: Rng): RoundKind {
  const kinds = Object.keys(KIND_WEIGHTS) as RoundKind[];
  const total = kinds.reduce((s, k) => s + KIND_WEIGHTS[k], 0);
  let r = rng() * total;
  for (const k of kinds) {
    r -= KIND_WEIGHTS[k];
    if (r < 0) return k;
  }
  return 'grid';
}

function adminRound(level: number, quests: QuestFile): Round | null {
  const q = quests.quests[String(level + 1)];
  if (!q) return null;
  const id = `admin:${level + 1}`;
  const place = CHAPTERS[chapterOf(level)]!.place;
  if (q.type === 'word') {
    const word: WordEntry = { answer: q.answer, difficulty: q.difficulty, category: q.category || place, hint: q.hint };
    return { kind: 'grid', id, admin: true, difficulty: q.difficulty, timer: q.timer ?? DEFAULT_TIMER.word, word };
  }
  if (q.type === 'quiz') {
    return { kind: 'quiz', id, admin: true, difficulty: q.difficulty, timer: q.timer ?? DEFAULT_TIMER.quiz, category: q.category || place, question: q.question, options: q.options, correct: q.correct };
  }
  return { kind: 'photo', id, admin: true, difficulty: q.difficulty, timer: q.timer ?? DEFAULT_TIMER.photo, emoji: q.emoji, answer: q.answer, category: place, hint: q.hint };
}

/**
 * Level (0-based) ko round. Admin quest bhaye tyahi (sadhai same). Natra random: type tauli anusar,
 * item level ko difficulty anusar. `avoid` = "Feri khel" ma aghilo jastai nadine.
 */
export function pickRound(level: number, rng: Rng = Math.random, quests: QuestFile = QUESTS, avoid?: string): Round {
  const fixed = adminRound(level, quests);
  if (fixed) return fixed;
  const d = difficultyFor(level);
  const kind = pickKind(rng);
  if (kind === 'quiz') {
    const q = pool(QUIZ_BANK, d, (t) => t.question, avoid);
    const item = q[rand(q.length, rng)]!;
    const order = shuffle([0, 1, 2, 3], rng);
    return {
      kind, id: item.question, admin: false, difficulty: item.difficulty, timer: DEFAULT_TIMER.quiz, category: item.category,
      question: item.question, options: order.map((i) => item.options[i]!), correct: order.indexOf(item.correct),
    };
  }
  if (kind === 'photo') {
    const p = pool(PHOTO_BANK, d, (t) => t.answer, avoid);
    const item = p[rand(p.length, rng)]!;
    return { kind, id: item.answer, admin: false, difficulty: item.difficulty, timer: DEFAULT_TIMER.photo, emoji: item.emoji, answer: item.answer, category: CHAPTERS[chapterOf(level)]!.place, hint: item.hint };
  }
  if (kind === 'rush') {
    // 5 alag shabda: tyo difficulty ko, kam bhaye najik difficulty bata.
    let words = shuffle(pool(WORDS, d, (w) => w.answer), rng);
    for (let off = 1; words.length < RUSH_WORDS && off <= 3; off++) {
      const more = WORDS.filter((w) => (w.difficulty === d - off || w.difficulty === d + off) && !words.includes(w));
      words = [...words, ...shuffle(more, rng)];
    }
    return { kind, id: 'rush', admin: false, difficulty: d, timer: RUSH_TIMER, words: words.slice(0, RUSH_WORDS) };
  }
  const g = pool(WORDS, d, (w) => w.answer, avoid);
  const word = g[rand(g.length, rng)]!;
  return { kind: 'grid', id: word.answer, admin: false, difficulty: word.difficulty, timer: DEFAULT_TIMER.word, word };
}
