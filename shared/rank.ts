// Thresholds PLACEHOLDER ho. Soft launch data herera final garne.
export const RANKS = [
  { title: 'Naya Yatri', min: 0 },
  { title: 'Porter', min: 300 },
  { title: 'Guide', min: 1000 },
  { title: 'Sherpa', min: 2500 },
  { title: 'Himal Vijeta', min: 6000 },
] as const;

export function rankFor(xp: number) {
  let i = 0;
  RANKS.forEach((r, k) => { if (xp >= r.min) i = k; });
  const cur = RANKS[i]!;
  const next = RANKS[i + 1];
  return {
    title: cur.title as string,
    next: next?.title as string | undefined,
    progress: next ? (xp - cur.min) / (next.min - cur.min) : 1,
    toNext: next ? next.min - xp : 0,
  };
}
