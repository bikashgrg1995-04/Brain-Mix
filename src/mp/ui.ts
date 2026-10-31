import { MAX_PLAYERS, MIN_PLAYERS, MP_ROUNDS, NAME_MAX, cleanName, rankPlayers, type PlayerInfo, type Submission } from '../../shared/multiplayer';
import type { PlatformAdapter } from '../platform/adapter';
import { fmtTime } from '../game/round-ui';
import { MP_KEY, MP_URL, mpEnabled } from './config';
import { newPlayerId, realEnv } from './env';
import { Session, type Env, type Transport, type View } from './session';
import { supabaseTransport } from './supabase';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const NAME_KEY = 'shabda_name';
const MEDAL = ['🥇', '🥈', '🥉'];

export interface MpDeps {
  platform: PlatformAdapter;
  onExit(): void;
  /** Test ko lagi. */
  transport?: () => Transport;
  env?: Env;
  enabled?: boolean;
}

function savedName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function renderMultiplayer(root: HTMLElement, deps: MpDeps): () => void {
  const enabled = deps.enabled ?? mpEnabled;
  let session: Session | null = null;
  let view: View | null = null;
  let busy = false;
  let notice = '';
  let tick = 0;
  const myId = newPlayerId();

  const makeSession = (): Session => {
    const s = new Session(deps.transport ? deps.transport() : supabaseTransport(MP_URL, MP_KEY), deps.env ?? realEnv(), (v) => { view = v; render(); });
    session = s;
    return s;
  };

  function name(): string {
    const n = cleanName((root.querySelector<HTMLInputElement>('#name')?.value ?? savedName()) || '');
    try { localStorage.setItem(NAME_KEY, n); } catch { /* storage unavailable */ }
    return n;
  }

  async function create(): Promise<void> {
    const n = name();
    if (!n) { notice = 'Afno naam lekha'; return render(); }
    busy = true; notice = ''; render();
    try { await makeSession().create(myId, n); } catch { /* view.error ma chha */ }
    busy = false; render();
  }

  async function join(): Promise<void> {
    const n = name();
    if (!n) { notice = 'Afno naam lekha'; return render(); }
    const code = root.querySelector<HTMLInputElement>('#code')?.value ?? '';
    busy = true; notice = ''; render();
    try { await makeSession().join(myId, n, code); } catch { /* view.error ma chha */ }
    busy = false; render();
  }

  function reset(): void {
    session?.leave();
    session = null; view = null; notice = '';
    render();
  }

  const board = (players: PlayerInfo[], gains?: Record<string, number>, ranked = true): string =>
    `<ol class="players">${(ranked ? rankPlayers(players) : players.map((p) => ({ ...p, rank: 0 }))).map((p) => `<li class="${p.id === myId ? 'me' : ''} ${players.find((x) => x.id === p.id)?.here === false ? 'gone' : ''}"><span class="rk">${ranked ? MEDAL[p.rank - 1] ?? p.rank : '•'}</span><b>${esc(p.name)}${p.id === myId ? ' (tapai)' : ''}</b>${gains ? `<em>+${gains[p.id] ?? 0}</em>` : ''}${ranked ? `<span class="sc">${p.score}</span>` : ''}</li>`).join('')}</ol>`;

  function menu(): string {
    const err = view?.error ?? notice;
    return `
      <p class="clue"><b>Multiplayer</b>2-${MAX_PLAYERS} jana, ${MP_ROUNDS} round, sabai ko afnai phone</p>
      ${enabled ? '' : '<p class="msg warn" role="alert">Multiplayer ko lagi Supabase set garnu parchha (.env.local, README herne).</p>'}
      <div class="mpform">
        <label class="sr" for="name">Tapai ko naam</label>
        <input id="name" maxlength="${NAME_MAX}" placeholder="Tapai ko naam" value="${esc(savedName())}" autocomplete="nickname" />
        <button id="create" class="primary" ${!enabled || busy ? 'disabled' : ''}>Room banau</button>
        <p class="or">ya</p>
        <label class="sr" for="code">Room code</label>
        <input id="code" maxlength="8" placeholder="Room code (5 akshar)" autocapitalize="characters" autocomplete="off" spellcheck="false" />
        <button id="join" class="secondary" ${!enabled || busy ? 'disabled' : ''}>Room ma jodine</button>
      </div>
      <p class="msg" role="status">${busy ? 'Connect hudaichha…' : esc(err ?? '') || '&nbsp;'}</p>`;
  }

  function lobby(v: View): string {
    const here = v.players.filter((p) => p.here).length;
    return `
      <div class="roomcode"><small>Room code</small><b aria-label="${v.code.split('').join(' ')}">${v.code}</b><button id="share" class="secondary">Share</button></div>
      <h2 class="q">Kheladdi (${v.players.length}/${MAX_PLAYERS})</h2>
      ${board(v.players, undefined, false)}
      ${v.isHost
        ? `<div class="after"><button id="start" class="primary" ${here < MIN_PLAYERS ? 'disabled' : ''}>Suru garau</button></div><p class="msg" role="status">${here < MIN_PLAYERS ? `Kamti ma ${MIN_PLAYERS} jana chahinchha` : '&nbsp;'}</p>`
        : '<p class="msg" role="status">Host le suru garne bela sakhnus…</p>'}`;
  }

  function roundView(v: View): string {
    const r = v.round!;
    if (v.submitted) return `<p class="msg wait" role="status">Pathaiyo. Arko ko jawaf parkhidai…</p>`;
    if (r.kind === 'quiz') {
      return `<p class="clue"><b>${esc(r.category)}</b>MCQ</p><h2 class="q">${esc(r.question)}</h2><div class="opts" role="group" aria-label="Options">${r.options.map((o, i) => `<button class="opt" data-i="${i}"><span>${'ABCD'[i]}</span>${esc(o)}</button>`).join('')}</div>`;
    }
    const blanks = (n: number): string => `<div class="blanks" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`;
    const clue = (c: string, h?: string): string => `<p class="clue"><b>${esc(c)}</b>${esc(h ?? '')}</p>`;
    if (r.kind === 'photo') {
      return `${clue(r.category, r.hint)}<div class="emoji" role="img" aria-label="Emoji sanket">${r.emoji}</div>${blanks(r.len)}
        <form class="guess"><label class="sr" for="g0">Jawaf</label><input id="g0" data-g maxlength="${r.len}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${r.len} akshar" /><button class="primary" type="submit">Pathau</button></form>`;
    }
    return `<p class="clue"><b>${r.words.length} shabda</b>Ek patak matra, thau anusar point</p>
      <form class="rushform">${r.words.map((w, i) => `<div class="rw"><label for="g${i}">${i + 1}. ${esc(w.category)}${w.hint ? ` · ${esc(w.hint)}` : ''}</label><input id="g${i}" data-g maxlength="${w.len}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${w.len} akshar" /></div>`).join('')}
      <button class="primary" type="submit">Pathau</button></form>`;
  }

  function draft(): Submission {
    const r = view!.round!;
    const vals = Array.from(root.querySelectorAll<HTMLInputElement>('[data-g]')).map((i) => i.value);
    return r.kind === 'rush' ? { kind: 'rush', guesses: vals } : { kind: 'photo', guess: vals[0] ?? '' };
  }

  function body(): string {
    const v = view;
    if (!v || v.phase === 'idle') return menu();
    if (v.phase === 'closed') return `<p class="msg warn" role="alert">${esc(v.error ?? 'Room band bhayo')}</p><div class="after"><button id="again" class="primary">Pachhadi</button></div>`;
    if (v.phase === 'lobby') return lobby(v);
    if (v.phase === 'round') return roundView(v);
    if (v.phase === 'reveal') {
      return `<p class="clue"><b>Sahi jawaf</b></p><h2 class="q">${esc(v.reveal!.answer)}</h2>${board(v.players, v.reveal!.gains)}<p class="msg" role="status">${v.reveal!.last ? 'Antim result aaudai chha…' : 'Arko round aauchha…'}</p>`;
    }
    const top = rankPlayers(v.players);
    const mine = top.find((p) => p.id === myId);
    return `<h2 class="q">${mine && mine.rank === 1 ? '🏆 Tapai jitnu bhayo!' : 'Khel sakiyo'}</h2>${board(v.players)}<div class="after"><button id="again" class="primary">Feri</button></div>`;
  }

  function render(): void {
    const v = view;
    const title = v && v.phase === 'round' ? `Round ${v.i + 1}/${v.total}` : v && v.phase === 'reveal' ? `Round ${v.i + 1}/${v.total} · Score` : 'Multiplayer';
    root.innerHTML = `
      <div class="flags" aria-hidden="true"></div>
      <div class="game round mp">
        <header class="gbar">
          <button id="back" class="icon" aria-label="Back">←</button>
          <div class="gtitle"><b>${title}</b><span>${v && v.code ? `Room ${v.code}` : 'Online'}</span></div>
          <span class="pill">${v && v.phase === 'round' ? `<span class="timer" role="timer">${fmtTime(Math.max(0, Math.ceil((v.deadline - (deps.env ?? { now: Date.now }).now()) / 1000)))}</span>` : `${v?.players.length ?? 0}/${MAX_PLAYERS}`}</span>
        </header>
        ${body()}
      </div>`;
    const $ = <T extends HTMLElement>(s: string): T | null => root.querySelector<T>(s);
    $('#back')!.onclick = () => { if (session && view && view.phase !== 'closed' && view.phase !== 'final') { if (!confirm('Room chhodne?')) return; } session?.leave(); session = null; deps.onExit(); };
    $('#create')?.addEventListener('click', () => void create());
    $('#join')?.addEventListener('click', () => void join());
    $('#start')?.addEventListener('click', () => session?.start());
    $('#again')?.addEventListener('click', reset);
    $('#share')?.addEventListener('click', async () => {
      const r = await deps.platform.shareText(`Shabda ma jodine! Room code: ${view!.code}`);
      notice = r === 'copied' ? 'Copy bhayo' : '';
    });
    root.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => (b.onclick = () => session?.submit({ kind: 'quiz', pick: Number(b.dataset.i) })));
    const f = $<HTMLFormElement>('.guess, .rushform');
    if (f) {
      f.addEventListener('submit', (e) => { e.preventDefault(); session?.submit(draft()); });
      root.querySelector<HTMLInputElement>('[data-g]')?.focus();
    }
    if (!v) $<HTMLInputElement>(savedName() ? '#code' : '#name')?.focus();
  }

  // Timer: update, ra samay sakepachhi jun lekheko chha tehi auto-pathaune
  tick = window.setInterval(() => {
    const v = view;
    if (!v || v.phase !== 'round') return;
    const left = Math.max(0, Math.ceil((v.deadline - (deps.env ?? { now: Date.now }).now()) / 1000));
    const el = root.querySelector('.timer');
    if (el) { el.textContent = fmtTime(left); el.classList.toggle('low', left <= 10); }
    if (left <= 0 && !v.submitted) {
      const r = v.round!;
      session?.submit(r.kind === 'quiz' ? { kind: 'quiz', pick: -1 } : draft());
    }
  }, 250);

  render();
  return () => { window.clearInterval(tick); session?.leave(); };
}
