import type { Chapter } from './chapters';

/**
 * Har thau ko painted background (SVG), palette bata code ma banaeko.
 * Image file chaidaina: sano download, license ko jhanjhat chhaina.
 * Real photo halna man lagyo bhane pachhi alag layer ma thapna milchha.
 */
export type SceneKind = 'paddy' | 'janakpur' | 'lumbini' | 'jungle' | 'lake' | 'fort' | 'city' | 'town' | 'mustang' | 'summit';

export interface Palette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  far: string; // dura ko himal/pahad
  snow: string;
  mid: string;
  near: string;
  ground: string;
  fog: string;
}

export interface SceneParams {
  kind: SceneKind;
  farAmp: number; // dura ko pahad ko ucchai (viewBox 600 x 1000 ma)
  snow: number; // 0 = hiu chhaina, 1 = tala samma
  clouds: number; // 0..1
  stars: number; // 0..1
  sun: { x: number; y: number; r: number } | null; // viewBox ko anupat
  mist: number; // 0..1
}

export const VIEW_W = 600;
export const VIEW_H = 1000;
const W = VIEW_W;
const H = VIEW_H;

type Rng = () => number;
interface Pt { x: number; y: number }

const at = <T>(a: readonly T[], i: number): T => a[i] as T;
const n = (v: number): string => String(Math.round(v * 10) / 10);

// ---------- random + colour ----------
function seedOf(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
const darken = (c: string, t: number): string => mix(c, '#000000', t);
const lighten = (c: string, t: number): string => mix(c, '#ffffff', t);

// ---------- geometry ----------
/** Midpoint displacement: tikha himal jasto ridge. */
function jagged(rng: Rng, baseY: number, amp: number, levels = 6, rough = 0.56): Pt[] {
  const cnt = 2 ** levels;
  const h: number[] = new Array<number>(cnt + 1).fill(0);
  h[0] = rng() * 0.5;
  h[cnt] = rng() * 0.5;
  let step = cnt;
  let scale = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < cnt; i += step) h[i] = (at(h, i - half) + at(h, i + half)) / 2 + (rng() - 0.5) * scale;
    step = half;
    scale *= rough;
  }
  const lo = Math.min(...h);
  const hi = Math.max(...h);
  return h.map((v, i) => ({ x: -40 + ((W + 80) * i) / cnt, y: baseY - (amp * (v - lo)) / (hi - lo || 1) }));
}

/** Narm pahadi. */
function rolling(rng: Rng, baseY: number, amp: number, steps = 48): Pt[] {
  const p1 = rng() * 6.28;
  const p2 = rng() * 6.28;
  const p3 = rng() * 6.28;
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = -40 + ((W + 80) * i) / steps;
    const t = x / W;
    out.push({ x, y: baseY - amp * (0.55 + 0.3 * Math.sin(t * 3.1 + p1) + 0.2 * Math.sin(t * 7.3 + p2) + 0.1 * Math.sin(t * 13 + p3)) });
  }
  return out;
}

function poly(pts: Pt[], bottom = H + 20): string {
  const first = at(pts, 0);
  const last = at(pts, pts.length - 1);
  return `M${n(first.x)},${bottom} ${pts.map((q) => `L${n(q.x)},${n(q.y)}`).join(' ')} L${n(last.x)},${bottom} Z`;
}

function yAt(pts: Pt[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const b = at(pts, i);
    if (x <= b.x) {
      const a = at(pts, i - 1);
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
    }
  }
  return at(pts, pts.length - 1).y;
}

// ---------- layers ----------
function haze(id: string, y0: number, y1: number, color: string, opacity: number): string {
  if (opacity <= 0) return '';
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="${opacity.toFixed(2)}"/></linearGradient>` +
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(y1 - y0)}" fill="url(#${id})"/>`
  );
}

function mountainLayer(
  id: string, pts: Pt[], rock: string, snowColor: string, snowLevel: number, rim: string,
  baseY: number, sunLeft: boolean, shade: number, foot: string,
): string {
  const topY = Math.min(...pts.map((q) => q.y));
  const stops =
    snowLevel > 0
      ? `<stop offset="0" stop-color="${snowColor}"/><stop offset="${(snowLevel * 0.55).toFixed(2)}" stop-color="${snowColor}"/>` +
        `<stop offset="${Math.min(0.95, snowLevel * 0.55 + 0.14).toFixed(2)}" stop-color="${rock}"/><stop offset="1" stop-color="${foot}"/>`
      : `<stop offset="0" stop-color="${rock}"/><stop offset="1" stop-color="${foot}"/>`;
  const d = poly(pts);
  const dir = sunLeft ? 1 : -1;
  let facets = '';
  for (let i = 1; i < pts.length - 1; i++) {
    const a = at(pts, i - 1);
    const P = at(pts, i);
    const b = at(pts, i + 1);
    if (!(P.y < a.y && P.y <= b.y)) continue;
    let j = i + dir;
    while (j + dir >= 0 && j + dir < pts.length && at(pts, j + dir).y >= at(pts, j).y) j += dir;
    const V = at(pts, j);
    if (Math.abs(V.x - P.x) < 14) continue;
    const qx = P.x + (V.x - P.x) * 0.4;
    facets += `<path d="M${n(P.x)},${n(P.y)} L${n(V.x)},${n(V.y)} L${n(qx)},${baseY} Z"/>`;
  }
  return (
    `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="${n(topY)}" x2="0" y2="${baseY}">${stops}</linearGradient>` +
    `<linearGradient id="${id}-f" gradientUnits="userSpaceOnUse" x1="0" y1="${n(topY)}" x2="0" y2="${baseY}">` +
    `<stop offset="0" stop-color="#10182e" stop-opacity="${shade.toFixed(2)}"/><stop offset="1" stop-color="#10182e" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="${id}-c"><path d="${d}"/></clipPath>` +
    `<path d="${d}" fill="url(#${id}-g)"/>` +
    `<g clip-path="url(#${id}-c)" fill="url(#${id}-f)">${facets}</g>` +
    `<polyline points="${pts.map((q) => `${n(q.x)},${n(q.y)}`).join(' ')}" fill="none" stroke="${rim}" stroke-opacity="0.55" stroke-width="1.2"/>`
  );
}

function cloudsSvg(p: string, rng: Rng, amount: number, col: string): string {
  const count = Math.round(amount * 8);
  let s =
    `<radialGradient id="${p}-cl"><stop offset="0" stop-color="${col}" stop-opacity="0.95"/>` +
    `<stop offset="0.6" stop-color="${col}" stop-opacity="0.5"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
  for (let i = 0; i < count; i++) {
    const cx = rng() * W;
    const cy = 140 + rng() * 360;
    const op = (0.4 + rng() * 0.45) * (0.6 + amount * 0.5);
    for (let k = 0; k < 5; k++) {
      s += `<ellipse cx="${n(cx + (k - 2) * 30)}" cy="${n(cy + rng() * 12)}" rx="${n(44 + rng() * 40)}" ry="${n(13 + rng() * 12)}" fill="url(#${p}-cl)" opacity="${op.toFixed(2)}"/>`;
    }
  }
  return s;
}

// ---------- small things ----------
function house(x: number, y: number, w: number, h: number, wall: string, roof: string): string {
  return (
    `<rect x="${n(x)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" fill="${wall}"/>` +
    `<path d="M${n(x - 2)},${n(y - h)} L${n(x + w / 2)},${n(y - h - h * 0.6)} L${n(x + w + 2)},${n(y - h)} Z" fill="${roof}"/>` +
    `<rect x="${n(x + w * 0.4)}" y="${n(y - h * 0.55)}" width="${n(w * 0.2)}" height="${n(h * 0.55)}" fill="${darken(wall, 0.45)}"/>`
  );
}

function flatHouse(x: number, y: number, w: number, h: number, wall: string, roof: string): string {
  return (
    `<rect x="${n(x)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" fill="${wall}"/>` +
    `<rect x="${n(x - 1.5)}" y="${n(y - h - 3)}" width="${n(w + 3)}" height="3.5" fill="${roof}"/>` +
    `<rect x="${n(x + w * 0.15)}" y="${n(y - h * 0.7)}" width="${n(w * 0.22)}" height="${n(h * 0.3)}" fill="${darken(wall, 0.5)}"/>`
  );
}

function pine(x: number, y: number, s: number, col: string): string {
  const dark = darken(col, 0.25);
  let out = `<rect x="${n(x - s * 0.05)}" y="${n(y - s * 0.15)}" width="${n(s * 0.1)}" height="${n(s * 0.15)}" fill="${dark}"/>`;
  for (let i = 0; i < 3; i++) {
    const w = s * (0.34 - i * 0.07);
    const yb = y - s * 0.1 - i * s * 0.26;
    out += `<path d="M${n(x - w)},${n(yb)} L${n(x)},${n(yb - s * 0.42)} L${n(x + w)},${n(yb)} Z" fill="${i % 2 ? col : dark}"/>`;
  }
  return out;
}

function broadleaf(x: number, y: number, s: number, col: string): string {
  return (
    `<rect x="${n(x - s * 0.04)}" y="${n(y - s * 0.4)}" width="${n(s * 0.08)}" height="${n(s * 0.4)}" fill="${darken(col, 0.55)}"/>` +
    `<circle cx="${n(x)}" cy="${n(y - s * 0.55)}" r="${n(s * 0.3)}" fill="${darken(col, 0.15)}"/>` +
    `<circle cx="${n(x - s * 0.16)}" cy="${n(y - s * 0.45)}" r="${n(s * 0.22)}" fill="${col}"/>` +
    `<circle cx="${n(x + s * 0.17)}" cy="${n(y - s * 0.48)}" r="${n(s * 0.22)}" fill="${lighten(col, 0.1)}"/>`
  );
}

function palm(x: number, y: number, s: number, col: string): string {
  const tx = x - s * 0.03;
  const ty = y - s;
  let out =
    `<path d="M${n(x)},${n(y)} Q${n(x + s * 0.08)},${n(y - s * 0.5)} ${n(tx)},${n(ty)}" stroke="${darken(col, 0.55)}" ` +
    `stroke-width="${n(Math.max(1.6, s * 0.05))}" fill="none" stroke-linecap="round"/>`;
  for (let k = -3; k <= 3; k++) {
    const ang = k * 0.5;
    const lx = tx + Math.sin(ang) * s * 0.42;
    const ly = ty + Math.abs(k) * s * 0.07 + s * 0.05;
    out +=
      `<path d="M${n(tx)},${n(ty)} Q${n(tx + Math.sin(ang) * s * 0.25)},${n(ty - s * 0.14 + Math.abs(k) * s * 0.03)} ${n(lx)},${n(ly)}" ` +
      `stroke="${col}" stroke-width="${n(Math.max(1.4, s * 0.04))}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}

function boulder(x: number, y: number, s: number, col: string): string {
  return (
    `<path d="M${n(x - s)},${n(y)} L${n(x - s * 0.7)},${n(y - s * 0.7)} L${n(x - s * 0.1)},${n(y - s)} L${n(x + s * 0.6)},${n(y - s * 0.75)} L${n(x + s)},${n(y)} Z" fill="${col}"/>` +
    `<path d="M${n(x - s * 0.1)},${n(y - s)} L${n(x + s * 0.6)},${n(y - s * 0.75)} L${n(x + s)},${n(y)} L${n(x + s * 0.2)},${n(y - s * 0.2)} Z" fill="${darken(col, 0.3)}"/>`
  );
}

const FLAG_COLORS = ['#2f6fd6', '#f4f4f4', '#d83a3a', '#3fae5a', '#f0c030'];

function flagsLine(x1: number, y1: number, x2: number, y2: number, count: number, sag: number, size = 1): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag;
  let out = `<path d="M${n(x1)},${n(y1)} Q${n(cx)},${n(cy)} ${n(x2)},${n(y2)}" fill="none" stroke="#2b2320" stroke-width="0.9"/>`;
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    out += `<rect x="${n(px - 4 * size)}" y="${n(py)}" width="${n(8 * size)}" height="${n(10 * size)}" fill="${at(FLAG_COLORS, i % 5)}" fill-opacity="0.95"/>`;
  }
  return out;
}

function pagoda(x: number, y: number, s: number, wall: string, roof: string, gold: string): string {
  let out = `<rect x="${n(x - 20 * s)}" y="${n(y - 12 * s)}" width="${n(40 * s)}" height="${n(12 * s)}" fill="${darken(wall, 0.2)}"/>`;
  for (let t = 0; t < 3; t++) {
    const baseY = y - 12 * s - t * 24 * s;
    const bodyW = (22 - t * 5) * s;
    const half = (34 - t * 8) * s;
    out += `<rect x="${n(x - bodyW / 2)}" y="${n(baseY - 12 * s)}" width="${n(bodyW)}" height="${n(12 * s)}" fill="${wall}"/>`;
    out += `<path d="M${n(x - half)},${n(baseY - 10 * s)} L${n(x - half * 0.55)},${n(baseY - 24 * s)} L${n(x + half * 0.55)},${n(baseY - 24 * s)} L${n(x + half)},${n(baseY - 10 * s)} Z" fill="${roof}"/>`;
    out += `<rect x="${n(x - half)}" y="${n(baseY - 11 * s)}" width="${n(half * 2)}" height="${n(2 * s)}" fill="${darken(roof, 0.35)}"/>`;
  }
  const topY = y - 12 * s - 3 * 24 * s + 4 * s;
  return out + `<rect x="${n(x - s)}" y="${n(topY - 14 * s)}" width="${n(2 * s)}" height="${n(14 * s)}" fill="${gold}"/>`;
}

/** Swayambhunath jasto stupa: Buddha ko aankha sahit. */
function stupa(x: number, y: number, s: number): string {
  const white = '#f1ebe0';
  const gold = '#d9a441';
  let out =
    `<rect x="${n(x - 46 * s)}" y="${n(y - 10 * s)}" width="${n(92 * s)}" height="${n(10 * s)}" fill="${darken(white, 0.12)}"/>` +
    `<rect x="${n(x - 38 * s)}" y="${n(y - 20 * s)}" width="${n(76 * s)}" height="${n(10 * s)}" fill="${white}"/>` +
    `<path d="M${n(x - 31 * s)},${n(y - 20 * s)} A${n(31 * s)},${n(31 * s)} 0 0 1 ${n(x + 31 * s)},${n(y - 20 * s)} Z" fill="${white}"/>` +
    `<path d="M${n(x + 2 * s)},${n(y - 20 * s)} L${n(x + 2 * s)},${n(y - 51 * s)} A${n(31 * s)},${n(31 * s)} 0 0 1 ${n(x + 31 * s)},${n(y - 20 * s)} Z" fill="#c7b9a3" fill-opacity="0.55"/>` +
    `<rect x="${n(x - 10 * s)}" y="${n(y - 64 * s)}" width="${n(20 * s)}" height="${n(14 * s)}" fill="${gold}"/>` +
    `<circle cx="${n(x - 4 * s)}" cy="${n(y - 58 * s)}" r="${n(1.6 * s)}" fill="#25314f"/><circle cx="${n(x + 4 * s)}" cy="${n(y - 58 * s)}" r="${n(1.6 * s)}" fill="#25314f"/>` +
    `<path d="M${n(x - 7 * s)},${n(y - 64 * s)} L${n(x)},${n(y - 98 * s)} L${n(x + 7 * s)},${n(y - 64 * s)} Z" fill="${gold}"/>`;
  for (let i = 0; i < 4; i++) {
    out += `<rect x="${n(x - (6 - i) * s)}" y="${n(y - (68 + i * 7) * s)}" width="${n((12 - i * 2) * s)}" height="${n(2 * s)}" fill="${darken(gold, 0.25)}"/>`;
  }
  return out + flagsLine(x, y - 96 * s, x - 78 * s, y - 8 * s, 8, 10 * s, 0.9 * s) + flagsLine(x, y - 96 * s, x + 78 * s, y - 8 * s, 8, 10 * s, 0.9 * s);
}

/** Saphed chorten (Mustang / Lumbini). */
function chorten(x: number, y: number, s: number, band: string): string {
  return (
    `<rect x="${n(x - 16 * s)}" y="${n(y - 8 * s)}" width="${n(32 * s)}" height="${n(8 * s)}" fill="#e9e0cf"/>` +
    `<rect x="${n(x - 12 * s)}" y="${n(y - 15 * s)}" width="${n(24 * s)}" height="${n(7 * s)}" fill="#f4eee0"/>` +
    `<path d="M${n(x - 10 * s)},${n(y - 15 * s)} Q${n(x)},${n(y - 38 * s)} ${n(x + 10 * s)},${n(y - 15 * s)} Z" fill="#f7f2e6"/>` +
    `<rect x="${n(x - 9 * s)}" y="${n(y - 21 * s)}" width="${n(18 * s)}" height="${n(3 * s)}" fill="${band}"/>` +
    `<path d="M${n(x - 4 * s)},${n(y - 31 * s)} L${n(x)},${n(y - 48 * s)} L${n(x + 4 * s)},${n(y - 31 * s)} Z" fill="#d9a441"/>`
  );
}

function figure(x: number, y: number, s: number, jacket: string, hat: 'cap' | 'conical' | 'helmet'): string {
  let head = `<path d="M${n(x - 3.2 * s)},${n(y - 22 * s)} A${n(3.2 * s)},${n(3.2 * s)} 0 0 1 ${n(x + 3.2 * s)},${n(y - 22 * s)} Z" fill="#2c2c34"/>`;
  if (hat === 'conical') head = `<path d="M${n(x - 6 * s)},${n(y - 22 * s)} L${n(x)},${n(y - 29 * s)} L${n(x + 6 * s)},${n(y - 22 * s)} Z" fill="#d9bf72"/>`;
  if (hat === 'helmet') head = `<path d="M${n(x - 3.6 * s)},${n(y - 21.5 * s)} A${n(3.6 * s)},${n(3.6 * s)} 0 0 1 ${n(x + 3.6 * s)},${n(y - 21.5 * s)} Z" fill="#f3f3f3"/>`;
  return (
    `<rect x="${n(x - 2.2 * s)}" y="${n(y - 9 * s)}" width="${n(1.8 * s)}" height="${n(9 * s)}" fill="#1c2233"/>` +
    `<rect x="${n(x + 0.4 * s)}" y="${n(y - 9 * s)}" width="${n(1.8 * s)}" height="${n(9 * s)}" fill="#1c2233"/>` +
    `<rect x="${n(x - 3.4 * s)}" y="${n(y - 18 * s)}" width="${n(6.8 * s)}" height="${n(9.5 * s)}" fill="${jacket}"/>` +
    `<circle cx="${n(x)}" cy="${n(y - 21 * s)}" r="${n(3 * s)}" fill="#e2b48f"/>` + head
  );
}

function rhino(x: number, y: number, s: number): string {
  const body = '#5a5853';
  const dark = '#3d3c38';
  return (
    `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">` +
    `<rect x="-26" y="-14" width="9" height="16" fill="${dark}"/><rect x="-10" y="-14" width="9" height="16" fill="${body}"/>` +
    `<rect x="14" y="-14" width="9" height="16" fill="${dark}"/><rect x="28" y="-14" width="9" height="16" fill="${body}"/>` +
    `<path d="M-38,-22 C-34,-44 -6,-52 24,-48 C44,-46 54,-36 52,-22 C50,-12 40,-10 30,-12 L-30,-12 C-36,-12 -40,-16 -38,-22Z" fill="${body}"/>` +
    `<path d="M-14,-46 C-10,-36 -10,-24 -14,-14 M14,-48 C18,-38 18,-26 14,-14" stroke="${dark}" stroke-width="2" fill="none"/>` +
    `<path d="M-36,-30 C-50,-30 -62,-22 -68,-12 C-62,-6 -50,-6 -42,-10 L-34,-14Z" fill="${body}"/>` +
    `<path d="M-60,-21 L-70,-38 L-54,-25Z" fill="#8a8780"/>` +
    `<path d="M-30,-40 L-26,-50 L-22,-40Z" fill="${dark}"/>` +
    `<path d="M52,-26 Q60,-20 58,-8" stroke="${dark}" stroke-width="2" fill="none"/>` +
    `<circle cx="-48" cy="-20" r="1.6" fill="#15110f"/>` +
    `</g>`
  );
}

function horseRider(x: number, y: number, s: number): string {
  const horse = '#4a3122';
  return (
    `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">` +
    `<rect x="-22" y="-18" width="3.4" height="20" fill="#2e1d14"/><rect x="-14" y="-18" width="3.4" height="20" fill="${horse}"/>` +
    `<rect x="16" y="-18" width="3.4" height="20" fill="#2e1d14"/><rect x="24" y="-18" width="3.4" height="20" fill="${horse}"/>` +
    `<ellipse cx="2" cy="-26" rx="28" ry="10" fill="${horse}"/>` +
    `<path d="M24,-30 Q36,-48 44,-42 L48,-34 Q40,-34 30,-22Z" fill="${horse}"/>` +
    `<path d="M-26,-30 Q-36,-24 -34,-12" stroke="#2e1d14" stroke-width="3" fill="none"/>` +
    `<rect x="-3" y="-47" width="7" height="14" fill="#c0392b"/><circle cx="0.5" cy="-52" r="3.6" fill="#e2b48f"/>` +
    `<path d="M-5,-53 L0.5,-60 L6,-53Z" fill="#2c2c34"/>` +
    `</g>`
  );
}

function boat(x: number, y: number, s: number, hull: string, stripe: string): string {
  return (
    `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">` +
    `<path d="M-44,-6 Q0,8 44,-6 L38,-13 Q0,-6 -38,-13Z" fill="${hull}"/>` +
    `<path d="M-40,-9 Q0,-1 40,-9" stroke="${stripe}" stroke-width="2.4" fill="none"/>` +
    `<path d="M-14,-12 L-12,-24 L14,-24 L16,-12Z" fill="${stripe}" fill-opacity="0.9"/>` +
    `<path d="M-30,2 Q0,9 30,2" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.4" fill="none"/>` +
    `</g>`
  );
}

function paraglider(x: number, y: number, s: number, c1: string, c2: string): string {
  return (
    `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">` +
    `<path d="M-30,0 Q0,-26 30,0 Z" fill="${c1}"/><path d="M-10,-8 Q0,-12 10,-8 L14,0 L-14,0Z" fill="${c2}"/>` +
    `<path d="M-26,0 L0,26 M26,0 L0,26 M-8,-2 L0,26 M8,-2 L0,26" stroke="#2b2320" stroke-width="0.7"/>` +
    `<circle cx="0" cy="28" r="2.6" fill="#2b2320"/>` +
    `</g>`
  );
}

// ---------- scenes ----------
interface Ctx { rng: Rng; pal: Palette; p: string; mid: Pt[]; near: Pt[] }
interface Parts {
  back?: string; // dura pahad pachhi, mid pahadi aagadi
  mid?: string; // mid pahadi pachhi, near pahadi aagadi
  front?: string; // sabai aagadi
}

const BUILDERS: Record<SceneKind, (c: Ctx) => Parts> = {
  // Mukhiyapatti: Terai ko dhan kheti, pokhari, Mithila ghar
  paddy: ({ rng, pal, mid }) => {
    let m = '';
    for (let x = 6; x < W + 20; x += 16 + rng() * 14) {
      const y = yAt(mid, x) + 4;
      const col = mix(pal.mid, pal.fog, 0.35);
      m += rng() > 0.45 ? palm(x, y, 46 + rng() * 26, col) : broadleaf(x, y, 40 + rng() * 22, col);
    }
    const greens = ['#a8cf5f', '#86b84a', '#cdc65a', '#6fae44', '#93c04e'];
    const top = 765;
    const vx = 300;
    const vy = 690;
    const rows = 8;
    let f = '';
    for (let r = 0; r < rows; r++) {
      const ya = top + (H - top) * Math.pow(r / rows, 1.6);
      const yb = top + (H - top) * Math.pow((r + 1) / rows, 1.6);
      f += `<rect x="-5" y="${n(ya)}" width="${W + 10}" height="${n(yb - ya + 1)}" fill="${at(greens, (r * 2 + (r % 3)) % 5)}"/>`;
      for (let k = -6; k <= 6; k++) {
        const xb = vx + k * 95 + (rng() - 0.5) * 50;
        const xa = vx + (xb - vx) * ((ya - vy) / (H - vy));
        const xc = vx + (xb - vx) * ((yb - vy) / (H - vy));
        f += `<line x1="${n(xa)}" y1="${n(ya)}" x2="${n(xc)}" y2="${n(yb)}" stroke="#d2bd88" stroke-width="${n(1 + r * 0.35)}"/>`;
      }
      f += `<rect x="-5" y="${n(ya)}" width="${W + 10}" height="${n(1 + r * 0.6)}" fill="#d2bd88" fill-opacity="0.85"/>`;
    }
    for (let k = -16; k <= 16; k++) {
      f += `<line x1="${n(vx + k * 4)}" y1="770" x2="${n(vx + k * 46)}" y2="${H}" stroke="#2f6a2a" stroke-opacity="0.16" stroke-width="1.2"/>`;
    }
    // pokhari
    f += `<ellipse cx="150" cy="912" rx="128" ry="27" fill="${mix(pal.skyBottom, '#4f98b4', 0.5)}" stroke="#d2bd88" stroke-width="3"/>`;
    f += `<path d="M70,908 q24,-5 48,0 M150,918 q26,-5 52,0 M190,903 q16,-4 32,0" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.6" fill="none"/>`;
    for (let i = 0; i < 6; i++) f += `<ellipse cx="${n(70 + rng() * 160)}" cy="${n(905 + rng() * 14)}" rx="9" ry="3.4" fill="#4f9a46"/>`;
    f += `<circle cx="132" cy="909" r="3.6" fill="#f2a6c6"/><circle cx="206" cy="915" r="3.2" fill="#f2a6c6"/>`;
    // Mithila ghar
    const hx = 462;
    const hy = 846;
    f += `<ellipse cx="${hx}" cy="${hy + 2}" rx="92" ry="13" fill="#7fa54a"/>`;
    f += `<rect x="${hx - 36}" y="${hy - 34}" width="72" height="34" fill="#d9a66b"/><rect x="${hx - 36}" y="${hy - 22}" width="72" height="7" fill="#b8442f"/>`;
    for (let i = 0; i < 7; i++) f += `<circle cx="${hx - 31 + i * 10.3}" cy="${hy - 18.5}" r="1.5" fill="#fff"/>`;
    f += `<rect x="${hx - 8}" y="${hy - 14}" width="16" height="14" fill="#5a3a28"/>`;
    f += `<path d="M${hx - 48},${hy - 31} L${hx - 26},${hy - 64} L${hx + 26},${hy - 64} L${hx + 48},${hy - 31} Z" fill="#c9a24a"/>`;
    for (let i = 0; i < 6; i++) f += `<line x1="${hx - 40 + i * 16}" y1="${hy - 33}" x2="${hx - 24 + i * 9.6}" y2="${hy - 63}" stroke="#a07f30" stroke-width="1.3"/>`;
    f += `<path d="M${hx + 62},${hy} q8,-30 16,0 z" fill="#d6b45a"/>`;
    f += palm(hx + 82, hy + 6, 118, '#3f8a3a') + palm(hx - 72, hy + 10, 96, '#3f8a3a');
    // kisan
    f += figure(310, 826, 1.7, '#c0392b', 'conical');
    for (let i = 0; i < 5; i++) f += `<path d="M${n(60 + i * 90 + rng() * 40)},${n(430 + rng() * 60)} q5,-5 10,0 q5,-5 10,0" stroke="#fff" stroke-width="1.5" fill="none"/>`;
    return { mid: m, front: f };
  },

  // Janakpur: Janaki Mandir ra pokhari (ghat)
  janakpur: ({ rng, pal, mid }) => {
    let m = '';
    for (let x = 4; x < W + 20; x += 18 + rng() * 16) m += broadleaf(x, yAt(mid, x) + 6, 44 + rng() * 26, mix(pal.mid, pal.fog, 0.3));
    const temple = (s: number): string => {
      const x = 300;
      const y = 790;
      let t = `<rect x="${n(x - 160 * s)}" y="${n(y - 14 * s)}" width="${n(320 * s)}" height="${n(14 * s)}" fill="#e8d9bd"/>`;
      t += `<rect x="${n(x - 125 * s)}" y="${n(y - 84 * s)}" width="${n(250 * s)}" height="${n(70 * s)}" fill="#f6ecd6"/>`;
      t += `<rect x="${n(x - 152 * s)}" y="${n(y - 56 * s)}" width="${n(40 * s)}" height="${n(42 * s)}" fill="#f1e5cb"/><rect x="${n(x + 112 * s)}" y="${n(y - 56 * s)}" width="${n(40 * s)}" height="${n(42 * s)}" fill="#f1e5cb"/>`;
      t += `<rect x="${n(x - 85 * s)}" y="${n(y - 124 * s)}" width="${n(170 * s)}" height="${n(40 * s)}" fill="#fbf3e0"/>`;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
          const ax = x - 112 * s + c * 28 * s;
          const ay = y - (46 + r * 30) * s;
          t += `<path d="M${n(ax)},${n(ay + 16 * s)} v${n(-10 * s)} a${n(5 * s)},${n(5 * s)} 0 0 1 ${n(10 * s)},0 v${n(10 * s)} Z" fill="#b9a27c"/>`;
        }
      }
      for (let i = 0; i < 18; i++) t += `<path d="M${n(x - 125 * s + i * 14 * s)},${n(y - 84 * s)} l${n(7 * s)},${n(-8 * s)} l${n(7 * s)},${n(8 * s)}Z" fill="#e9b94a"/>`;
      const dome = (cx: number, cy: number, rx: number, ry: number): string =>
        `<path d="M${n(cx - rx)},${n(cy)} A${n(rx)},${n(ry)} 0 0 1 ${n(cx + rx)},${n(cy)} Z" fill="#fdf8ea"/>` +
        `<path d="M${n(cx)},${n(cy - ry)} v${n(-14 * s)}" stroke="#d9a441" stroke-width="${n(2 * s)}"/><circle cx="${n(cx)}" cy="${n(cy - ry - 15 * s)}" r="${n(2.6 * s)}" fill="#d9a441"/>` +
        `<path d="M${n(cx - rx * 0.4)},${n(cy)} Q${n(cx - rx * 0.3)},${n(cy - ry * 0.9)} ${n(cx)},${n(cy - ry)}" stroke="#d9c9a4" stroke-width="1.2" fill="none"/>`;
      t += dome(x, y - 124 * s, 40 * s, 38 * s);
      for (const dx of [-62, 62]) t += dome(x + dx * s, y - 124 * s, 17 * s, 18 * s);
      for (const dx of [-100, 100]) t += dome(x + dx * s, y - 84 * s, 15 * s, 15 * s);
      for (const dx of [-132, 132]) t += dome(x + dx * s, y - 56 * s, 12 * s, 12 * s);
      t += `<path d="M${n(x)},${n(y - 190 * s)} l${n(22 * s)},${n(5 * s)} l${n(-22 * s)},${n(5 * s)}Z" fill="#e8742a"/>`;
      return t;
    };
    const clip = `<clipPath id="PFX-w"><rect x="0" y="852" width="${W}" height="${H - 852}"/></clipPath>`;
    const water =
      `<linearGradient id="PFX-wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(pal.skyBottom, '#e7a98c', 0.4)}"/><stop offset="1" stop-color="#3d5a8c"/></linearGradient>` +
      `<rect x="0" y="852" width="${W}" height="${H - 852}" fill="url(#PFX-wg)"/>`;
    const refl = `<g clip-path="url(#PFX-w)" opacity="0.28"><g transform="translate(0,${2 * 852}) scale(1,-1)">${temple(1)}</g></g>`;
    let g = '';
    for (let i = 0; i < 4; i++) {
      g += `<rect x="${n(10 + i * 6)}" y="${n(842 + i * 4)}" width="${n(W - 20 - i * 12)}" height="4" fill="${i % 2 ? '#d8c9a8' : '#efe3c6'}"/>`;
    }
    for (let i = 0; i < 16; i++) {
      const dx = 30 + i * 36 + rng() * 10;
      g += `<circle cx="${n(dx)}" cy="838" r="6" fill="#ffd36b" fill-opacity="0.35"/><circle cx="${n(dx)}" cy="838" r="2" fill="#ffcf5a"/>`;
    }
    let r2 = '';
    for (let i = 0; i < 12; i++) r2 += `<path d="M${n(30 + rng() * 520)},${n(880 + rng() * 100)} q14,-3 28,0" stroke="#fff" stroke-opacity="0.35" stroke-width="1.4" fill="none"/>`;
    const trees = broadleaf(36, 846, 150, '#4f7d3c') + broadleaf(566, 846, 150, '#4f7d3c');
    return { mid: m, front: clip + water + refl + temple(1) + g + r2 + trees };
  },

  // Lumbini: Maya Devi mandir, Ashoka stambha, pokhari, shanti stupa
  lumbini: ({ rng, pal, mid }) => {
    let m = '';
    for (let x = 4; x < W + 20; x += 20 + rng() * 14) m += broadleaf(x, yAt(mid, x) + 6, 48 + rng() * 30, mix(pal.mid, pal.fog, 0.3));
    m += stupa(120, yAt(mid, 120) + 12, 0.6).replace(/#d9a441/g, '#e0b24c');
    const pond =
      `<clipPath id="PFX-w"><path d="M0,836 L${W},836 L${W},${H} L0,${H}Z"/></clipPath>` +
      `<linearGradient id="PFX-wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(pal.skyBottom, '#8cc7d6', 0.55)}"/><stop offset="1" stop-color="#2f6f8c"/></linearGradient>` +
      `<rect x="0" y="836" width="${W}" height="${H - 836}" fill="url(#PFX-wg)"/>`;
    const temple = (): string => {
      const x = 300;
      const y = 800;
      return (
        `<rect x="${x - 95}" y="${y - 12}" width="190" height="12" fill="#e4dac6"/>` +
        `<rect x="${x - 80}" y="${y - 62}" width="160" height="50" fill="#fbf8f0"/><rect x="${x + 36}" y="${y - 62}" width="44" height="50" fill="#e6dfd0"/>` +
        `<rect x="${x - 86}" y="${y - 70}" width="172" height="9" fill="#efe7d6"/>` +
        `<path d="M${x - 14},${y - 12} v-26 a14,14 0 0 1 28,0 v26Z" fill="#6b4a36"/>` +
        `<path d="M${x - 60},${y - 12} v-20 a8,8 0 0 1 16,0 v20Z M${x + 44},${y - 12} v-20 a8,8 0 0 1 16,0 v20Z" fill="#bfae92"/>` +
        `<rect x="${x - 40}" y="${y - 84}" width="80" height="14" fill="#f5efe1"/><path d="M${x - 8},${y - 84} l8,-14 l8,14Z" fill="#d9a441"/>`
      );
    };
    const pillar =
      `<path d="M424,800 L426,640 L434,640 L436,800Z" fill="#c4b196"/><path d="M430,800 L432,640 L434,640 L436,800Z" fill="#a89578"/>` +
      `<rect x="421" y="636" width="18" height="6" fill="#b9a587"/><rect x="415" y="796" width="26" height="6" fill="#9c8a6e"/>`;
    let lotus = '';
    for (let i = 0; i < 9; i++) {
      const lx = 40 + rng() * 520;
      const ly = 860 + rng() * 120;
      lotus += `<ellipse cx="${n(lx)}" cy="${n(ly)}" rx="${n(10 + rng() * 6)}" ry="3.6" fill="#4f9a46"/>`;
      if (i % 3 === 0) lotus += `<circle cx="${n(lx + 2)}" cy="${n(ly - 3)}" r="3.4" fill="#f4a9c8"/><circle cx="${n(lx + 2)}" cy="${n(ly - 4)}" r="1.6" fill="#ffe5ef"/>`;
    }
    const refl = `<g clip-path="url(#PFX-w)" opacity="0.3"><g transform="translate(0,${2 * 836}) scale(1,-1)">${temple()}${pillar}</g></g>`;
    const mound = `<path d="M-10,836 Q150,812 300,822 T610,826 L610,846 L-10,846Z" fill="${pal.near}"/>`;
    const trees = broadleaf(40, 842, 170, '#548f45') + broadleaf(560, 842, 160, '#548f45') + pine(500, 840, 120, '#3f7d3c');
    const f = pond + refl + mound + temple() + pillar + lotus + trees + flagsLine(436, 650, 540, 760, 8, 14) + figure(232, 846, 1.5, '#e0782a', 'cap');
    return { mid: m, front: f };
  },

  // Chitwan: sal ko jungle, nadi, gaida
  jungle: ({ rng, pal, mid, near }) => {
    let m = '';
    for (let layer = 0; layer < 2; layer++) {
      const col = layer === 0 ? mix(pal.mid, pal.fog, 0.45) : pal.mid;
      for (let x = -10; x < W + 20; x += (layer === 0 ? 24 : 34) + rng() * 16) {
        const y = yAt(mid, x) + 16 + layer * 8;
        const h = 150 + rng() * 120 + layer * 40;
        m += `<rect x="${n(x - 4)}" y="${n(y - h)}" width="${n(7 + layer * 2)}" height="${n(h)}" fill="${darken(col, 0.5)}"/>`;
        for (let k = 0; k < 5; k++) {
          m += `<circle cx="${n(x + (rng() - 0.5) * 56)}" cy="${n(y - h + (rng() - 0.3) * 40)}" r="${n(26 + rng() * 24)}" fill="${k % 2 ? col : darken(col, 0.12)}"/>`;
        }
      }
    }
    m += `<path d="M0,690 Q300,650 600,700 L600,760 L0,760Z" fill="${pal.fog}" fill-opacity="0.35"/>`;
    const river =
      `<linearGradient id="PFX-wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb6a4"/><stop offset="1" stop-color="#4c7a72"/></linearGradient>` +
      `<path d="M262,770 C250,800 330,820 250,880 C200,925 300,950 250,1000 L560,1000 C470,950 520,910 420,870 C350,840 350,800 330,770Z" fill="url(#PFX-wg)"/>`;
    let glint = '';
    for (let i = 0; i < 10; i++) glint += `<path d="M${n(280 + rng() * 220)},${n(800 + i * 20 + rng() * 10)} q12,-2 24,0" stroke="#fff" stroke-opacity="0.5" stroke-width="1.6" fill="none"/>`;
    let grass = '';
    for (let c = 0; c < 26; c++) {
      const gx = c < 13 ? 10 + rng() * 240 : 340 + rng() * 260;
      const gy = yAt(near, gx) + 24 + rng() * 120;
      const gh = 40 + rng() * 60;
      for (let b = 0; b < 8; b++) {
        const dx = (b - 3.5) * 5;
        grass += `<path d="M${n(gx + dx * 0.4)},${n(gy)} Q${n(gx + dx)},${n(gy - gh * 0.6)} ${n(gx + dx * 2.2)},${n(gy - gh)}" stroke="${b % 2 ? '#b9c668' : '#8fa845'}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      }
    }
    const mist = `<rect x="0" y="780" width="${W}" height="90" fill="${pal.fog}" fill-opacity="0.18"/>`;
    return { mid: m, front: river + glint + grass + rhino(488, 928, 1.7) + mist };
  },

  // Pokhara: Phewa Tal, Machhapuchhre, dunga, paraglider
  lake: ({ rng, pal, p, mid }) => {
    const cx = 330;
    const baseY = 690;
    const topY = 330;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const half = 140 * (1 - Math.pow(t, 1.25));
      left.push({ x: cx - half + (rng() - 0.5) * 10 * (1 - t), y: baseY + (topY - baseY) * t });
      right.push({ x: cx + half + (rng() - 0.5) * 10 * (1 - t), y: baseY + (topY - baseY) * t });
    }
    const outline: Pt[] = [...left.slice(0, 13), { x: cx - 16, y: topY + 6 }, { x: cx - 4, y: topY + 34 }, { x: cx + 9, y: topY }, { x: cx + 22, y: topY + 20 }, ...right.slice(0, 13).reverse()];
    const pts = outline.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
    const fish =
      `<linearGradient id="${p}-fg" gradientUnits="userSpaceOnUse" x1="0" y1="${topY}" x2="0" y2="${baseY}"><stop offset="0" stop-color="${pal.snow}"/><stop offset="0.55" stop-color="${pal.snow}"/><stop offset="0.7" stop-color="#8a9db8"/><stop offset="1" stop-color="${mix(pal.far, pal.fog, 0.5)}"/></linearGradient>` +
      `<polygon points="${pts}" fill="url(#${p}-fg)"/>` +
      `<polygon points="${n(cx + 9)},${topY} ${right.slice(0, 13).map((q) => `${n(q.x)},${n(q.y)}`).join(' ')} ${cx + 10},${baseY} ${n(cx - 4)},${n(topY + 34)}" fill="#10182e" fill-opacity="0.22"/>`;
    const waterTop = 712;
    const waterPath = `M0,${waterTop} L${W},${waterTop} L${W},${H} L0,${H}Z`;
    const lakeDef =
      `<clipPath id="${p}-lk"><path d="${waterPath}"/></clipPath>` +
      `<linearGradient id="${p}-lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9cde9"/><stop offset="1" stop-color="#2c6aa0"/></linearGradient>` +
      `<path d="${waterPath}" fill="url(#${p}-lg)"/>` +
      `<g clip-path="url(#${p}-lk)" opacity="0.32"><use href="#${p}-mtn" transform="translate(0,${2 * waterTop}) scale(1,-1)"/></g>`;
    let ripples = '';
    for (let i = 0; i < 16; i++) ripples += `<path d="M${n(20 + rng() * 540)},${n(730 + rng() * 240)} q16,-3 32,0" stroke="#fff" stroke-opacity="0.4" stroke-width="1.4" fill="none"/>`;
    const island =
      `<ellipse cx="330" cy="806" rx="44" ry="9" fill="#4a8a4a"/><rect x="316" y="790" width="28" height="14" fill="#f4eee0"/>` +
      `<path d="M312,792 L322,780 L338,780 L348,792Z" fill="#b8442f"/><path d="M320,780 L330,770 L340,780Z" fill="#d9a441"/>`;
    const boats = boat(160, 905, 1.5, '#2a62a8', '#f2c12e') + boat(430, 870, 1.0, '#c0392b', '#ffffff') + boat(250, 800, 0.7, '#2e8b57', '#f2c12e');
    const sky = paraglider(110, 300, 1.2, '#e8472f', '#f2c12e') + paraglider(470, 230, 0.9, '#2f6fd6', '#ffffff');
    return { back: fish + sky, mid: lakeDef + ripples + island + boats };
  },

  // Gorkha: Gorkha Durbar, pahadi kheti
  fort: ({ rng, pal, p, mid }) => {
    let m = `<clipPath id="${p}-mc"><path d="${poly(mid)}"/></clipPath><g clip-path="url(#${p}-mc)" fill="none" stroke-width="2.2">`;
    for (let k = 0; k < 10; k++) {
      m += `<polyline points="${mid.map((q) => `${n(q.x)},${n(q.y)}`).join(' ')}" transform="translate(0,${k * 14})" stroke="${k % 2 ? lighten(pal.mid, 0.22) : darken(pal.mid, 0.16)}" stroke-opacity="0.75"/>`;
    }
    m += '</g>';
    for (let i = 0; i < 9; i++) {
      const x = 40 + rng() * 520;
      m += flatHouse(x, yAt(mid, x) + 16 + rng() * 20, 14 + rng() * 8, 10 + rng() * 5, '#f0e6d2', '#b0452a');
    }
    const fx = 350;
    const fy = yAt(mid, fx) + 6;
    let fort = `<path d="M${fx - 80},${fy} L${fx - 70},${fy - 14} L${fx + 80},${fy - 14} L${fx + 90},${fy}Z" fill="#cdbf9e"/>`;
    fort += `<rect x="${fx - 70}" y="${fy - 50}" width="140" height="36" fill="#f3e9d2"/><rect x="${fx - 70}" y="${fy - 50}" width="140" height="6" fill="#d9c9a4"/>`;
    fort += `<path d="M${fx - 78},${fy - 50} L${fx - 52},${fy - 74} L${fx + 52},${fy - 74} L${fx + 78},${fy - 50}Z" fill="#a8452a"/>`;
    fort += `<rect x="${fx - 20}" y="${fy - 98}" width="40" height="48" fill="#f7eedb"/><path d="M${fx - 28},${fy - 98} L${fx},${fy - 122} L${fx + 28},${fy - 98}Z" fill="#8c3622"/>`;
    for (let i = 0; i < 8; i++) fort += `<rect x="${fx - 62 + i * 17}" y="${fy - 40}" width="8" height="12" fill="#6b4a36"/>`;
    for (let i = 0; i < 3; i++) fort += `<rect x="${fx - 12 + i * 11}" y="${fy - 88}" width="6" height="10" fill="#6b4a36"/>`;
    fort += `<rect x="${fx + 56}" y="${fy - 112}" width="2" height="40" fill="#2b2320"/><path d="M${fx + 58},${fy - 112} l22,5 l-22,7Z" fill="#c0392b"/>`;
    fort += `<path d="M${fx - 40},${fy} Q${fx - 90},${fy + 24} ${fx - 70},${fy + 56} T${fx - 110},${fy + 100}" stroke="#d9c9a4" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    let f = '';
    for (const x of [30, 90, 520, 574]) f += pine(x, yAt(mid, x) + 80, 80 + rng() * 30, '#3d6b34');
    f += flagsLine(60, 770, 230, 790, 9, 14);
    return { mid: m + fort, front: f };
  },

  // Kathmandu: Swayambhunath ra pagoda
  city: ({ rng, pal, mid, near }) => {
    const fog = pal.fog;
    const walls = ['#8a5a44', '#a06a50', '#c9a27a', '#b98b66'].map((c) => mix(c, fog, 0.3));
    let m = '';
    for (let x = 10; x < W; x += 14 + rng() * 14) {
      const w = 14 + rng() * 16;
      const h = 18 + rng() * 40;
      const y = yAt(mid, x) + 8;
      m += `<rect x="${n(x)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" fill="${at(walls, Math.floor(rng() * 4))}"/>`;
      m += `<rect x="${n(x)}" y="${n(y - h)}" width="${n(w)}" height="2.5" fill="${darken(at(walls, 0), 0.25)}"/>`;
    }
    m += pagoda(150, yAt(mid, 150) + 10, 0.9, mix('#c9a27a', fog, 0.3), mix('#6b3a2b', fog, 0.25), '#d9a441');
    m += pagoda(350, yAt(mid, 350) + 10, 0.7, mix('#c9a27a', fog, 0.35), mix('#6b3a2b', fog, 0.3), '#d9a441');
    let f = stupa(430, yAt(near, 430) + 10, 1.35);
    for (const x of [50, 105, 540]) f += broadleaf(x, yAt(near, x) + 12, 60 + rng() * 20, pal.near);
    return { mid: m, front: f };
  },

  // Namche: sidhi parera banaeko Sherpa gaun
  town: ({ rng, pal, mid, near }) => {
    let m = '';
    for (let i = 0; i < 6; i++) {
      const y = 650 + i * 22;
      const col = i % 2 ? mix(pal.mid, '#c9b36a', 0.35) : mix(pal.mid, '#7a8a4a', 0.4);
      m += `<path d="M-20,${y} Q300,${y - 22 - i * 3} 620,${y} L620,${y + 24} L-20,${y + 24} Z" fill="${col}" fill-opacity="0.9"/>`;
    }
    const roofs = ['#2f6fd6', '#c0392b', '#2e8b57', '#2f6fd6'];
    for (let r = 0; r < 5; r++) {
      const y = 672 + r * 24;
      const s = 0.8 + r * 0.13;
      const count = 5 + r;
      for (let i = 0; i < count; i++) {
        const x = 40 + i * (520 / count) + rng() * 10;
        m += house(x, y, 15 * s, 11 * s, '#ece4d4', at(roofs, (i + r) % 4));
      }
    }
    let f = flagsLine(70, 790, 250, 770, 9, 14);
    for (const x of [40, 560]) f += pine(x, yAt(near, x) + 22, 75, pal.near);
    return { mid: m, front: f };
  },

  // Mustang: ranga-biranga cliff, Lo Manthang, ghoda
  mustang: ({ rng, pal, p, mid, near }) => {
    const cliffPts = jagged(rng, 760, 330, 5, 0.62);
    const bands = ['#c0613a', '#d99a5e', '#e8c58f', '#b4503a', '#d98f55', '#efd5a6', '#a8482f', '#cf8a52'];
    let stops = '';
    const nb = 15;
    for (let i = 0; i < nb; i++) {
      const c = at(bands, i % bands.length);
      stops += `<stop offset="${(i / nb).toFixed(3)}" stop-color="${c}"/><stop offset="${((i + 1) / nb).toFixed(3)}" stop-color="${c}"/>`;
    }
    const dir = cliffPts.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
    let facets = '';
    for (let i = 1; i < cliffPts.length - 1; i++) {
      const a = at(cliffPts, i - 1);
      const P = at(cliffPts, i);
      const b = at(cliffPts, i + 1);
      if (P.y < a.y && P.y <= b.y) facets += `<path d="M${n(P.x)},${n(P.y)} L${n(b.x)},${n(b.y)} L${n(P.x + 26)},760 L${n(P.x + 4)},760Z"/>`;
    }
    const back =
      `<linearGradient id="${p}-cg" gradientUnits="userSpaceOnUse" x1="0" y1="430" x2="0" y2="760">${stops}</linearGradient>` +
      `<clipPath id="${p}-cc"><path d="${poly(cliffPts, 760)}"/></clipPath>` +
      `<path d="${poly(cliffPts, 760)}" fill="url(#${p}-cg)"/>` +
      `<g clip-path="url(#${p}-cc)" fill="#3a1d12" fill-opacity="0.28">${facets}</g>` +
      `<polyline points="${dir}" fill="none" stroke="#fff3df" stroke-opacity="0.4" stroke-width="1.2"/>` +
      `<rect x="0" y="690" width="${W}" height="70" fill="${pal.fog}" fill-opacity="0.25"/>`;
    // Lo Manthang
    const tx = 300;
    const ty = yAt(mid, tx) + 14;
    let town = `<rect x="${tx - 130}" y="${ty - 36}" width="260" height="36" fill="#d9a86c"/><rect x="${tx - 130}" y="${ty - 36}" width="260" height="5" fill="#ecc690"/>`;
    for (let i = 0; i < 20; i++) town += `<rect x="${tx - 130 + i * 13}" y="${ty - 41}" width="7" height="5" fill="#d9a86c"/>`;
    for (let i = 0; i < 9; i++) {
      const hx = tx - 112 + i * 25;
      const hh = 14 + (i % 3) * 7;
      town += `<rect x="${hx}" y="${ty - 36 - hh}" width="20" height="${hh}" fill="${i % 2 ? '#e3b982' : '#cf9a5e'}"/><rect x="${hx + 6}" y="${ty - 36 - hh + 4}" width="5" height="7" fill="#5a3a28"/>`;
    }
    town += `<rect x="${tx + 20}" y="${ty - 84}" width="60" height="48" fill="#f4eee0"/><rect x="${tx + 20}" y="${ty - 66}" width="60" height="9" fill="#b8352a"/>`;
    town += `<rect x="${tx + 16}" y="${ty - 90}" width="68" height="7" fill="#c0392b"/><path d="M${tx + 40},${ty - 90} l10,-10 l10,10Z" fill="#d9a441"/>`;
    town += chorten(tx - 160, ty + 2, 1.5, '#b8352a') + chorten(tx + 170, ty + 4, 1.2, '#b8352a');
    for (const [px, ps] of [[tx - 140, 56], [tx - 116, 44], [tx + 140, 50], [tx + 112, 40]] as const) {
      town += `<rect x="${px - 2}" y="${ty - ps}" width="4" height="${ps}" fill="#6b4a36"/>`;
      for (let k = 0; k < 4; k++) town += `<circle cx="${px + (k % 2 ? 6 : -6)}" cy="${ty - ps + 5 + k * 9}" r="${8 - k}" fill="${k % 2 ? '#e8c53a' : '#d9a92e'}"/>`;
    }
    let f = '';
    f += `<path d="M180,${H} C250,900 330,860 420,820 C490,790 550,800 610,780 L610,${H}Z" fill="#cdbb9c" fill-opacity="0.8"/>`;
    for (let i = 0; i < 10; i++) f += boulder(15 + rng() * 570, yAt(near, 300) + 40 + rng() * 120, 8 + rng() * 22, darken(pal.near, 0.1 + rng() * 0.25));
    f += `<rect x="30" y="836" width="150" height="13" fill="#bfa27c"/><rect x="30" y="836" width="150" height="3" fill="#d9c09a"/>`;
    for (let i = 0; i < 6; i++) f += `<rect x="${36 + i * 24}" y="838" width="16" height="9" fill="${i % 2 ? '#a8896a' : '#cdb08a'}"/>`;
    f += flagsLine(20, 836, 190, 790, 9, 12);
    f += horseRider(430, 928, 1.5);
    return { back, mid: town, front: f };
  },

  // Sagarmatha: sabai bhanda mathi, bihana ko ujyalo
  summit: ({ rng, pal, p }) => {
    const cx = 330;
    const baseY = 840;
    const topY = 300;
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const half = 230 * (1 - Math.pow(t, 1.12));
      L.push({ x: cx - half + (rng() - 0.5) * 16 * (1 - t), y: baseY + (topY - baseY) * t });
      R.push({ x: cx + half + (rng() - 0.5) * 16 * (1 - t), y: baseY + (topY - baseY) * t });
    }
    const outline = [...L, ...R.slice().reverse()].map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
    const shadeSide = [{ x: cx, y: topY }, ...R, { x: cx - 30, y: baseY }].map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
    let ridges = '';
    for (let k = 0; k < 3; k++) {
      const a = at(L, 4 + k * 3);
      ridges += `<path d="M${n(cx + 4)},${topY + 4} L${n(a.x + 30)},${n(a.y)}" stroke="#8d93c8" stroke-opacity="0.45" stroke-width="1.6" fill="none"/>`;
    }
    // kala chattan ko patti (Everest ko mathi dark rock dekhinchha)
    let rockBands = '';
    for (let k = 0; k < 6; k++) {
      const a = at(R, 2 + k * 2);
      rockBands += `<path d="M${n(a.x - 70 + k * 6)},${n(a.y + 8)} l${n(34 + rng() * 16)},${n(-6)} l${n(-8)},${n(30 + rng() * 26)} Z" fill="#3a3f78" fill-opacity="0.34"/>`;
    }
    const peak =
      `<linearGradient id="${p}-pk" gradientUnits="userSpaceOnUse" x1="0" y1="${topY}" x2="0" y2="${baseY}"><stop offset="0" stop-color="#fff3ea"/><stop offset="0.6" stop-color="#e8d4dc"/><stop offset="1" stop-color="#8f9ccb"/></linearGradient>` +
      `<polygon points="${outline}" fill="url(#${p}-pk)"/><polygon points="${shadeSide}" fill="#2a3470" fill-opacity="0.32"/>` + rockBands + ridges;
    let plume = `<radialGradient id="${p}-pl"><stop offset="0" stop-color="#fff5ee" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd9e0" stop-opacity="0"/></radialGradient>`;
    for (let i = 0; i < 7; i++) plume += `<ellipse cx="${n(cx + 20 + i * 34)}" cy="${n(topY - 4 - i * 9)}" rx="${n(34 + i * 4)}" ry="${n(8 + i * 1.4)}" fill="url(#${p}-pl)" opacity="${(0.9 - i * 0.1).toFixed(2)}"/>`;
    let sea = `<radialGradient id="${p}-sea"><stop offset="0" stop-color="#fff3f0" stop-opacity="0.98"/><stop offset="0.7" stop-color="#f5c9c6" stop-opacity="0.7"/><stop offset="1" stop-color="#e8a6a8" stop-opacity="0"/></radialGradient>`;
    for (let i = 0; i < 16; i++) sea += `<ellipse cx="${n(-20 + i * 42 + rng() * 16)}" cy="${n(770 + rng() * 70)}" rx="${n(70 + rng() * 40)}" ry="${n(20 + rng() * 16)}" fill="url(#${p}-sea)"/>`;
    let ridge =
      `<linearGradient id="${p}-rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2e8"/><stop offset="1" stop-color="#a9b4e4"/></linearGradient>` +
      `<path d="M-20,${H} L-20,900 L90,860 L180,876 L290,812 L360,846 L470,830 L620,880 L620,${H}Z" fill="url(#${p}-rg)"/>` +
      `<path d="M290,812 L360,846 L470,830 L620,880 L620,${H} L400,${H} L380,900Z" fill="#2a3470" fill-opacity="0.28"/>`;
    for (let i = 0; i < 6; i++) ridge += `<path d="M${n(30 + rng() * 540)},${n(900 + rng() * 80)} q30,-6 60,0" stroke="#fff" stroke-opacity="0.45" stroke-width="1.6" fill="none"/>`;
    const summitFlag =
      `<rect x="289" y="750" width="3" height="64" fill="#2b2320"/><path d="M292,750 l30,6 l-30,10Z" fill="#c0392b"/>` +
      flagsLine(291, 756, 130, 872, 10, 10) + flagsLine(291, 756, 470, 828, 10, 10);
    const climbers = figure(410, 836, 1.7, '#e0553a', 'helmet') + figure(380, 850, 1.7, '#f2a42e', 'helmet') + `<path d="M410,818 Q395,836 380,832" stroke="#2b2320" stroke-width="0.9" fill="none"/>`;
    return { back: peak + plume + sea, front: ridge + summitFlag + climbers };
  },
};

// ---------- layout per scene ----------
interface Layout { horizon: number; midBase: number; midAmp: number; nearBase: number; nearAmp: number; hills: boolean }
const LAYOUT: Record<SceneKind, Layout> = {
  paddy: { horizon: 665, midBase: 735, midAmp: 45, nearBase: 850, nearAmp: 25, hills: true },
  janakpur: { horizon: 675, midBase: 745, midAmp: 40, nearBase: 880, nearAmp: 25, hills: true },
  lumbini: { horizon: 665, midBase: 745, midAmp: 45, nearBase: 870, nearAmp: 30, hills: true },
  jungle: { horizon: 655, midBase: 740, midAmp: 60, nearBase: 850, nearAmp: 45, hills: true },
  lake: { horizon: 670, midBase: 705, midAmp: 30, nearBase: 950, nearAmp: 40, hills: true },
  fort: { horizon: 610, midBase: 730, midAmp: 110, nearBase: 855, nearAmp: 70, hills: true },
  city: { horizon: 580, midBase: 735, midAmp: 95, nearBase: 835, nearAmp: 70, hills: true },
  town: { horizon: 580, midBase: 735, midAmp: 95, nearBase: 835, nearAmp: 70, hills: true },
  mustang: { horizon: 620, midBase: 745, midAmp: 55, nearBase: 855, nearAmp: 55, hills: true },
  summit: { horizon: 700, midBase: 740, midAmp: 40, nearBase: 880, nearAmp: 30, hills: false },
};

const cache = new Map<string, string>();

/**
 * Ek thau ko SVG background. `prefix` har SVG ko id alag rakhna (ek page ma dherai SVG).
 * banner=true: mathi ko bhag matra (game screen ko suru ma dekhaune).
 */
export function buildScenery(ch: Chapter, prefix: string, opts: { banner?: boolean } = {}): string {
  const key = `${prefix}|${opts.banner ? 'b' : 'm'}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const { palette: pal, scene } = ch.theme;
  const rng = makeRng(seedOf(`scenery|${ch.place}`));
  const lay = LAYOUT[scene.kind];
  const p = prefix;
  const sunLeft = scene.sun ? scene.sun.x < 0.5 : false;
  const rim = scene.sun ? mix(pal.sun, '#ffffff', 0.3) : lighten(pal.far, 0.35);
  const parts: string[] = [];

  parts.push(
    `<linearGradient id="${p}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.skyTop}"/>` +
      `<stop offset="0.4" stop-color="${mix(pal.skyTop, pal.skyBottom, 0.55)}"/><stop offset="0.62" stop-color="${pal.skyBottom}"/>` +
      `<stop offset="1" stop-color="${pal.skyBottom}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#${p}-sky)"/>`,
  );

  if (scene.stars > 0) {
    let s = '';
    for (let i = 0; i < Math.round(scene.stars * 140); i++) {
      const y = rng() * 480;
      s += `<circle cx="${n(rng() * W)}" cy="${n(y)}" r="${n(0.5 + rng() * 0.9)}" fill="#ffffff" fill-opacity="${((0.9 - y / 700) * (0.4 + rng() * 0.6)).toFixed(2)}"/>`;
    }
    parts.push(s);
  }

  if (scene.sun) {
    const sx = scene.sun.x * W;
    const sy = scene.sun.y * H;
    parts.push(
      `<radialGradient id="${p}-sun"><stop offset="0" stop-color="${pal.sun}" stop-opacity="0.95"/><stop offset="0.22" stop-color="${pal.sun}" stop-opacity="0.5"/>` +
        `<stop offset="1" stop-color="${pal.sun}" stop-opacity="0"/></radialGradient>` +
        `<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(scene.sun.r * 7)}" fill="url(#${p}-sun)"/><circle cx="${n(sx)}" cy="${n(sy)}" r="${n(scene.sun.r)}" fill="${pal.sun}"/>`,
    );
  }

  if (scene.clouds > 0) parts.push(cloudsSvg(p, rng, scene.clouds, mix('#ffffff', pal.skyBottom, 0.3)));

  const far = jagged(rng, lay.horizon, scene.farAmp, 6, 0.56);
  const farRock = mix(pal.far, pal.fog, scene.mist * 0.35);
  const second = jagged(rng, lay.horizon + 70, scene.farAmp * 0.42, 6, 0.5);
  const secRock = mix(mix(pal.far, pal.mid, 0.5), pal.fog, scene.mist * 0.2);
  parts.push(
    `<g id="${p}-mtn">` +
      mountainLayer(`${p}-far`, far, farRock, pal.snow, scene.snow, rim, lay.horizon + 70, sunLeft, 0.3, mix(farRock, pal.fog, 0.7)) +
      haze(`${p}-h1`, lay.horizon - scene.farAmp * 0.5, lay.horizon + 30, pal.fog, scene.mist * 0.55) +
      mountainLayer(`${p}-sec`, second, secRock, pal.snow, scene.snow * 0.45, rim, lay.horizon + 130, sunLeft, 0.26, mix(secRock, pal.fog, 0.55)) +
      haze(`${p}-h2`, lay.horizon + 20, lay.horizon + 110, pal.fog, scene.mist * 0.5) +
      `</g>`,
  );

  const mid = rolling(rng, lay.midBase, lay.midAmp);
  const near = rolling(rng, lay.nearBase, lay.nearAmp);
  const built = BUILDERS[scene.kind]({ rng, pal, p, mid, near });
  const fix = (s: string | undefined): string => (s ?? '').replace(/PFX-/g, `${p}-`);

  parts.push(fix(built.back));
  if (lay.hills) {
    parts.push(
      `<linearGradient id="${p}-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(pal.mid, pal.fog, scene.mist * 0.25)}"/><stop offset="1" stop-color="${darken(pal.mid, 0.3)}"/></linearGradient>` +
        `<path d="${poly(mid)}" fill="url(#${p}-mid)"/>`,
    );
  }
  parts.push(fix(built.mid));
  parts.push(haze(`${p}-h3`, 640, 780, pal.fog, scene.mist * 0.35));
  if (lay.hills) {
    parts.push(
      `<linearGradient id="${p}-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.near}"/><stop offset="1" stop-color="${pal.ground}"/></linearGradient>` +
        `<path d="${poly(near)}" fill="url(#${p}-near)"/>`,
    );
  }
  parts.push(fix(built.front));

  if (!opts.banner) {
    parts.push(
      `<linearGradient id="${p}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a18" stop-opacity="0"/><stop offset="1" stop-color="#050a18" stop-opacity="0.34"/></linearGradient>` +
        `<rect x="0" y="700" width="${W}" height="300" fill="url(#${p}-shade)"/>`,
    );
  }

  const view = opts.banner ? `0 330 ${W} 330` : `0 0 ${W} ${H}`;
  const par = opts.banner ? 'xMidYMid slice' : 'xMidYMax slice';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" preserveAspectRatio="${par}" role="img" aria-label="${ch.place}">${parts.join('')}</svg>`;
  cache.set(key, svg);
  return svg;
}
