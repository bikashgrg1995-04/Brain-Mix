import { CHAPTERS } from './chapters';
import { buildScenery } from './scenery';

/** WCAG contrast ratio (tests le accent rang padhna milchha ki check garchha). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

type Listener = (index: number | null) => void;
let listener: Listener | null = null;
/** Thau badlida (awaj ko lagi). main.ts le jodchha. */
export const onPlaceChange = (fn: Listener): void => { listener = fn; };

let sceneEl: HTMLElement | null = null;

function scene(): HTMLElement {
  if (!sceneEl) {
    sceneEl = document.createElement('div');
    sceneEl.id = 'scene';
    sceneEl.setAttribute('aria-hidden', 'true');
    document.body.prepend(sceneEl);
  }
  return sceneEl;
}

function clearScene(): void {
  const el = scene();
  el.replaceChildren();
  delete el.dataset.ch;
}

/**
 * Thau anusar theme: button/current-node ko accent rang badlinchha.
 * withBanner: game screen ko mathi ma thau ko background halne (map ma chaidaina, map afai background ho).
 * index = null: default theme (Home, Daily, Practice).
 */
export function applyTheme(index: number | null, withBanner = false): void {
  listener?.(index);
  const root = document.documentElement.style;
  const ch = index === null ? undefined : CHAPTERS[index];
  if (!ch) {
    root.removeProperty('--accent-l');
    root.removeProperty('--accent-d');
    clearScene();
    return;
  }
  root.setProperty('--accent-l', ch.theme.accent);
  root.setProperty('--accent-d', ch.theme.accentDark);
  if (!withBanner) return clearScene();
  const el = scene();
  if (el.dataset.ch === String(index)) return;
  el.innerHTML = buildScenery(ch, `b${index}`, { banner: true });
  el.dataset.ch = String(index);
}
