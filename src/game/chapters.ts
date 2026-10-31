import type { SoundMix } from '../audio/ambience';
import type { QuestFile } from '../../shared/quests';
import { DIFFICULTY, type Difficulty, type WordEntry } from '../../shared/types';
import { QUESTS } from './quests';
import type { Palette, SceneParams } from './scenery';
import { WORDS } from './words';

export type IconKey = 'stupa' | 'pagoda' | 'temple' | 'rhino' | 'lotus' | 'lake' | 'khukuri' | 'mountain' | 'flags' | 'peak' | 'paddy';

/** Thau anusar badlinne theme: UI accent + painted background (scenery.ts). */
export interface Theme {
  accent: string; // light mode: safed text accent ma 4.5:1 chahinchha (tests/chapters.test.ts le check garchha)
  accentDark: string; // dark mode: dark ink (#14202b) accent ma 4.5:1 chahinchha
  palette: Palette;
  scene: SceneParams;
}

export interface Chapter {
  place: string;
  sub: string; // landmark · khana/sanskriti. DRAFT: tapai le verify garnus
  altitude: number; // metre. Sabai bhanda tallo -> sabai bhanda mathi. DRAFT: Gorkha ra Chitwan ko approx, verify garnus
  icon: IconKey;
  band: Difficulty[]; // difficulty band: thau ma mathi jaada kathin huncha (length haina)
  hint: 'full' | 'category' | 'none'; // ch 1-3 full, 4-6 category, 7-10 none
  theme: Theme;
  sound: SoundMix; // thau ko awaj (hawa, nadi, charaa, ghanta, bazaar): audio/ambience.ts
}

/**
 * Level 1 = Nepal ko sabai bhanda tallo thau, Level 100 = sabai bhanda mathi (Sagarmatha).
 * "Sabai bhanda tallo" ko record bivadit chha: Kechana Kawal (Jhapa, 70 m) purano record ho;
 * 2017 ko survey le Mukhiyapatti Musharniya (Dhanusha, 59 m) lai tallo bhanyo. Badlinu parya yehi ek line.
 */
export const CHAPTERS: Chapter[] = [
  {
    place: 'Mukhiyapatti', sub: 'Dhanusha · Nepal ko sabai bhanda tallo thau', altitude: 59, icon: 'paddy', band: [1], hint: 'full',
    sound: { wind: 0.2, river: 0.25, birds: 0.6, bell: 0, city: 0 },
    theme: {
      accent: '#2f7a2f', accentDark: '#7bd05a',
      palette: { skyTop: '#4f7fbf', skyBottom: '#ffdca2', sun: '#fff2c6', far: '#93a9c4', snow: '#eef3fa', mid: '#8ab55a', near: '#6aa341', ground: '#437a2e', fog: '#ffe6b8' },
      scene: { kind: 'paddy', farAmp: 60, snow: 0, clouds: 0.3, stars: 0, sun: { x: 0.3, y: 0.42, r: 38 }, mist: 0.6 },
    },
  },
  {
    place: 'Janakpur', sub: 'Janaki Mandir · Mithila kala', altitude: 74, icon: 'temple', band: [1, 2], hint: 'full',
    sound: { wind: 0.1, river: 0, birds: 0.35, bell: 0.5, city: 0.5 },
    theme: {
      accent: '#ad4e18', accentDark: '#ffa05c',
      palette: { skyTop: '#6b6cae', skyBottom: '#ffc7a0', sun: '#ffe4bc', far: '#9aa3c0', snow: '#f3f3fa', mid: '#8ea86a', near: '#628c4a', ground: '#405f33', fog: '#ffd9b8' },
      scene: { kind: 'janakpur', farAmp: 50, snow: 0, clouds: 0.35, stars: 0.1, sun: { x: 0.75, y: 0.43, r: 34 }, mist: 0.55 },
    },
  },
  {
    place: 'Lumbini', sub: 'Buddha ko janmathau · Shanti', altitude: 150, icon: 'lotus', band: [1, 2], hint: 'full',
    sound: { wind: 0.2, river: 0, birds: 0.5, bell: 0.6, city: 0 },
    theme: {
      accent: '#b03a74', accentDark: '#f08cbc',
      palette: { skyTop: '#5f9bd6', skyBottom: '#f0ead2', sun: '#fffbe6', far: '#9ab8c8', snow: '#f4f8fb', mid: '#8cbb70', near: '#63a056', ground: '#3f7a40', fog: '#f1f1da' },
      scene: { kind: 'lumbini', farAmp: 40, snow: 0, clouds: 0.4, stars: 0, sun: { x: 0.24, y: 0.3, r: 30 }, mist: 0.6 },
    },
  },
  {
    place: 'Chitwan', sub: 'Gaida · Tharu khana', altitude: 200, icon: 'rhino', band: [2], hint: 'category',
    sound: { wind: 0.15, river: 0.6, birds: 0.8, bell: 0, city: 0 },
    theme: {
      accent: '#1f7a55', accentDark: '#5fd7a0',
      palette: { skyTop: '#5b9aa8', skyBottom: '#eedcaa', sun: '#fff0c0', far: '#6f9a8c', snow: '#e8f0ee', mid: '#3f7d4c', near: '#2e6a3b', ground: '#1f4a2c', fog: '#dff0d6' },
      scene: { kind: 'jungle', farAmp: 120, snow: 0, clouds: 0.25, stars: 0, sun: { x: 0.62, y: 0.3, r: 30 }, mist: 0.8 },
    },
  },
  {
    place: 'Pokhara', sub: 'Phewa Tal · Machha', altitude: 822, icon: 'lake', band: [2, 3], hint: 'category',
    sound: { wind: 0.3, river: 0.4, birds: 0.4, bell: 0.2, city: 0.2 },
    theme: {
      accent: '#1f62b0', accentDark: '#6fb2ff',
      palette: { skyTop: '#2d6dc0', skyBottom: '#d3e6f6', sun: '#ffffff', far: '#6f90b5', snow: '#f7fbff', mid: '#5f9a58', near: '#3f8048', ground: '#2c5f36', fog: '#d6e8f4' },
      scene: { kind: 'lake', farAmp: 300, snow: 0.55, clouds: 0.35, stars: 0, sun: { x: 0.82, y: 0.2, r: 26 }, mist: 0.3 },
    },
  },
  {
    place: 'Gorkha', sub: 'Gorkha Durbar · Khukuri', altitude: 1100, icon: 'khukuri', band: [2, 3], hint: 'category',
    sound: { wind: 0.45, river: 0, birds: 0.3, bell: 0.4, city: 0 },
    theme: {
      accent: '#a8452a', accentDark: '#ee9a7a',
      palette: { skyTop: '#4a86c8', skyBottom: '#f2dfba', sun: '#fff3d0', far: '#7c93b4', snow: '#f6f8fc', mid: '#a3ac5c', near: '#738f40', ground: '#4b6a30', fog: '#efdab6' },
      scene: { kind: 'fort', farAmp: 290, snow: 0.5, clouds: 0.3, stars: 0, sun: { x: 0.22, y: 0.3, r: 30 }, mist: 0.45 },
    },
  },
  {
    place: 'Kathmandu', sub: 'Swayambhunath · Momo', altitude: 1400, icon: 'stupa', band: [3], hint: 'none',
    sound: { wind: 0.2, river: 0, birds: 0.25, bell: 0.5, city: 0.6 },
    theme: {
      accent: '#b8322a', accentDark: '#ea6a5e',
      palette: { skyTop: '#5b8fd0', skyBottom: '#f6d9a8', sun: '#fff3c4', far: '#7b93b8', snow: '#f3f6fb', mid: '#4f7a4a', near: '#3d6a3a', ground: '#2f4f2d', fog: '#f3dcb0' },
      scene: { kind: 'city', farAmp: 190, snow: 0.35, clouds: 0.25, stars: 0, sun: { x: 0.74, y: 0.4, r: 34 }, mist: 0.5 },
    },
  },
  {
    place: 'Namche', sub: 'Sherpa gaun · Thukpa', altitude: 3440, icon: 'flags', band: [3, 4], hint: 'none',
    sound: { wind: 0.6, river: 0.3, birds: 0.05, bell: 0.2, city: 0.1 },
    theme: {
      accent: '#6a4fb0', accentDark: '#b49cff',
      palette: { skyTop: '#1f6fd0', skyBottom: '#a9d3f2', sun: '#fffbe6', far: '#5b7fa6', snow: '#f8fbff', mid: '#8a8a5a', near: '#6f7a45', ground: '#4f5a35', fog: '#bcd9ee' },
      scene: { kind: 'town', farAmp: 340, snow: 0.6, clouds: 0.25, stars: 0, sun: { x: 0.8, y: 0.18, r: 26 }, mist: 0.3 },
    },
  },
  {
    place: 'Mustang', sub: 'Lo Manthang · Thakali khana', altitude: 3840, icon: 'mountain', band: [3, 4], hint: 'none',
    sound: { wind: 0.8, river: 0.1, birds: 0, bell: 0.15, city: 0 },
    theme: {
      accent: '#a2541f', accentDark: '#f0a060',
      palette: { skyTop: '#1b55ad', skyBottom: '#dcc9a6', sun: '#fffbe8', far: '#8c8096', snow: '#f4f0ee', mid: '#c98c55', near: '#a96a3b', ground: '#7a4a2b', fog: '#ebd3b0' },
      scene: { kind: 'mustang', farAmp: 360, snow: 0.45, clouds: 0.12, stars: 0, sun: { x: 0.78, y: 0.2, r: 26 }, mist: 0.25 },
    },
  },
  {
    place: 'Sagarmatha', sub: 'Everest · Nepal ko sabai bhanda mathi', altitude: 8849, icon: 'peak', band: [4], hint: 'none',
    sound: { wind: 0.9, river: 0, birds: 0, bell: 0, city: 0 },
    theme: {
      accent: '#2d5f9a', accentDark: '#7cc4ff',
      palette: { skyTop: '#060b22', skyBottom: '#d9846a', sun: '#ffd9a0', far: '#5a5f94', snow: '#ffe9de', mid: '#b9c3e6', near: '#eef2ff', ground: '#9fb0e0', fog: '#f0a98a' },
      scene: { kind: 'summit', farAmp: 300, snow: 0.85, clouds: 0.6, stars: 0.9, sun: { x: 0.18, y: 0.58, r: 34 }, mist: 0.35 },
    },
  },
];

export const LEVELS_PER_CHAPTER = 10;
export const TOTAL_LEVELS = CHAPTERS.length * LEVELS_PER_CHAPTER;
export const chapterOf = (level: number): number => Math.floor(level / LEVELS_PER_CHAPTER);

/** "Easy", ya "Easy-Medium" (band ko sabai bhanda sano ra thulo). */
export function bandLabel(band: Difficulty[]): string {
  const lo = DIFFICULTY[Math.min(...band) as Difficulty].name;
  const hi = DIFFICULTY[Math.max(...band) as Difficulty].name;
  return lo === hi ? lo : `${lo}-${hi}`;
}

export const altitudeText = (m: number): string => `${m.toLocaleString('en-US')} m`;

/** Admin le quest set nagareko level ma yehi shabda aaucha. Deterministic: same level, same word. TEMP: sample words le dherai repeat hunchha. */
export function autoLevelWord(level: number): WordEntry {
  const ch = CHAPTERS[chapterOf(level)]!;
  const pool = WORDS.filter((w) => ch.band.includes(w.difficulty));
  return pool[level % pool.length] ?? WORDS[0]!;
}

/**
 * Level (0-based index) ko shabda. Admin le tyo level ma shabda quest set gareko chha bhane tyo,
 * natra auto. Quiz/photo quest ko game screen abhai chhaina, tesaile tyo level ma pani auto shabda aaucha.
 */
export function levelWord(level: number, quests: QuestFile = QUESTS): WordEntry {
  const q = quests.quests[String(level + 1)]; // quest key 1-based ("Level 1")
  if (q?.type === 'word') {
    return { answer: q.answer, difficulty: q.difficulty, category: q.category || CHAPTERS[chapterOf(level)]!.place, hint: q.hint };
  }
  return autoLevelWord(level);
}

export const starsFor = (tries: number): 1 | 2 | 3 => (tries <= 2 ? 3 : tries <= 4 ? 2 : 1);
