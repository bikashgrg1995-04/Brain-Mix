import { DIFFICULTY, type Difficulty } from '../../shared/types';
import { rankFor } from '../../shared/rank';
import type { PlatformAdapter } from '../platform/adapter';
import { currentStreak, nepalDay, type Profile } from '../state/profile';
import { WORDS } from './words';

export type Filter = 0 | Difficulty;

export function dailyWord() {
  return WORDS[nepalDay().index % WORDS.length]!; // TEMP: Phase 2 ma server bata
}

const LOGO = `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><path d="M2 27 12 8l5 9 3-5 10 15z" fill="currentColor"/><path d="m12 8 2.6 4.8L12 14l-2.2-1.2z" fill="#fff" opacity=".9"/></svg>`;

const SOON = [
  { name: 'Yatra', note: '10 chapter, Everest Base Camp samma', tag: 'Chhito aauchha' },
  { name: 'Chitra Shabda', note: 'Photo + emoji bata shabda', tag: 'Chhito aauchha' },
  { name: 'Top 10 board', note: '2-5 jana, points ko khel', tag: 'Pachhi' },
];

export interface HomeActions {
  onDaily(): void;
  onPractice(filter: Filter): void;
}

let selected: Filter = 0;

export function renderHome(root: HTMLElement, platform: PlatformAdapter, p: Profile, act: HomeActions): void {
  const today = nepalDay().key;
  const rank = rankFor(p.xp);
  const streak = currentStreak(p);
  const dw = dailyWord();
  const done = p.daily && p.daily.date === today ? p.daily : null;
  const maxT = DIFFICULTY[dw.difficulty].maxTries;
  const blanks = Array.from({ length: dw.answer.length }, () => '<i></i>').join('');
  const chips = [0, 1, 2, 3, 4]
    .map((v) => `<button class="chip ${v === selected ? 'on' : ''}" data-f="${v}" aria-pressed="${v === selected}">${v === 0 ? 'Sabai' : DIFFICULTY[v as Difficulty].name}</button>`)
    .join('');
  const soon = SOON.map((s) => `<div class="soon" aria-disabled="true"><b>${s.name}</b><span>${s.note}</span><em>${s.tag}</em></div>`).join('');

  root.innerHTML = `
    <div class="flags" aria-hidden="true"></div>
    <div class="home">
      <header class="top">
        <div class="brand">${LOGO}<h1>Shabda</h1></div>
        <div class="stats"><span class="pill" title="Streak">Streak ${streak}</span><span class="pill">${p.xp} XP</span></div>
      </header>

      <section class="rank" aria-label="Rank">
        <div><b>${rank.title}</b><span>${rank.next ? `${rank.toNext} XP baaki: ${rank.next}` : 'Sabai bhanda mathi'}</span></div>
        <div class="bar"><div style="width:${Math.round(rank.progress * 100)}%"></div></div>
      </section>

      <section class="daily">
        <div class="dhead"><h2>Aaja ko Shabda</h2><span>${dw.answer.length} akshar · ${DIFFICULTY[dw.difficulty].name}</span></div>
        <div class="blanks" style="--n:${dw.answer.length}" aria-hidden="true">${blanks}</div>
        ${done
          ? `<p class="done">${done.won ? `Sahi, ${done.tries}/${maxT} ma` : 'Aaja milena'}. Bholi nayaa shabda aauchha.</p>`
          : `<button class="primary" id="daily">Khelau</button>`}
      </section>

      <section class="practice">
        <h2>Practice</h2>
        <div class="chips" role="group" aria-label="Level">${chips}</div>
        <button class="secondary" id="practice">Practice khelau</button>
      </section>

      <section class="soons" aria-label="Chhito aauchha">${soon}</section>
      <footer>${platform.name} · ${platform.getPlayerId()}</footer>
    </div>`;

  root.querySelector<HTMLButtonElement>('#daily')?.addEventListener('click', act.onDaily);
  root.querySelector<HTMLButtonElement>('#practice')!.onclick = () => act.onPractice(selected);
  root.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => {
    c.onclick = () => {
      selected = Number(c.dataset.f) as Filter;
      root.querySelectorAll('.chip').forEach((x) => {
        const on = x === c;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', String(on));
      });
    };
  });
}
