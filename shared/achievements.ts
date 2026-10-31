/** Badge (achievement). `value` jati badhchha `need` ma pugda unlock, reward coin ek patak. */
export type Kind = 'grid' | 'quiz' | 'photo' | 'rush';

export interface Stats {
  wins: Record<Kind, number>; // kind anusar jitaeko round
  flawless: number; // 3 star ko jit
  powerups: number; // power-up kharid
  mpPlayed: number;
  mpWon: number;
}

export const emptyStats = (): Stats => ({ wins: { grid: 0, quiz: 0, photo: 0, rush: 0 }, flawless: 0, powerups: 0, mpPlayed: 0, mpWon: 0 });

export interface Snapshot {
  stats: Stats;
  levels: Record<string, number>; // level index -> stars
  perChapter: number;
  coins: number;
  streak: number;
}

export interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: string;
  reward: number;
  need: number;
  value(s: Snapshot): number;
}

const cleared = (s: Snapshot): number => Object.values(s.levels).filter((v) => v > 0).length;
const stars = (s: Snapshot): number => Object.values(s.levels).reduce((a, b) => a + b, 0);
export function chaptersDone(s: Snapshot): number {
  const per: Record<number, number> = {};
  for (const [k, v] of Object.entries(s.levels)) if (v > 0) per[Math.floor(Number(k) / s.perChapter)] = (per[Math.floor(Number(k) / s.perChapter)] ?? 0) + 1;
  return Object.values(per).filter((n) => n >= s.perChapter).length;
}
const wins = (k: Kind) => (s: Snapshot): number => s.stats.wins[k];

export const BADGES: Badge[] = [
  { id: 'first', name: 'Pahilo Kadam', desc: 'Pahilo level jitnus', icon: '👣', reward: 10, need: 1, value: cleared },
  { id: 'lv10', name: 'Yatri', desc: '10 level jitnus', icon: '🥾', reward: 20, need: 10, value: cleared },
  { id: 'lv50', name: 'Guide', desc: '50 level jitnus', icon: '🧭', reward: 50, need: 50, value: cleared },
  { id: 'lv100', name: 'Himal Vijeta', desc: 'Sabai 100 level jitnus', icon: '🏔️', reward: 150, need: 100, value: cleared },
  { id: 'ch1', name: 'Thau Vijeta', desc: 'Ek thau ko sabai 10 level jitnus', icon: '📍', reward: 30, need: 1, value: chaptersDone },
  { id: 'ch5', name: 'Aadha Bato', desc: '5 thau pura garnus', icon: '🗺️', reward: 80, need: 5, value: chaptersDone },
  { id: 'star30', name: 'Taara Sangalo', desc: 'Jamma 30 taara', icon: '⭐', reward: 30, need: 30, value: stars },
  { id: 'star100', name: 'Aakash Ganga', desc: 'Jamma 100 taara', icon: '🌌', reward: 80, need: 100, value: stars },
  { id: 'flaw10', name: 'Perfectionist', desc: '10 patak 3 taara le jitnus', icon: '💎', reward: 50, need: 10, value: (s) => s.stats.flawless },
  { id: 'grid10', name: 'Shabda Khoji', desc: '10 shabda round jitnus', icon: '🔤', reward: 30, need: 10, value: wins('grid') },
  { id: 'quiz10', name: 'Gyani', desc: '10 quiz jitnus', icon: '🧠', reward: 30, need: 10, value: wins('quiz') },
  { id: 'photo10', name: 'Chitrakar', desc: '10 chitra shabda jitnus', icon: '🖼️', reward: 30, need: 10, value: wins('photo') },
  { id: 'rush10', name: 'Chhito Haat', desc: '10 rush (5 shabda) jitnus', icon: '⚡', reward: 30, need: 10, value: wins('rush') },
  { id: 'all5', name: 'Sabai Khel', desc: 'Char type ma 5-5 patak jitnus', icon: '🎯', reward: 60, need: 5, value: (s) => Math.min(...Object.values(s.stats.wins)) },
  { id: 'streak3', name: 'Niyamit', desc: 'Daily shabda 3 din lagatar', icon: '🔥', reward: 25, need: 3, value: (s) => s.streak },
  { id: 'streak7', name: 'Hapta', desc: 'Daily shabda 7 din lagatar', icon: '🗓️', reward: 70, need: 7, value: (s) => s.streak },
  { id: 'coin200', name: 'Dhani', desc: '200 coin jammaa garnus', icon: '💰', reward: 20, need: 200, value: (s) => s.coins },
  { id: 'power10', name: 'Chatur', desc: '10 power-up prayog garnus', icon: '💡', reward: 20, need: 10, value: (s) => s.stats.powerups },
  { id: 'mp1', name: 'Saathi', desc: 'Pahilo multiplayer khel', icon: '👥', reward: 20, need: 1, value: (s) => s.stats.mpPlayed },
  { id: 'mpwin', name: 'Champion', desc: 'Multiplayer ma pahilo hunus', icon: '🏆', reward: 50, need: 1, value: (s) => s.stats.mpWon },
];

/** Naya unlock bhayeka (aghi nabhayeka) badge haru. */
export function newlyUnlocked(s: Snapshot, have: ReadonlySet<string>): Badge[] {
  return BADGES.filter((b) => !have.has(b.id) && b.value(s) >= b.need);
}
