import { BADGES, newlyUnlocked, type Badge, type Kind, type Snapshot } from '../../shared/achievements';
import { claimDaily, dailyView, type DailyView } from '../../shared/rewards';
import { LEVELS_PER_CHAPTER } from '../game/chapters';
import { nepalDay, type Profile } from './profile';

export const snapshotOf = (p: Profile): Snapshot => ({ stats: p.stats, levels: p.levels, perChapter: LEVELS_PER_CHAPTER, coins: p.coins, streak: p.streak });

/** Level/round jitepachhi ginti badhaune. */
export function recordWin(p: Profile, kind: Kind, stars: number): void {
  p.stats.wins[kind]++;
  if (stars >= 3) p.stats.flawless++;
}

export const recordPowerup = (p: Profile): void => { p.stats.powerups++; };

export function recordMultiplayer(p: Profile, won: boolean): void {
  p.stats.mpPlayed++;
  if (won) p.stats.mpWon++;
}

/** Naya badge unlock gari coin inam dinchha. Unlock bhayeko list return (toast ko lagi). */
export function awardBadges(p: Profile, today: string = nepalDay().key): Badge[] {
  // coin inam le arko badge (jastai 200 coin) khulna sakchha, tesaile tidaina bhaye samma
  const got: Badge[] = [];
  for (;;) {
    const fresh = newlyUnlocked(snapshotOf(p), new Set(Object.keys(p.badges)));
    if (fresh.length === 0) return got;
    for (const b of fresh) {
      p.badges[b.id] = today;
      p.coins += b.reward;
      got.push(b);
    }
  }
}

export const badgeCount = (p: Profile): string => `${BADGES.filter((b) => p.badges[b.id]).length}/${BADGES.length}`;

export function todayReward(p: Profile): DailyView {
  return dailyView(p.reward, nepalDay().key, nepalDay(-1).key);
}

/** Aaja ko inam linchha. Pahilai liyeko bhae null. */
export function claimReward(p: Profile): { coins: number; day: number } | null {
  const r = claimDaily(p.reward, nepalDay().key, nepalDay(-1).key);
  if (!r) return null;
  p.reward = r.state;
  p.coins += r.coins;
  return { coins: r.coins, day: r.state.day };
}
