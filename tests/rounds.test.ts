import { describe, expect, it } from 'vitest';
import { validateQuest, type Quest, type QuestFile } from '../shared/quests';
import { RUSH_WORDS } from '../shared/score';
import { PHOTO_BANK, QUIZ_BANK } from '../src/game/bank';
import { CHAPTERS, TOTAL_LEVELS } from '../src/game/chapters';
import { difficultyFor, pickRound, type Rng } from '../src/game/rounds';

const none: QuestFile = { version: 1, quests: {} };
const seeded = (seed: number): Rng => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe('banks', () => {
  it('every bank entry passes the same validator the admin uses', () => {
    for (const q of QUIZ_BANK) expect(validateQuest({ type: 'quiz', difficulty: q.difficulty, question: q.question, options: q.options, correct: q.correct }), q.question).toEqual([]);
    for (const p of PHOTO_BANK) expect(validateQuest({ type: 'photo', difficulty: p.difficulty, emoji: p.emoji, answer: p.answer }), p.answer).toEqual([]);
  });
  it('has enough of each difficulty so a replay can avoid the last item', () => {
    for (const d of [1, 2, 3, 4]) {
      expect(QUIZ_BANK.filter((q) => q.difficulty === d).length).toBeGreaterThanOrEqual(3);
      expect(PHOTO_BANK.filter((q) => q.difficulty === d).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('pickRound', () => {
  it('all four kinds appear across levels', () => {
    const rng = seeded(7);
    const kinds = new Set(Array.from({ length: 400 }, (_, i) => pickRound(i % TOTAL_LEVELS, rng, none).kind));
    expect([...kinds].sort()).toEqual(['grid', 'photo', 'quiz', 'rush']);
  });

  it('difficulty stays inside the place band, for every level and kind', () => {
    const rng = seeded(3);
    for (let l = 0; l < TOTAL_LEVELS; l++) {
      const band = CHAPTERS[Math.floor(l / 10)]!.band;
      for (let k = 0; k < 12; k++) {
        const r = pickRound(l, rng, none);
        expect(band, `level ${l + 1} ${r.kind}`).toContain(difficultyFor(l));
        if (r.kind !== 'rush') expect(r.difficulty, `level ${l + 1} ${r.kind}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('quiz: options stay 4 and "correct" still points at the right text after shuffling', () => {
    const rng = seeded(11);
    let seen = 0;
    for (let i = 0; i < 300; i++) {
      const r = pickRound(i % TOTAL_LEVELS, rng, none);
      if (r.kind !== 'quiz') continue;
      seen++;
      const src = QUIZ_BANK.find((q) => q.question === r.question)!;
      expect(r.options).toHaveLength(4);
      expect(r.options[r.correct]).toBe(src.options[src.correct]);
      expect(new Set(r.options).size).toBe(4);
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('rush: 5 distinct words with timer', () => {
    const rng = seeded(5);
    let seen = 0;
    for (let i = 0; i < 300; i++) {
      const r = pickRound(i % TOTAL_LEVELS, rng, none);
      if (r.kind !== 'rush') continue;
      seen++;
      expect(r.words).toHaveLength(RUSH_WORDS);
      expect(new Set(r.words.map((w) => w.answer)).size).toBe(RUSH_WORDS);
      expect(r.timer).toBeGreaterThan(0);
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('retry does not repeat the previous item', () => {
    for (let s = 1; s <= 60; s++) {
      const first = pickRound(45, seeded(s), none);
      if (first.kind === 'rush') continue;
      const second = pickRound(45, seeded(s), none, first.id);
      if (second.kind === first.kind) expect(second.id).not.toBe(first.id);
    }
  });

  it('admin quest always wins, with its own timer or the default', () => {
    const quests: QuestFile = {
      version: 1,
      quests: {
        '3': { type: 'quiz', difficulty: 2, question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 2, timer: 20 } as Quest,
        '4': { type: 'photo', difficulty: 1, emoji: '🥟', answer: 'momo' } as Quest,
        '5': { type: 'word', difficulty: 1, answer: 'khola', category: 'Prakriti' } as Quest,
      },
    };
    for (let s = 1; s <= 20; s++) {
      const q = pickRound(2, seeded(s), quests);
      expect(q).toMatchObject({ kind: 'quiz', admin: true, timer: 20, correct: 2, options: ['a', 'b', 'c', 'd'] });
      expect(pickRound(3, seeded(s), quests)).toMatchObject({ kind: 'photo', admin: true, timer: 60, answer: 'momo' });
      expect(pickRound(4, seeded(s), quests)).toMatchObject({ kind: 'grid', admin: true, timer: 60, word: { answer: 'khola', category: 'Prakriti' } });
    }
  });
});
