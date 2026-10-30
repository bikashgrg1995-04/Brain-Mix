/** Yatra/Daily: exact letters chahinchha (grid ko lagi). Lowercase + a-z matra. */
export function normalizeExact(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Multiplayer board matching ko lagi matra: space/hyphen hataune, repeated letters ek banaune.
 * daalbhat = dal bhat = dalbhat. Yatra grid ma yo prayog nagarne.
 */
export function normalizeBoard(input: string): string {
  return normalizeExact(input).replace(/(.)\1+/g, '$1');
}
