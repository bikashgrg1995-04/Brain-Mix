/** Daily inam: 7 din ko cycle. Ek din chhutyo bhane feri 1 din bata. Date key = Nepal ko YYYY-MM-DD. */
export const DAILY_COINS = [10, 15, 20, 25, 30, 40, 60] as const;
export const CYCLE = DAILY_COINS.length;

export interface RewardState {
  last: string; // aghilo patak claim gareko din
  day: number; // tyo din cycle ko kati aun din thiyo (1..7)
}

export interface DailyView {
  claimable: boolean;
  day: number; // aaja claim garda (claimable) ya arko patak (claim bhaisakyo) cycle ko din
  coins: number; // tyo din ko coin
}

/** Aaja ko din: claim garna milchha ki, kun din ho, kati coin. `yesterday` = hijo ko date key. */
export function dailyView(state: RewardState | undefined, today: string, yesterday: string): DailyView {
  const claimed = state?.last === today;
  const continuing = state?.last === yesterday || claimed;
  const day = continuing && state ? (state.day % CYCLE) + 1 : 1;
  return { claimable: !claimed, day, coins: DAILY_COINS[day - 1]! };
}

/** Claim: naya state ra coin. Aaja pahilai claim gareko bhaye null (double claim hudaina). */
export function claimDaily(state: RewardState | undefined, today: string, yesterday: string): { state: RewardState; coins: number } | null {
  const v = dailyView(state, today, yesterday);
  if (!v.claimable) return null;
  return { state: { last: today, day: v.day }, coins: v.coins };
}
