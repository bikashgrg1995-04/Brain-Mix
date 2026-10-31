import { currentStreak, type Profile } from '../state/profile';
import { CHAPTERS, LEVELS_PER_CHAPTER, TOTAL_LEVELS, altitudeText, bandLabel, chapterOf } from './chapters';
import { icon } from './icons';
import { buildScenery } from './scenery';
import { applyTheme } from './theme';

const W = 360;
const STEP = 52;
const ZONE = 96; // chapter ribbon ko thau
const SEC = LEVELS_PER_CHAPTER * STEP + ZONE;
const PAD_B = 70;
const PAD_T = 60;
const AMP = 68;
export const MAP_H = PAD_B + CHAPTERS.length * SEC + PAD_T;

interface Pt { x: number; y: number }

/** Level i (0-based) ko thau. Level 1 sabai bhanda tala (Nepal ko tallo thau), level 100 sabai bhanda mathi. */
export function pos(i: number): Pt {
  const c = chapterOf(i);
  const k = i % LEVELS_PER_CHAPTER;
  const yb = MAP_H - PAD_B - c * SEC;
  return { x: W / 2 + AMP * Math.sin(i * 0.8), y: yb - ZONE - 26 - k * STEP };
}

/** Map ko y (viewBox ma) ma kun thau parchha. */
export function chapterAtY(y: number): number {
  return Math.max(0, Math.min(CHAPTERS.length - 1, Math.floor((MAP_H - PAD_B - y) / SEC)));
}

/** Catmull-Rom -> cubic bezier: smooth winding road. */
function smooth(p: Pt[]): string {
  let d = `M${p[0]!.x.toFixed(1)} ${p[0]!.y.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[i + 2] ?? p2;
    const f = (n: number) => n.toFixed(1);
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

const pct = (v: number, of: number): string => ((v / of) * 100).toFixed(3) + '%';
const starText = (s: number): string => '★'.repeat(s) + '☆'.repeat(3 - s);

export interface MapExtras {
  onBadges(): void;
  badgeText: string;
  mountDaily(el: HTMLElement): void;
}

/** Returns cleanup (scroll listener hataune). */
export function renderMap(root: HTMLElement, p: Profile, onLevel: (i: number) => void, extras?: MapExtras): () => void {
  const unlockAll = new URLSearchParams(location.search).has('unlock'); // dev: ?unlock=1
  let cur = 0;
  while (cur < TOTAL_LEVELS && (p.levels[cur] ?? 0) > 0) cur++;
  const allDone = cur >= TOTAL_LEVELS;
  const pts = Array.from({ length: TOTAL_LEVELS }, (_, i) => pos(i));
  const doneInCh = (c: number): number =>
    Array.from({ length: LEVELS_PER_CHAPTER }, (_, k) => p.levels[c * LEVELS_PER_CHAPTER + k] ?? 0).filter((s) => s > 0).length;

  let secs = '';
  let ribbons = '';
  CHAPTERS.forEach((ch, c) => {
    const yb = MAP_H - PAD_B - c * SEC;
    // Har thau ko afnai background; mathi ko thau ko aakash, tala ko thau ko bhumi
    secs += `<div class="sec" style="top:${pct(yb - SEC, MAP_H)};height:${pct(SEC, MAP_H)}">${buildScenery(ch, `s${c}`)}</div>`;
    // Dui thau ko biccha ma badal (hawa ma uthe jasto)
    if (c > 0) secs += `<div class="seam" style="--fog:${ch.theme.palette.fog};top:${pct(yb - 50, MAP_H)};height:${pct(100, MAP_H)}"></div>`;
    const locked = !unlockAll && c * LEVELS_PER_CHAPTER > cur;
    ribbons += `<div class="ribbon ${locked ? 'locked' : ''}" style="--tint-l:${ch.theme.accent};--tint-d:${ch.theme.accentDark};top:${pct(yb - ZONE / 2, MAP_H)}">
      <span class="ric">${icon(ch.icon, 30)}</span>
      <span class="rtx"><b>Adhyay ${c + 1} · ${ch.place}</b><small>${ch.sub}</small><small class="rmeta">${altitudeText(ch.altitude)} · ${bandLabel(ch.band)}</small></span>
      <span class="rct">${doneInCh(c)}/${LEVELS_PER_CHAPTER}</span></div>`;
  });

  const road = smooth(pts);
  const progPts = pts.slice(0, Math.min(cur + 1, TOTAL_LEVELS));
  const prog = progPts.length > 1 ? `<path d="${smooth(progPts)}" class="prog"/>` : '';

  let nodes = '';
  pts.forEach((pt, i) => {
    const s = p.levels[i] ?? 0;
    const isCur = !allDone && i === cur;
    const open = unlockAll || s > 0 || isCur;
    const boss = (i + 1) % LEVELS_PER_CHAPTER === 0;
    const cls = `node ${s > 0 ? 'done' : isCur ? 'cur' : 'lock'} ${boss ? 'boss' : ''}`;
    const label = `Level ${i + 1}, ${CHAPTERS[chapterOf(i)]!.place}${s ? `, ${s} taara` : isCur ? ', agaadi' : open ? '' : ', band'}`;
    nodes += `<button class="${cls}" data-i="${i}" ${open ? '' : 'disabled'} aria-label="${label}" style="left:${pct(pt.x, W)};top:${pct(pt.y, MAP_H)}">
      <span>${i + 1}</span>${s ? `<i class="st">${starText(s)}</i>` : ''}</button>`;
  });

  const here = chapterOf(Math.min(cur, TOTAL_LEVELS - 1));
  root.innerHTML = `
    <div class="flags" aria-hidden="true"></div>
    <header class="mapbar">
      <div><h1>Shabda</h1><small><span class="mp-place"></span><span class="mp-meta"></span></small></div>
      <div class="stats"><span class="pill">Streak ${currentStreak(p)}</span><span class="pill coinpill">🪙 ${p.coins}</span><span class="pill">${p.xp} XP</span>${extras ? `<button class="pill btn" id="badges" aria-label="Badge ${extras.badgeText}">🏅 ${extras.badgeText}</button>` : ''}</div>
    </header>
    ${extras ? '<div id="daily"></div>' : ''}
    <div class="map" style="aspect-ratio:${W} / ${MAP_H}">
      ${secs}
      <svg class="road" viewBox="0 0 ${W} ${MAP_H}" aria-hidden="true">
        <path d="${road}" class="bed"/><path d="${road}" class="dash"/>${prog}
      </svg>
      ${ribbons}${nodes}
    </div>`;

  if (extras) {
    root.querySelector<HTMLButtonElement>('#badges')!.onclick = extras.onBadges;
    extras.mountDaily(root.querySelector<HTMLElement>('#daily')!);
  }
  root.querySelectorAll<HTMLButtonElement>('.node').forEach((b) => (b.onclick = () => onLevel(Number(b.dataset.i))));

  // Scroll garda thau, altitude, difficulty ra theme badlinchha
  const mapEl = root.querySelector<HTMLElement>('.map')!;
  const placeEl = root.querySelector<HTMLElement>('.mp-place')!;
  const metaEl = root.querySelector<HTMLElement>('.mp-meta')!;
  let shown = -1;
  const show = (c: number): void => {
    if (c === shown) return;
    shown = c;
    const ch = CHAPTERS[c]!;
    placeEl.textContent = `Adhyay ${c + 1} · ${ch.place}`;
    metaEl.textContent = `${altitudeText(ch.altitude)} · ${bandLabel(ch.band)}`;
    applyTheme(c);
  };
  const sync = (): void => {
    const r = mapEl.getBoundingClientRect();
    show(chapterAtY(((window.innerHeight * 0.45 - r.top) / r.height) * MAP_H));
  };
  show(here);
  (root.querySelector('.node.cur') ?? root.querySelector('.node.done:last-of-type'))?.scrollIntoView({ block: 'center' });
  sync();

  let raf = 0;
  const onScroll = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; sync(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(raf);
  };
}
