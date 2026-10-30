import './styles.css';
import { CHAPTERS, TOTAL_LEVELS, chapterOf, levelWord, starsFor } from './game/chapters';
import { dailyWord, renderHome, type Filter } from './game/home';
import { renderMap } from './game/map';
import { renderNav, type Tab } from './game/nav';
import { mountGame, type GameOptions } from './game/ui';
import { facebookAdapter } from './platform/facebook';
import { mockAdapter } from './platform/mock';
import { applyTheme } from './game/theme';
import { loadProfile, recordDaily, saveProfile } from './state/profile';

async function boot(): Promise<void> {
  const platform = (window as any).FBInstant ? facebookAdapter() : mockAdapter();
  await platform.init();
  await platform.start();

  const root = document.getElementById('app')!;
  const profile = loadProfile();
  let dispose: (() => void) | null = null;
  const stop = (): void => { dispose?.(); dispose = null; };

  const goTab = (t: Tab): void => (t === 'yatra' ? showMap() : showKhel());

  // First screen: Yatra level map
  function showMap(): void {
    stop();
    dispose = renderMap(root, profile, playLevel); // map ले scroll anusar theme afai badlinchha
    renderNav(root, 'yatra', goTab);
  }

  function showKhel(): void {
    stop();
    applyTheme(null);
    renderHome(root, platform, profile, {
      onDaily: () => playSimple('daily', 0),
      onPractice: (f) => playSimple('practice', f),
    });
    renderNav(root, 'khel', goTab);
  }

  function playLevel(i: number): void {
    stop();
    const ch = CHAPTERS[chapterOf(i)]!;
    const firstClear = (profile.levels[i] ?? 0) === 0;
    applyTheme(chapterOf(i), true); // thau ko accent + mathi ko background
    dispose = mountGame(root, platform, {
      mode: 'level',
      filter: 0,
      target: levelWord(i),
      level: { index: i, label: ch.place, hint: ch.hint, firstClear },
      onNext: i + 1 < TOTAL_LEVELS ? () => playLevel(i + 1) : undefined,
      onExit: showMap,
      onFinish: ({ won, tries, xp }) => {
        if (won) {
          profile.levels[i] = Math.max(profile.levels[i] ?? 0, starsFor(tries));
          profile.xp += xp;
          saveProfile(profile);
        }
      },
    });
  }

  function playSimple(mode: GameOptions['mode'], filter: Filter): void {
    stop();
    applyTheme(null);
    dispose = mountGame(root, platform, {
      mode,
      filter,
      target: mode === 'daily' ? dailyWord() : undefined,
      onExit: showKhel,
      onFinish: ({ won, tries, xp }) => {
        profile.xp += xp;
        if (mode === 'daily') recordDaily(profile, tries, won);
        saveProfile(profile);
      },
    });
  }

  showMap();
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('app');
  if (el) el.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
});
