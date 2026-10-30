import type { IconKey } from './chapters';

// 64x64 simple silhouettes. fill=currentColor, "bg" cutouts var(--bg) use garchha.
function pagoda(n: number): string {
  let s = '<rect x="9" y="55" width="46" height="4"/><rect x="27" y="14" width="10" height="41" opacity=".55"/>';
  for (let k = 0; k < n; k++) {
    const y = 54 - k * (38 / n) - 5;
    const hw = 22 - k * (14 / n);
    s += `<path d="M${32 - hw - 4} ${y + 5}L${32 + hw + 4} ${y + 5}L${32 + hw - 2} ${y}L${32 - hw + 2} ${y}Z"/>`;
  }
  return s + '<path d="M32 4v8"/><circle cx="32" cy="9" r="2.5"/>';
}

function flags(): string {
  const cols = ['#2c6fb7', '#f2f2f2', '#b8322a', '#2f8f5b', '#d9a21f'];
  let s = '<path d="M4 56l22-26 12 14 8-8 14 20z" opacity=".7"/><path d="M6 14Q32 30 58 12" stroke="currentColor" fill="none" stroke-width="1.6"/>';
  cols.forEach((c, i) => {
    const t = 0.12 + i * 0.19;
    const x = 6 + 52 * t;
    const y = (1 - t) ** 2 * 14 + 2 * t * (1 - t) * 30 + t ** 2 * 12;
    s += `<path d="M${x - 4} ${y}h8v9l-4-3-4 3z" fill="${c}"/>`;
  });
  return s;
}

const ICONS: Record<IconKey, string> = {
  stupa: '<path d="M8 57h48v-5H8z"/><path d="M13 52a19 19 0 0 1 38 0z"/><rect x="25" y="27" width="14" height="9" rx="1"/><path d="M32 5l4 22h-8z"/><circle cx="29" cy="31.5" r="1.7" fill="var(--bg)"/><circle cx="35" cy="31.5" r="1.7" fill="var(--bg)"/>',
  pagoda: pagoda(5),
  temple: pagoda(3),
  rhino: '<ellipse cx="29" cy="38" rx="21" ry="12"/><path d="M46 29l14 7-2 9-14-3z"/><path d="M57 33l5-10-9 8z"/><path d="M47 28l3-6 3 7z"/><rect x="14" y="46" width="7" height="12" rx="1"/><rect x="37" y="46" width="7" height="12" rx="1"/>',
  lotus: '<path d="M32 10c9 9 9 26 0 38-9-12-9-29 0-38z"/><path d="M10 26c11 0 20 8 22 22-13 0-22-9-22-22z" opacity=".8"/><path d="M54 26c-11 0-20 8-22 22 13 0 22-9 22-22z" opacity=".8"/><path d="M6 54c14-7 38-7 52 0-14 5-38 5-52 0z" opacity=".55"/>',
  lake: '<path d="M2 40l16-20 12 14 10-12 22 18z" opacity=".6"/><path d="M4 44q7-5 14 0t14 0 14 0 14 0v5q-7 5-14 0t-14 0-14 0-14 0z"/><path d="M20 56h24l-4 5H24z"/><path d="M32 38v17l10-4z"/>',
  khukuri: '<path d="M10 12c22 0 38 14 40 32l-9 6C38 35 27 25 10 21z"/><rect x="42" y="44" width="7" height="15" rx="2" transform="rotate(-38 45 51)"/>',
  mountain: '<path d="M3 56l21-36 10 17 8-11 19 30z"/><path d="M24 20l6 10-6-3-5 3z" fill="var(--bg)"/>',
  flags: flags(),
  peak: '<path d="M3 58l29-48 29 48z"/><path d="M32 10l9 15-9-4-9 4z" fill="var(--bg)"/><path d="M32 10V2" stroke="currentColor" stroke-width="2"/><path d="M32 2h9l-3 3.5 3 3.5h-9z" fill="#b8322a"/>',
  paddy: '<path d="M26 60C26 42 30 24 46 6" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/><ellipse cx="44" cy="12" rx="3" ry="6" transform="rotate(35 44 12)"/><ellipse cx="38" cy="19" rx="3" ry="6" transform="rotate(20 38 19)"/><ellipse cx="33" cy="27" rx="3" ry="6" transform="rotate(10 33 27)"/><ellipse cx="53" cy="16" rx="3" ry="6" transform="rotate(55 53 16)"/><ellipse cx="49" cy="24" rx="3" ry="6" transform="rotate(45 49 24)"/><path d="M26 58C16 54 10 46 8 36c10 2 16 10 18 22z" opacity=".75"/><path d="M27 52c8-4 14-4 22-1-6 5-14 6-22 1z" opacity=".6"/>',
};

export const icon = (key: IconKey, size = 28): string =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${ICONS[key]}</svg>`;
