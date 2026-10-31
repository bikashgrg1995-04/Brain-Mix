export type Tab = 'yatra' | 'khel' | 'multi';

export function renderNav(root: HTMLElement, active: Tab, go: (t: Tab) => void): void {
  const n = document.createElement('nav');
  n.className = 'nav';
  n.setAttribute('aria-label', 'Main');
  n.innerHTML = `
    <button data-t="yatra" class="${active === 'yatra' ? 'on' : ''}" ${active === 'yatra' ? 'aria-current="page"' : ''}>Yatra</button>
    <button data-t="khel" class="${active === 'khel' ? 'on' : ''}" ${active === 'khel' ? 'aria-current="page"' : ''}>Daily · Practice</button>
    <button data-t="multi" class="${active === 'multi' ? 'on' : ''}" ${active === 'multi' ? 'aria-current="page"' : ''}>Multi<em>2-5 jana</em></button>`;
  n.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) => (b.onclick = () => go(b.dataset.t as Tab)));
  root.appendChild(n);
}
