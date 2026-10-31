import { MAX_LEN, MIN_LEN, type Difficulty } from './types';

/**
 * Admin le set garne quest (level ko sawal). Key = level number (1-100), 1-based:
 * map ma dekhine "Level 1" ra yaha ko "1" ek ho. Phase 2 ma yehi shape Supabase table ma jancha
 * (server ma pani yehi validateQuest chalaune).
 */
export type QuestType = 'word' | 'quiz' | 'photo';

export const QUEST_TYPES: readonly QuestType[] = ['word', 'quiz', 'photo'];
export const QUEST_LABEL: Record<QuestType, string> = {
  word: 'Shabda (word guess)',
  quiz: 'Quiz (MCQ)',
  photo: 'Chitra Shabda (photo + emoji)',
};
/** Timer (second). Quest ma timer chhaina bhane yehi. */
export const DEFAULT_TIMER: Record<QuestType, number> = { word: 60, quiz: 30, photo: 60 };
export const TIMER_MIN = 10;
export const TIMER_MAX = 300;
export const QUIZ_OPTIONS = 4;

interface QuestBase {
  difficulty: Difficulty;
  timer?: number;
}
export interface WordQuest extends QuestBase {
  type: 'word';
  answer: string; // a-z, 4-7 akshar
  category?: string;
  hint?: string;
}
export interface QuizQuest extends QuestBase {
  type: 'quiz';
  question: string;
  options: string[]; // thik 4
  correct: number; // 0-3
  category?: string;
}
export interface PhotoQuest extends QuestBase {
  type: 'photo';
  emoji: string; // 1-3 emoji
  answer: string; // a-z, 4-7 akshar
  hint?: string;
}
export type Quest = WordQuest | QuizQuest | PhotoQuest;

export interface QuestFile {
  version: 1;
  quests: Record<string, Quest>;
}

export const emptyQuestFile = (): QuestFile => ({ version: 1, quests: {} });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const PICTO = /\p{Extended_Pictographic}/gu;

function optText(v: unknown, max: number, label: string, errs: string[]): void {
  if (v === undefined) return;
  if (!isStr(v)) errs.push(`${label} text hunuparchha`);
  else if (v.length > max) errs.push(`${label} ${max} akshar bhanda chhoto hunuparchha`);
}

function checkAnswer(v: unknown, errs: string[]): void {
  if (!isStr(v) || !/^[a-z]+$/.test(v)) errs.push('Answer sano a-z akshar matra hunuparchha (space, number, Devanagari haina)');
  else if (v.length < MIN_LEN || v.length > MAX_LEN) errs.push(`Answer ${MIN_LEN}-${MAX_LEN} akshar ko hunuparchha (${v.length} chha)`);
}

/** Khali list = thik chha. Admin ra game duitai le yehi use garchha. */
export function validateQuest(q: unknown): string[] {
  if (!isObj(q)) return ['Quest object hunuparchha'];
  const type = q.type;
  if (type !== 'word' && type !== 'quiz' && type !== 'photo') return ['Type word, quiz ya photo hunuparchha'];
  const e: string[] = [];

  const d = q.difficulty;
  if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 4) e.push('Difficulty 1-4 hunuparchha');
  const t = q.timer;
  if (t !== undefined && (typeof t !== 'number' || !Number.isInteger(t) || t < TIMER_MIN || t > TIMER_MAX)) {
    e.push(`Timer ${TIMER_MIN}-${TIMER_MAX} second ko poora number hunuparchha`);
  }
  optText(q.category, 40, 'Category', e);
  optText(q.hint, 120, 'Hint', e);

  if (type === 'word' || type === 'photo') checkAnswer(q.answer, e);

  if (type === 'photo') {
    const em = q.emoji;
    if (!isStr(em) || em.trim() === '') e.push('Emoji chahinchha');
    else {
      const n = (em.match(PICTO) ?? []).length;
      if (n < 1 || n > 3) e.push('1 dekhi 3 ota emoji matra halnus');
      if (/[\p{L}\p{N}]/u.test(em)) e.push('Emoji ma akshar ya number nahalnus');
    }
  }

  if (type === 'quiz') {
    if (!isStr(q.question) || q.question.trim() === '') e.push('Prashna chahinchha');
    else if (q.question.length > 200) e.push('Prashna 200 akshar bhanda chhoto hunuparchha');
    const opts = q.options;
    if (!Array.isArray(opts) || opts.length !== QUIZ_OPTIONS) e.push(`Thik ${QUIZ_OPTIONS} ota option chahinchha`);
    else if (opts.some((o) => !isStr(o) || o.trim() === '')) e.push('Sabai option bharnus');
    else if (opts.some((o) => (o as string).length > 80)) e.push('Option 80 akshar bhanda chhoto hunuparchha');
    else if (new Set(opts.map((o) => (o as string).trim().toLowerCase())).size !== opts.length) e.push('Option haru alag-alag hunuparchha');
    const c = q.correct;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c >= QUIZ_OPTIONS) e.push('Sahi option chhannus');
  }
  return e;
}

/** Field ko kram sadhai ek jastai: git diff chhoto ra sajilo. */
export function normalizeQuest(q: Quest): Quest {
  const timer = q.timer !== undefined ? { timer: q.timer } : {};
  const category = 'category' in q && q.category ? { category: q.category } : {};
  const hint = 'hint' in q && q.hint ? { hint: q.hint } : {};
  switch (q.type) {
    case 'word':
      return { type: 'word', difficulty: q.difficulty, ...timer, answer: q.answer, ...category, ...hint };
    case 'photo':
      return { type: 'photo', difficulty: q.difficulty, ...timer, emoji: q.emoji.trim(), answer: q.answer, ...hint };
    case 'quiz':
      return {
        type: 'quiz',
        difficulty: q.difficulty,
        ...timer,
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correct: q.correct,
        ...category,
      };
  }
}

/** Sorted by level, 2-space indent, trailing newline. */
export function serializeQuests(file: QuestFile): string {
  const quests: Record<string, Quest> = {};
  for (const k of Object.keys(file.quests).sort((a, b) => Number(a) - Number(b))) quests[k] = normalizeQuest(file.quests[k]!);
  return JSON.stringify({ version: 1, quests }, null, 2) + '\n';
}

/**
 * JSON text -> QuestFile. Galat quest chhodidinchha (errors ma kun level ma ke galat dekhaucha),
 * baaki thik quest rakhchha. Tesaile ek galat entry le pura game rokdaina.
 */
export function parseQuestFile(text: string, totalLevels = 100): { file: QuestFile; errors: string[] } {
  const file = emptyQuestFile();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { file, errors: ['JSON padhna sakiyena'] };
  }
  if (!isObj(data) || data.version !== 1 || !isObj(data.quests)) {
    return { file, errors: ['File ko format galat chha (version: 1 ra quests chahinchha)'] };
  }
  const errors: string[] = [];
  for (const [key, q] of Object.entries(data.quests)) {
    const level = Number(key);
    if (!Number.isInteger(level) || level < 1 || level > totalLevels || String(level) !== key) {
      errors.push(`Level "${key}": 1-${totalLevels} ko poora number hunuparchha`);
      continue;
    }
    const errs = validateQuest(q);
    if (errs.length) {
      errors.push(...errs.map((m) => `Level ${level}: ${m}`));
      continue;
    }
    file.quests[key] = normalizeQuest(q as Quest);
  }
  return { file, errors };
}

/** Same answer (word ya photo) 2+ level ma: answer -> levels. Quiz ma answer hudaina. */
export function findDuplicateAnswers(file: QuestFile): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  for (const [key, q] of Object.entries(file.quests)) {
    if (q.type === 'quiz') continue;
    const list = seen.get(q.answer) ?? [];
    list.push(Number(key));
    seen.set(q.answer, list);
  }
  for (const [answer, levels] of seen) if (levels.length < 2) seen.delete(answer);
  return seen;
}
