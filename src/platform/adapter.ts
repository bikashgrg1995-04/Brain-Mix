/**
 * Platform farak (Facebook vs Android) yahi interface bhitra chhutyaune.
 * Game code ma FBInstant seedha kahile call nagarne.
 */
export interface PlatformAdapter {
  readonly name: 'mock' | 'facebook';
  init(): Promise<void>;
  /** Game load sakiyo, khelna suru garna milchha. */
  start(): Promise<void>;
  /** Game-scoped Player ID. Backend ma `identities` table ma jancha (Phase 2). */
  getPlayerId(): string;
  shareText(text: string): Promise<'shared' | 'copied' | 'failed'>;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
