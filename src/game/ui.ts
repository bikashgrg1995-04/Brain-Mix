import { DIFFICULTY, type Tile, type WordEntry } from '../../shared/types';
import { evaluate, isWin } from '../../shared/evaluate';
import { normalizeExact } from '../../shared/normalize';
import { xpFor } from '../../shared/xp';
import type { PlatformAdapter } from '../platform/adapter';
import type { Filter } from './home';
import { ALLOW_ANY_GUESS, WORDS } from './words';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const EMOJI: Record<Tile, string> = { green: '🟩', yellow: '🟨', grey: '⬜' };
const RANK: Record<Tile, number> = { grey: 0, yellow: 1, green: 2 };

export interface GameOptions {
  mode: 'practice' | 'daily' | 'level';
  filter: Filter;
  target?: WordEntry; // daily ma fixed
  level?: { index: number; label: string; hint: 'full' | 'category' | 'none'; firstClear: boolean };
  onNext?: () => void;
  onExit(): void;
  onFinish(r: { won: boolean; tries: number; xp: number }): void;
}

export function mountGame(root: HTMLElement, platform: PlatformAdapter, opt: GameOptions): () => void {
  let last = ''; // st banda aagadi (pick() le use garchha)
  const daily = opt.mode === 'daily';
  const lv = opt.level;
  const fixed = opt.mode !== 'practice'; // daily/level ma word fixed
  const st = {
    target: opt.target ?? pick(),
    maxTries: 6,
    guesses: [] as string[],
    results: [] as Tile[][],
    current: '',
    over: false,
    won: false,
    keyState: {} as Record<string, Tile>,
    message: '',
  };

  function pick(): WordEntry {
    const pool = WORDS.filter((w) => (opt.filter === 0 || w.difficulty === opt.filter) && w.answer !== last);
    const w = pool[Math.floor(Math.random() * pool.length)] ?? WORDS[0]!;
    last = w.answer;
    return w;
  }

  function reset(): void {
    st.target = fixed ? st.target : pick();
    st.maxTries = DIFFICULTY[st.target.difficulty].maxTries;
    Object.assign(st, { guesses: [], results: [], current: '', over: false, won: false, keyState: {}, message: '' });
    render();
  }

  function flash(msg: string): void { st.message = msg; render(); }

  function submit(): void {
    if (st.over) return;
    const len = st.target.answer.length;
    const g = normalizeExact(st.current);
    if (g.length !== len) return flash(`${len} akshar chahinchha`);
    if (!ALLOW_ANY_GUESS) return flash('Shabda list ma chhaina'); // Phase 2: server check
    if (st.guesses.includes(g)) return flash('Already guessed');
    const tiles = evaluate(g, st.target.answer);
    st.guesses.push(g);
    st.results.push(tiles);
    g.split('').forEach((ch, i) => {
      const t = tiles[i]!;
      const prev = st.keyState[ch];
      if (!prev || RANK[t] > RANK[prev]) st.keyState[ch] = t;
    });
    st.current = '';
    if (isWin(tiles)) {
      st.over = st.won = true;
      const full = xpFor(st.guesses.length, st.target.difficulty);
      const xp = lv && !lv.firstClear ? 0 : full; // level replay ma XP hudaina
      st.message = xp > 0 ? `Sahi! +${xp} XP` : 'Sahi!';
      opt.onFinish({ won: true, tries: st.guesses.length, xp });
    } else if (st.guesses.length >= st.maxTries) {
      st.over = true;
      st.message = `Shabda thiyo: ${st.target.answer}`;
      opt.onFinish({ won: false, tries: st.guesses.length, xp: 0 });
    }
    render();
  }

  function press(k: string): void {
    if (st.over) return;
    if (k === 'enter') return submit();
    if (k === 'back') st.current = st.current.slice(0, -1);
    else if (/^[a-z]$/.test(k) && st.current.length < st.target.answer.length) st.current += k;
    st.message = '';
    render();
  }

  function shareGrid(): string {
    const score = st.won ? `${st.guesses.length}/${st.maxTries}` : `X/${st.maxTries}`;
    return `Shabda ${st.target.answer.length} akshar, ${DIFFICULTY[st.target.difficulty].name} ${score}\n` +
      st.results.map((r) => r.map((t) => EMOJI[t]).join('')).join('\n');
  }

  function render(): void {
    const len = st.target.answer.length;
    const d = DIFFICULTY[st.target.difficulty];
    const rows: string[] = [];
    for (let r = 0; r < st.maxTries; r++) {
      const done = st.results[r];
      const typing = r === st.guesses.length && !st.over;
      let cells = '';
      for (let c = 0; c < len; c++) {
        const ch = done ? st.guesses[r]![c]! : typing ? st.current[c] ?? '' : '';
        cells += `<div class="tile ${done ? done[c]! : ch ? 'filled' : ''}">${ch}</div>`;
      }
      rows.push(`<div class="row">${cells}</div>`);
    }
    const keys = ROWS.map((row, i) => {
      const btns = row.split('').map((k) => `<button class="key ${st.keyState[k] ?? ''}" data-k="${k}">${k}</button>`).join('');
      const pre = i === 2 ? '<button class="key wide" data-k="enter">Enter</button>' : '';
      const post = i === 2 ? '<button class="key wide" data-k="back" aria-label="Backspace">⌫</button>' : '';
      return `<div class="krow">${pre}${btns}${post}</div>`;
    }).join('');
    let extra = '';
    if (!daily) {
      if (!lv) extra = '<button id="next" class="primary">Naya shabda</button>';
      else if (!st.won) extra = '<button id="next" class="primary">Feri khel</button>';
      else if (opt.onNext) extra = '<button id="go" class="primary">Agaadi</button>';
    }
    const after = st.over ? `<div class="after"><button id="share" class="secondary">Share grid</button>${extra}</div>` : '';
    const title = daily ? 'Aaja ko Shabda' : lv ? `Level ${lv.index + 1}` : 'Practice';
    const sub = lv ? `${lv.label} · ${d.name} · ${len} akshar` : `${d.name} · ${len} akshar · ${st.maxTries} try`;
    const hl = lv?.hint ?? 'full';
    const clue = hl === 'none'
      ? '<p class="clue">Hint chhaina</p>'
      : `<p class="clue"><b>${st.target.category}</b>${hl === 'full' ? st.target.hint ?? '' : ''}</p>`;
    root.innerHTML = `
      <div class="flags" aria-hidden="true"></div>
      <div class="game">
        <header class="gbar">
          <button id="back" class="icon" aria-label="Home">←</button>
          <div class="gtitle"><b>${title}</b><span>${sub}</span></div>
          <span class="pill">${st.guesses.length}/${st.maxTries}</span>
        </header>
        ${clue}
        <main class="board" style="--cols:${len}">${rows.join('')}</main>
        <p class="msg" role="status">${st.message || '&nbsp;'}</p>
        ${after}
        <section class="kb">${keys}</section>
      </div>`;
    root.querySelectorAll<HTMLButtonElement>('.key').forEach((b) => (b.onclick = () => press(b.dataset.k!)));
    root.querySelector<HTMLButtonElement>('#back')!.onclick = () => opt.onExit();
    root.querySelector<HTMLButtonElement>('#next')?.addEventListener('click', reset);
    root.querySelector<HTMLButtonElement>('#go')?.addEventListener('click', () => opt.onNext?.());
    root.querySelector<HTMLButtonElement>('#share')?.addEventListener('click', async () => {
      const r = await platform.shareText(shareGrid());
      flash(r === 'copied' ? 'Grid copy bhayo' : r === 'shared' ? 'Share bhayo' : 'Share garna sakiena');
    });
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') press('enter');
    else if (e.key === 'Backspace') press('back');
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKey);

  st.maxTries = DIFFICULTY[st.target.difficulty].maxTries;
  render();
  return () => window.removeEventListener('keydown', onKey);
}
