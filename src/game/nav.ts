export type Tab = 'yatra' | 'khel' | 'multi';

export interface SoundControl { muted(): boolean; toggle(): void }

export function renderNav(root: HTMLElement, active: Tab, go: (t: Tab) => void, sound?: SoundControl): void {
  const n = document.createElement('nav');
  n.className = 'nav';
  n.setAttribute('aria-label', 'Main');
  n.innerHTML = `
    <button data-t="yatra" class="${active === 'yatra' ? 'on' : ''}" ${active === 'yatra' ? 'aria-current="page"' : ''}>Yatra</button>
    <button data-t="khel" class="${active === 'khel' ? 'on' : ''}" ${active === 'khel' ? 'aria-current="page"' : ''}>Daily · Practice</button>
    <button data-t="multi" class="${active === 'multi' ? 'on' : ''}" ${active === 'multi' ? 'aria-current="page"' : ''}>Multi<em>2-5 jana</em></button>`;
  if (sound) {
    const b = document.createElement('button');
    b.className = 'snd';
    const paint = (): void => {
      b.textContent = sound.muted() ? '🔇' : '🔊';
      b.setAttribute('aria-pressed', String(!sound.muted()));
      b.setAttribute('aria-label', sound.muted() ? 'Awaj band, kholna thichnus' : 'Awaj khulyo, band garna thichnus');
    };
    b.onclick = () => { sound.toggle(); paint(); };
    paint();
    n.appendChild(b);
  }
  n.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) => (b.onclick = () => go(b.dataset.t as Tab)));
  root.appendChild(n);
}
