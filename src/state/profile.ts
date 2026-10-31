// TEMPORARY: localStorage. Facebook webview ma persist nahune sakchha.
// Phase 2 ma server (`players`, `player_progress`) ma sarne.
import { START_COINS } from '../../shared/powerups';
const KEY = 'shabda_profile_v1';

export interface Profile {
  xp: number;
  coins: number; // power-up kharid garne (shared/powerups.ts)
  streak: number;
  lastWin: string; // Nepal date key YYYY-MM-DD
  levels: Record<string, number>; // Yatra: level index -> stars (1-3)
  daily?: { date: string; tries: number; won: boolean };
}

export function loadProfile(): Profile {
  const empty: Profile = { xp: 0, coins: START_COINS, streak: 0, lastWin: '', levels: {} };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

export function saveProfile(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

/** Nepal time = UTC+5:45. offsetDays=-1 bhaneko hijo. */
export function nepalDay(offsetDays = 0): { key: string; index: number } {
  const t = Date.now() + 345 * 60000 + offsetDays * 86400000;
  return { key: new Date(t).toISOString().slice(0, 10), index: Math.floor(t / 86400000) };
}

export function currentStreak(p: Profile): number {
  return p.lastWin === nepalDay().key || p.lastWin === nepalDay(-1).key ? p.streak : 0;
}

export function recordDaily(p: Profile, tries: number, won: boolean): void {
  const today = nepalDay().key;
  p.daily = { date: today, tries, won };
  if (won && p.lastWin !== today) {
    p.streak = p.lastWin === nepalDay(-1).key ? p.streak + 1 : 1;
    p.lastWin = today;
  }
}
