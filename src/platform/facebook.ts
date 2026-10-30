import { copyToClipboard, type PlatformAdapter } from './adapter';

// Instant Games SDK v8 (Zero Permissions). Method names Meta docs bata verify garnus.
declare const FBInstant: any;

export const facebookAdapter = (): PlatformAdapter => ({
  name: 'facebook',
  async init() {
    await FBInstant.initializeAsync();
    FBInstant.setLoadingProgress(100);
  },
  async start() {
    await FBInstant.startGameAsync();
  },
  // Game-scoped ID. Name/photo Meta overlay views bata aaucha, hamro game ma store nagarne.
  getPlayerId: () => FBInstant.player.getID() as string,
  async shareText(text) {
    // TODO (Phase 4): spoiler-free grid ko image banayera FBInstant.shareAsync() use garne.
    return (await copyToClipboard(text)) ? 'copied' : 'failed';
  },
});
