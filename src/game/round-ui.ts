import { evaluate } from '../../shared/evaluate';
import { normalizeExact } from '../../shared/normalize';
import { RUSH_WORDS, photoStars, roundXp, rushFraction, rushStars, timedStars, wordPoints, WORD_MAX_POINTS } from '../../shared/score';
import { DIFFICULTY } from '../../shared/types';
import type { Round } from './rounds';

type Stars = 0 | 1 | 2 | 3;
type NonGrid = Exclude<Round, { kind: 'grid' }>;

export interface RoundOptions {
  title: string; // "Level 7"
  place: string;
  hint: 'full' | 'category' | 'none';
  firstClear: boolean;
  onRetry(): void;
  onNext?: () => void;
  onExit(): void;
  onFinish(r: { won: boolean; stars: Stars; xp: number; points?: number }): void;
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);
export const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Wall-clock timer: tab background ma gayepani samay thik ghatchha. */
function startTimer(seconds: number, onTick: (left: number) => void, onEnd: () => void): { stop(): void; left(): number } {
  const end = Date.now() + seconds * 1000;
  let done = false;
  const left = (): number => Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const id = window.setInterval(() => {
    const l = left();
    onTick(l);
    if (l <= 0 && !done) { done = true; window.clearInterval(id); onEnd(); }
  }, 250);
  return { stop: () => { done = true; window.clearInterval(id); }, left };
}

export function mountRound(root: HTMLElement, round: NonGrid, opt: RoundOptions): () => void {
  const d = DIFFICULTY[round.difficulty];
  let over = false;
  let message = '';
  let tries = 0;
  let picked = -1; // quiz
  let wordIdx = 0; // rush
  let points: number[] = [];
  let lastTiles: { guess: string; tiles: string[] } | null = null;
  let result: { stars: Stars; xp: number; points?: number; text: string } | null = null;

  const timer = startTimer(round.timer, (l) => {
    const el = root.querySelector('.timer');
    if (el) { el.textContent = fmtTime(l); el.classList.toggle('low', l <= 10); }
  }, () => timeUp());

  function finish(s: Stars, text: string, pts?: number): void {
    if (over) return;
    over = true;
    timer.stop();
    const xp = roundXp(s, round.difficulty, opt.firstClear);
    result = { stars: s, xp, points: pts, text: xp > 0 ? `${text} +${xp} XP` : text };
    opt.onFinish({ won: s > 0, stars: s, xp, points: pts });
    render();
  }

  function timeUp(): void {
    if (over) return;
    if (round.kind === 'rush') {
      const pts = [...points];
      while (pts.length < RUSH_WORDS) pts.push(0);
      points = pts;
      const s = rushStars(points);
      return finish(s, s > 0 ? 'Samay sakiyo, tara pass!' : 'Samay sakiyo', total());
    }
    finish(0, 'Samay sakiyo');
  }

  const total = (): number => points.reduce((a, b) => a + b, 0);

  // ----- actions -----
  function answerQuiz(i: number): void {
    if (over || round.kind !== 'quiz') return;
    picked = i;
    const ok = i === round.correct;
    finish(timedStars(ok, timer.left(), round.timer), ok ? 'Sahi!' : `Galat. Sahi jawaf: ${round.options[round.correct]}`);
  }

  function submitText(raw: string): void {
    if (over) return;
    const g = normalizeExact(raw);
    if (round.kind === 'photo') {
      const len = round.answer.length;
      if (g.length !== len) { message = `${len} akshar chahinchha`; return render(); }
      tries++;
      lastTiles = { guess: g, tiles: evaluate(g, round.answer) };
      if (g === round.answer) return finish(photoStars(tries, timer.left(), round.timer), 'Sahi!');
      if (tries >= 3) return finish(0, `Shabda thiyo: ${round.answer}`);
      message = `Galat (${3 - tries} try baaki)`;
      return render();
    }
    if (round.kind === 'rush') {
      const w = round.words[wordIdx]!;
      if (g.length !== w.answer.length) { message = `${w.answer.length} akshar chahinchha`; return render(); }
      const p = wordPoints(g, w.answer);
      points.push(p);
      lastTiles = { guess: g, tiles: evaluate(g, w.answer) };
      message = g === w.answer ? `Sahi! +${p}` : `${w.answer} thiyo: +${p} (thau anusar)`;
      return nextWord();
    }
  }

  function skip(): void {
    if (over || round.kind !== 'rush') return;
    const w = round.words[wordIdx]!;
    points.push(0);
    lastTiles = null;
    message = `${w.answer} thiyo: +0`;
    nextWord();
  }

  function nextWord(): void {
    if (round.kind !== 'rush') return;
    wordIdx++;
    if (wordIdx >= RUSH_WORDS) {
      const s = rushStars(points);
      const pct = Math.round(rushFraction(points) * 100);
      return finish(s, s > 0 ? `Pass! ${pct}%` : `Pass hune bhaye ${50}% chahinthyo, ${pct}% bhayo`, total());
    }
    render();
  }

  // ----- views -----
  const blanks = (n: number): string => `<div class="blanks" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`;
  const tileRow = (t: { guess: string; tiles: string[] }): string =>
    `<div class="row" style="--cols:${t.guess.length}">${t.guess.split('').map((c, i) => `<div class="tile ${t.tiles[i]}">${c}</div>`).join('')}</div>`;
  const clue = (cat: string, hint?: string): string =>
    opt.hint === 'none' ? '<p class="clue">Hint chhaina</p>' : `<p class="clue"><b>${esc(cat)}</b>${opt.hint === 'full' ? esc(hint ?? '') : ''}</p>`;

  function body(): string {
    if (round.kind === 'quiz') {
      const opts = round.options.map((o, i) => {
        const cls = over ? (i === round.correct ? 'right' : i === picked ? 'wrong' : '') : '';
        return `<button class="opt ${cls}" data-i="${i}" ${over ? 'disabled' : ''}><span>${'ABCD'[i]}</span>${esc(o)}</button>`;
      }).join('');
      return `<p class="clue"><b>${esc(round.category)}</b>MCQ</p><h2 class="q">${esc(round.question)}</h2><div class="opts" role="group" aria-label="Options">${opts}</div>`;
    }
    if (round.kind === 'photo') {
      return `${clue(round.category, round.hint)}<div class="emoji" role="img" aria-label="Emoji sanket">${round.emoji}</div>${blanks(round.answer.length)}${lastTiles ? tileRow(lastTiles) : ''}${input(round.answer.length)}`;
    }
    const w = round.words[Math.min(wordIdx, RUSH_WORDS - 1)]!;
    const strip = round.words.map((_, i) => `<span class="dot ${i < points.length ? 'done' : i === wordIdx ? 'cur' : ''}">${i < points.length ? points[i] : i + 1}</span>`).join('');
    const live = over ? '' : `${clue(w.category, w.hint)}${blanks(w.answer.length)}${lastTiles ? tileRow(lastTiles) : ''}${input(w.answer.length, true)}`;
    return `<div class="dots" aria-label="Shabda ${Math.min(wordIdx + 1, RUSH_WORDS)} / ${RUSH_WORDS}">${strip}</div>${live}`;
  }

  const input = (len: number, withSkip = false): string => over ? '' : `
    <form class="guess" autocomplete="off">
      <label class="sr" for="g">Tapai ko jawaf</label>
      <input id="g" maxlength="${len}" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${len} akshar" />
      <button class="primary" type="submit">Enter</button>
      ${withSkip ? '<button class="secondary" type="button" id="skip">Skip</button>' : ''}
    </form>`;

  function render(): void {
    const pill = round.kind === 'rush' ? `${total()} pts` : round.kind === 'photo' ? `${tries}/3` : d.name;
    let after = '';
    if (over && result) {
      const again = result.stars > 0 && opt.onNext ? '<button id="go" class="primary">Agaadi</button>' : '';
      const retry = result.stars === 0 || !opt.onNext ? '<button id="retry" class="primary">Feri khel</button>' : '<button id="retry" class="secondary">Feri khel</button>';
      after = `<div class="result"><p class="stars" aria-label="${result.stars} star">${stars(result.stars)}</p>
        ${result.points !== undefined ? `<p class="pts">${result.points} / ${RUSH_WORDS * WORD_MAX_POINTS} points</p>` : ''}
        <div class="after">${again}${retry}</div></div>`;
    }
    const kindName = { quiz: 'Quiz', photo: 'Chitra Shabda', rush: `${RUSH_WORDS} shabda, samay ma` }[round.kind];
    root.innerHTML = `
      <div class="flags" aria-hidden="true"></div>
      <div class="game round">
        <header class="gbar">
          <button id="back" class="icon" aria-label="Map">←</button>
          <div class="gtitle"><b>${esc(opt.title)}</b><span>${esc(opt.place)} · ${d.name} · ${kindName}</span></div>
          <span class="pill">${pill}</span>
        </header>
        <div class="timerbar"><span class="timer ${timer.left() <= 10 ? 'low' : ''}" role="timer">${fmtTime(timer.left())}</span></div>
        ${body()}
        <p class="msg" role="status">${esc(over && result ? result.text : message) || '&nbsp;'}</p>
        ${after}
      </div>`;
    root.querySelector<HTMLButtonElement>('#back')!.onclick = () => opt.onExit();
    root.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => (b.onclick = () => answerQuiz(Number(b.dataset.i))));
    root.querySelector<HTMLButtonElement>('#retry')?.addEventListener('click', () => opt.onRetry());
    root.querySelector<HTMLButtonElement>('#go')?.addEventListener('click', () => opt.onNext?.());
    root.querySelector<HTMLButtonElement>('#skip')?.addEventListener('click', skip);
    const form = root.querySelector<HTMLFormElement>('.guess');
    if (form) {
      const inp = form.querySelector<HTMLInputElement>('#g')!;
      form.addEventListener('submit', (e) => { e.preventDefault(); submitText(inp.value); });
      inp.focus();
    }
  }

  render();
  return () => timer.stop();
}
