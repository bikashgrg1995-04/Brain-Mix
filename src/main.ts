import './styles.css';
import { CHAPTERS, TOTAL_LEVELS, chapterOf, starsFor } from './game/chapters';
import { dailyWord, renderHome, type Filter } from './game/home';
import { mountDaily, renderBadges } from './game/badges';
import { renderMap } from './game/map';
import { toast } from './game/toast';
import { renderNav, type Tab } from './game/nav';
import { mountRound } from './game/round-ui';
import { renderMultiplayer } from './mp/ui';
import { pickRound } from './game/rounds';
import { mountGame, type GameOptions } from './game/ui';
import { facebookAdapter } from './platform/facebook';
import { mockAdapter } from './platform/mock';
import { Ambience, type SoundMix } from './audio/ambience';
import { setSfxMuted } from './audio/sfx';
import { applyTheme, onPlaceChange } from './game/theme';
import { loadProfile, recordDaily, saveProfile } from './state/profile';
import { awardBadges, badgeCount, recordMultiplayer, recordPowerup, recordWin } from './state/progress';
import { play } from './audio/sfx';
import { confetti } from './game/fx';

async function boot(): Promise<void> {
  const platform = (window as any).FBInstant ? facebookAdapter() : mockAdapter();
  await platform.init();
  await platform.start();

  const root = document.getElementById('app')!;
  // Awaj: browser le tap pachhi matra dinchha, tesaile pahilo tap/key ma suru. Thau anusar mix badlinchha.
  const ambience = new Ambience();
  const SILENT: SoundMix = { wind: 0, river: 0, birds: 0, bell: 0, city: 0 };
  onPlaceChange((i) => ambience.setMix(i === null ? SILENT : CHAPTERS[i]!.sound));
  const startSound = (): void => ambience.start();
  window.addEventListener('pointerdown', startSound, { once: true });
  window.addEventListener('keydown', startSound, { once: true });
  const sound = { muted: () => ambience.isMuted, toggle: () => { ambience.setMuted(!ambience.isMuted); setSfxMuted(ambience.isMuted); } };
  const profile = loadProfile();
  let dispose: (() => void) | null = null;
  const stop = (): void => { dispose?.(); dispose = null; };

  /** Event pachhi badge check: naya unlock bhaye toast + awaj + coin inam. */
  function checkBadges(): void {
    const got = awardBadges(profile);
    if (!got.length) return;
    saveProfile(profile);
    play('win');
    confetti(document.body, 22);
    got.forEach((b, i) => window.setTimeout(() => toast(`${b.icon} <b>${b.name}</b> unlock! +${b.reward} 🪙`, 3600), i * 700));
  }

  const goTab = (t: Tab): void => (t === 'yatra' ? showMap() : t === 'multi' ? showMulti() : showKhel());

  // First screen: Yatra level map
  function showMap(): void {
    stop();
    dispose = renderMap(root, profile, playLevel, {
      badgeText: badgeCount(profile),
      onBadges: showBadges,
      mountDaily: (el) => mountDaily(el, profile, () => { checkBadges(); showMapPills(); }),
    }); // map ले scroll anusar theme afai badlinchha
    renderNav(root, 'yatra', goTab, sound);
  }

  function showMapPills(): void {
    document.querySelectorAll('.coinpill').forEach((e) => (e.textContent = `🪙 ${profile.coins}`));
    const b = document.getElementById('badges');
    if (b) b.textContent = `🏅 ${badgeCount(profile)}`;
  }

  function showBadges(): void {
    stop();
    applyTheme(null);
    renderBadges(root, profile, showMap);
    renderNav(root, 'yatra', goTab, sound);
  }

  function showMulti(): void {
    stop();
    applyTheme(null);
    dispose = renderMultiplayer(root, { platform, onExit: showMap, onGameEnd: (won) => { recordMultiplayer(profile, won); saveProfile(profile); checkBadges(); } });
    renderNav(root, 'multi', goTab, sound);
  }

  function showKhel(): void {
    stop();
    applyTheme(null);
    renderHome(root, platform, profile, {
      onDaily: () => playSimple('daily', 0),
      onPractice: (f) => playSimple('practice', f),
    });
    renderNav(root, 'khel', goTab, sound);
  }

  function playLevel(i: number, avoid?: string): void {
    stop();
    const ch = CHAPTERS[chapterOf(i)]!;
    const firstClear = (profile.levels[i] ?? 0) === 0;
    const round = pickRound(i, Math.random, undefined, avoid); // random type, ya admin ne set gareko
    applyTheme(chapterOf(i), true); // thau ko accent + mathi ko background
    const wallet = { coins: () => profile.coins, spend: (n: number) => { if (profile.coins < n) return false; profile.coins -= n; recordPowerup(profile); saveProfile(profile); return true; } };
    const done = (stars: number, xp: number, coins: number, kind: 'grid' | 'quiz' | 'photo' | 'rush'): void => {
      profile.levels[i] = Math.max(profile.levels[i] ?? 0, stars);
      profile.xp += xp;
      profile.coins += coins;
      recordWin(profile, kind, stars);
      saveProfile(profile);
      checkBadges();
    };
    const onNext = i + 1 < TOTAL_LEVELS ? () => playLevel(i + 1) : undefined;
    if (round.kind === 'grid') {
      dispose = mountGame(root, platform, {
        mode: 'level',
        filter: 0,
        target: round.word,
        timer: round.timer,
        level: { index: i, label: ch.place, hint: ch.hint, firstClear },
        onNext,
        onExit: showMap,
        wallet,
        onFinish: ({ won, tries, xp, coins }) => { if (won) done(starsFor(tries), xp, coins, 'grid'); },
      });
      return;
    }
    dispose = mountRound(root, round, {
      title: `Level ${i + 1}`,
      place: ch.place,
      hint: ch.hint,
      firstClear,
      onRetry: () => playLevel(i, round.id),
      onNext,
      onExit: showMap,
      wallet,
      onFinish: ({ won, stars, xp, coins }) => { if (won) done(stars, xp, coins, round.kind); },
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
        checkBadges();
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
