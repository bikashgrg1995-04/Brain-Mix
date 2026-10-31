/** Chhoto animation/haptic. Motion kam garne user (prefers-reduced-motion) ma confetti dekhaudaina. */
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#e8a317', '#2e9e5b', '#d6453d', '#2b73c8', '#9a4fbf'];

export function confetti(host: HTMLElement, count = 28): void {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 320)}px`);
    p.style.setProperty('--y', `${Math.round(120 + Math.random() * 260)}px`);
    p.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.setProperty('--d', `${(0.9 + Math.random() * 0.8).toFixed(2)}s`);
    p.style.background = COLORS[i % COLORS.length]!;
    layer.appendChild(p);
  }
  host.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1900);
}

export function vibrate(ms: number | number[]): void {
  try { navigator.vibrate?.(ms); } catch { /* support chhaina */ }
}
