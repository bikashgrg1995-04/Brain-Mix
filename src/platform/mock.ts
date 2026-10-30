import { copyToClipboard, type PlatformAdapter } from './adapter';

/** Browser ma dev/test ko lagi. Facebook SDK chahidaina. */
export const mockAdapter = (): PlatformAdapter => {
  let id = '';
  return {
    name: 'mock',
    async init() {
      try {
        id = localStorage.getItem('shabda_mock_id') ?? '';
        if (!id) {
          id = 'mock-' + Math.random().toString(36).slice(2, 10);
          localStorage.setItem('shabda_mock_id', id);
        }
      } catch {
        id = 'mock-session';
      }
    },
    async start() {},
    getPlayerId: () => id,
    async shareText(text) {
      return (await copyToClipboard(text)) ? 'copied' : 'failed';
    },
  };
};
