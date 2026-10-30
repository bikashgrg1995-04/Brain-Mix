import type { Difficulty, WordEntry } from '../../shared/types';
import { WORDS } from './words';

export type IconKey = 'stupa' | 'pagoda' | 'temple' | 'rhino' | 'lotus' | 'lake' | 'khukuri' | 'mountain' | 'flags' | 'peak';

export interface Chapter {
  place: string;
  sub: string; // landmark · khana/sanskriti. DRAFT: tapai le verify garnus
  icon: IconKey;
  tint: string;
  band: Difficulty[]; // difficulty band (length haina)
  hint: 'full' | 'category' | 'none'; // ch 1-3 full, 4-6 category, 7-10 none
}

export const CHAPTERS: Chapter[] = [
  { place: 'Kathmandu', sub: 'Swayambhunath · Momo', icon: 'stupa', tint: '#d9a21f', band: [1, 2], hint: 'full' },
  { place: 'Bhaktapur', sub: 'Nyatapola · Juju dhau', icon: 'pagoda', tint: '#b8322a', band: [1, 2], hint: 'full' },
  { place: 'Patan', sub: 'Krishna Mandir · Yomari', icon: 'temple', tint: '#c9772b', band: [1, 2], hint: 'full' },
  { place: 'Chitwan', sub: 'Gaida · Tharu khana', icon: 'rhino', tint: '#2f8f5b', band: [2, 3], hint: 'category' },
  { place: 'Lumbini', sub: 'Buddha ko janmathau · Shanti', icon: 'lotus', tint: '#d0709a', band: [2, 3], hint: 'category' },
  { place: 'Pokhara', sub: 'Phewa Tal · Machha', icon: 'lake', tint: '#2c6fb7', band: [2, 3], hint: 'category' },
  { place: 'Gorkha', sub: 'Gorkha Durbar · Khukuri', icon: 'khukuri', tint: '#7a5c3a', band: [3, 4], hint: 'none' },
  { place: 'Mustang', sub: 'Muktinath · Thakali khana', icon: 'mountain', tint: '#b07a4a', band: [3, 4], hint: 'none' },
  { place: 'Namche', sub: 'Sherpa gaun · Thukpa', icon: 'flags', tint: '#6a5fb0', band: [3, 4], hint: 'none' },
  { place: 'Everest Base Camp', sub: 'Sagarmatha · Himal', icon: 'peak', tint: '#5d7fa3', band: [3, 4], hint: 'none' },
];

export const LEVELS_PER_CHAPTER = 10;
export const TOTAL_LEVELS = CHAPTERS.length * LEVELS_PER_CHAPTER;
export const chapterOf = (level: number): number => Math.floor(level / LEVELS_PER_CHAPTER);

/** Deterministic: same level, same word. TEMP: sample 20 words le dherai repeat hunchha. */
export function levelWord(level: number): WordEntry {
  const ch = CHAPTERS[chapterOf(level)]!;
  const pool = WORDS.filter((w) => ch.band.includes(w.difficulty));
  return pool[level % pool.length] ?? WORDS[0]!;
}

export const starsFor = (tries: number): 1 | 2 | 3 => (tries <= 2 ? 3 : tries <= 4 ? 2 : 1);
