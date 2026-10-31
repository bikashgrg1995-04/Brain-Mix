import { describe, expect, it } from 'vitest';
import { CHAPTERS, autoLevelWord, levelWord } from '../src/game/chapters';
import {
  findDuplicateAnswers,
  parseQuestFile,
  serializeQuests,
  validateQuest,
  type Quest,
  type QuestFile,
} from '../shared/quests';

const word = (over: Record<string, unknown> = {}) => ({ type: 'word', difficulty: 1, answer: 'momo', ...over });
const quiz = (over: Record<string, unknown> = {}) => ({
  type: 'quiz',
  difficulty: 2,
  question: 'Nepal ko rajdhani?',
  options: ['Pokhara', 'Kathmandu', 'Biratnagar', 'Chitwan'],
  correct: 1,
  ...over,
});
const photo = (over: Record<string, unknown> = {}) => ({ type: 'photo', difficulty: 1, emoji: '🥟', answer: 'momo', ...over });

describe('validateQuest', () => {
  it('accepts a good quest of each type', () => {
    expect(validateQuest(word())).toEqual([]);
    expect(validateQuest(quiz())).toEqual([]);
    expect(validateQuest(photo())).toEqual([]);
    expect(validateQuest(photo({ emoji: '🏔️🥾' }))).toEqual([]);
    expect(validateQuest(word({ timer: 45, category: 'Khana', hint: 'Bhapma pakaeko' }))).toEqual([]);
  });

  it('rejects things that are not a quest, and unknown types', () => {
    expect(validateQuest(null)).not.toEqual([]);
    expect(validateQuest('word')).not.toEqual([]);
    expect(validateQuest([])).not.toEqual([]);
    expect(validateQuest({ type: 'video' })).not.toEqual([]);
  });

  it('word answer: a-z only, 4-7 letters', () => {
    for (const bad of ['', 'dal', 'sagarmatha', 'MOMO', 'mo mo', 'mömö', 'पानी', 'momo1']) {
      expect(validateQuest(word({ answer: bad })), bad).not.toEqual([]);
    }
    expect(validateQuest(word({ answer: 'khukuri' }))).toEqual([]); // 7
    expect(validateQuest(word({ answer: 'nepal' }))).toEqual([]);
  });

  it('difficulty 1-4 and timer 10-300 whole seconds', () => {
    for (const d of [0, 5, 2.5, '1', null]) expect(validateQuest(word({ difficulty: d })), String(d)).not.toEqual([]);
    for (const t of [9, 301, 30.5, '60', NaN]) expect(validateQuest(word({ timer: t })), String(t)).not.toEqual([]);
    expect(validateQuest(word({ timer: 10 }))).toEqual([]);
    expect(validateQuest(word({ timer: 300 }))).toEqual([]);
  });

  it('quiz: 4 distinct options, a valid correct index, a question', () => {
    expect(validateQuest(quiz({ question: '  ' }))).not.toEqual([]);
    expect(validateQuest(quiz({ options: ['a', 'b', 'c'] }))).not.toEqual([]);
    expect(validateQuest(quiz({ options: ['a', 'b', 'c', ''] }))).not.toEqual([]);
    expect(validateQuest(quiz({ options: ['a', 'B', 'c', 'b'] }))).not.toEqual([]); // duplicate ignoring case
    for (const c of [-1, 4, 1.5, '1']) expect(validateQuest(quiz({ correct: c })), String(c)).not.toEqual([]);
    expect(validateQuest(quiz({ correct: 0 }))).toEqual([]);
    expect(validateQuest(quiz({ correct: 3 }))).toEqual([]);
  });

  it('photo: 1-3 emoji, no letters, plus a valid answer', () => {
    expect(validateQuest(photo({ emoji: '' }))).not.toEqual([]);
    expect(validateQuest(photo({ emoji: 'momo' }))).not.toEqual([]);
    expect(validateQuest(photo({ emoji: '🥟🥟🥟🥟' }))).not.toEqual([]); // 4
    expect(validateQuest(photo({ emoji: '🥟a' }))).not.toEqual([]);
    expect(validateQuest(photo({ answer: 'dal' }))).not.toEqual([]);
  });
});

describe('quest file', () => {
  const file: QuestFile = {
    version: 1,
    quests: { '12': word({ answer: 'chiya' }) as Quest, '3': quiz() as Quest, '1': photo() as Quest },
  };

  it('serializes sorted by level with a stable field order, and round-trips', () => {
    const text = serializeQuests(file);
    expect(text.endsWith('\n')).toBe(true);
    expect(Object.keys(JSON.parse(text).quests)).toEqual(['1', '3', '12']);
    const back = parseQuestFile(text);
    expect(back.errors).toEqual([]);
    expect(serializeQuests(back.file)).toBe(text);
    expect(Object.keys(JSON.parse(text).quests['12'])).toEqual(['type', 'difficulty', 'answer']);
  });

  it('drops empty optional fields', () => {
    const text = serializeQuests({ version: 1, quests: { '5': word({ category: '', hint: '' }) as Quest } });
    expect(JSON.parse(text).quests['5']).toEqual({ type: 'word', difficulty: 1, answer: 'momo' });
  });

  it('keeps the good quests and reports the bad ones by level', () => {
    const text = JSON.stringify({ version: 1, quests: { '1': word(), '2': word({ answer: 'dal' }), '101': word(), '0': word(), x: word() } });
    const { file: f, errors } = parseQuestFile(text);
    expect(Object.keys(f.quests)).toEqual(['1']);
    expect(errors.some((m) => m.startsWith('Level 2:'))).toBe(true);
    expect(errors.some((m) => m.includes('"101"'))).toBe(true);
    expect(errors.some((m) => m.includes('"0"'))).toBe(true);
    expect(errors.some((m) => m.includes('"x"'))).toBe(true);
  });

  it('survives broken or wrong-shaped files', () => {
    for (const text of ['', '{', 'null', '[]', '{"version":2,"quests":{}}', '{"version":1}', '{"version":1,"quests":[]}']) {
      const r = parseQuestFile(text);
      expect(r.errors.length, text).toBeGreaterThan(0);
      expect(r.file.quests).toEqual({});
    }
  });

  it('finds an answer used on more than one level (word or photo), ignores quizzes', () => {
    const dup = findDuplicateAnswers({
      version: 1,
      quests: { '1': word() as Quest, '4': photo() as Quest, '6': word({ answer: 'chiya' }) as Quest, '7': quiz() as Quest, '8': quiz() as Quest },
    });
    expect([...dup.entries()]).toEqual([['momo', [1, 4]]]);
  });
});

describe('game uses admin quests', () => {
  const quests: QuestFile = {
    version: 1,
    quests: {
      '1': word({ answer: 'khola', difficulty: 3, category: 'Prakriti', hint: 'Pani bagne' }) as Quest,
      '2': quiz() as Quest, // quiz ko game screen abhai chhaina
      '3': word({ answer: 'dhaka' }) as Quest,
    },
  };

  it('a word quest replaces the auto word for that level (key is 1-based, index is 0-based)', () => {
    const w = levelWord(0, quests);
    expect(w).toEqual({ answer: 'khola', difficulty: 3, category: 'Prakriti', hint: 'Pani bagne' });
    expect(levelWord(2, quests).answer).toBe('dhaka');
  });

  it('falls back to the place name when the quest has no category', () => {
    expect(levelWord(2, quests).category).toBe(CHAPTERS[0]!.place);
  });

  it('levels with no quest, and quiz/photo quests, get the auto word', () => {
    expect(levelWord(1, quests)).toEqual(autoLevelWord(1)); // level 2 = quiz
    expect(levelWord(50, quests)).toEqual(autoLevelWord(50));
    expect(levelWord(5, { version: 1, quests: {} })).toEqual(autoLevelWord(5));
  });

  it('the committed quests.json is valid and uses the same format as the admin writes', async () => {
    const raw = (await import('../src/content/quests.json')).default;
    const parsed = parseQuestFile(JSON.stringify(raw));
    expect(parsed.errors).toEqual([]);
    expect(serializeQuests(parsed.file)).toBe(JSON.stringify(raw, null, 2) + '\n');
  });
});
