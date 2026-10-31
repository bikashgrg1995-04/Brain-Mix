import './admin.css';
import {
  DEFAULT_TIMER,
  QUEST_LABEL,
  QUEST_TYPES,
  QUIZ_OPTIONS,
  TIMER_MAX,
  TIMER_MIN,
  findDuplicateAnswers,
  parseQuestFile,
  serializeQuests,
  validateQuest,
  type Quest,
  type QuestFile,
  type QuestType,
} from '../../shared/quests';
import { DIFFICULTY, type Difficulty } from '../../shared/types';
import { CHAPTERS, LEVELS_PER_CHAPTER, TOTAL_LEVELS, altitudeText, autoLevelWord, bandLabel, chapterOf } from '../game/chapters';
import savedJson from '../content/quests.json';

/**
 * Place ra level anusar quest set garne admin. Dev tool: `npm run admin`.
 * Quest haru src/content/quests.json ma jancha ra game le seedhai padhchha (src/game/quests.ts).
 * Draft browser ma (localStorage) rakhinchha; "Save to project" le file ma lekhchha (dev server matra).
 */
const DRAFT_KEY = 'shabda_admin_draft_v1';
const PENDING_KEY = 'shabda_admin_pending_save';
const CAN_SAVE = import.meta.env.DEV;
const root = document.getElementById('admin')!;

// ---------- state ----------
let savedText = serializeQuests(parseQuestFile(JSON.stringify(savedJson)).file);

function readDraft(): QuestFile | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const r = parseQuestFile(raw);
    return r.errors.length === 0 ? r.file : null;
  } catch {
    return null;
  }
}

let draft: QuestFile = readDraft() ?? parseQuestFile(savedText).file;
let place = 0; // 0-based place
let level = 1; // 1-based level (map ma dekhine "Level 1")
let errors: string[] = [];
let importErrors: string[] = [];

interface Form {
  type: QuestType;
  difficulty: Difficulty;
  timer: string;
  answer: string;
  category: string;
  hint: string;
  question: string;
  options: string[];
  correct: number;
  emoji: string;
}
type TextKey = 'answer' | 'category' | 'hint' | 'question' | 'emoji' | 'timer';

const dirty = (): boolean => serializeQuests(draft) !== savedText;
const levelsOf = (p: number): number[] => Array.from({ length: LEVELS_PER_CHAPTER }, (_, k) => p * LEVELS_PER_CHAPTER + k + 1);
const countSet = (p: number): number => levelsOf(p).filter((l) => draft.quests[String(l)]).length;
const placeOf = (l: number) => CHAPTERS[chapterOf(l - 1)]!;

function persist(): void {
  try {
    if (dirty()) localStorage.setItem(DRAFT_KEY, serializeQuests(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage nabhaye pani kaam garchha, draft refresh ma harauchha */
  }
}

function formFor(l: number): Form {
  const band = placeOf(l).band;
  const f: Form = {
    type: 'word',
    difficulty: Math.min(...band) as Difficulty,
    timer: '',
    answer: '',
    category: '',
    hint: '',
    question: '',
    options: Array(QUIZ_OPTIONS).fill(''),
    correct: 0,
    emoji: '',
  };
  const q = draft.quests[String(l)];
  if (!q) return f;
  f.type = q.type;
  f.difficulty = q.difficulty;
  f.timer = q.timer !== undefined ? String(q.timer) : '';
  if (q.type === 'word') Object.assign(f, { answer: q.answer, category: q.category ?? '', hint: q.hint ?? '' });
  if (q.type === 'photo') Object.assign(f, { answer: q.answer, emoji: q.emoji, hint: q.hint ?? '' });
  if (q.type === 'quiz') Object.assign(f, { question: q.question, options: [...q.options], correct: q.correct, category: q.category ?? '' });
  return f;
}
let form = formFor(level);

/** Form -> quest (abhai validate nabhaeko). Khali optional field hatauchha. */
function questFromForm(f: Form): unknown {
  const timer = f.timer.trim() === '' ? undefined : Number(f.timer);
  const base = { type: f.type, difficulty: f.difficulty, ...(timer !== undefined ? { timer } : {}) };
  const category = f.category.trim();
  const hint = f.hint.trim();
  const answer = f.answer.trim().toLowerCase();
  if (f.type === 'word') return { ...base, answer, ...(category ? { category } : {}), ...(hint ? { hint } : {}) };
  if (f.type === 'photo') return { ...base, emoji: f.emoji.trim(), answer, ...(hint ? { hint } : {}) };
  return { ...base, question: f.question.trim(), options: f.options.map((o) => o.trim()), correct: f.correct, ...(category ? { category } : {}) };
}

function warningsFor(): string[] {
  const w: string[] = [];
  const band = placeOf(level).band;
  if (!band.includes(form.difficulty)) {
    w.push(`${DIFFICULTY[form.difficulty].name} yo thau ko difficulty (${bandLabel(band)}) bhanda bahira chha. Save garna milchha.`);
  }
  if (form.type !== 'quiz') {
    const answer = form.answer.trim().toLowerCase();
    const others = Object.entries(draft.quests)
      .filter(([l, q]) => Number(l) !== level && q.type !== 'quiz' && q.answer === answer)
      .map(([l]) => l);
    if (answer && others.length > 0) w.push(`"${answer}" Level ${others.join(', ')} ma pani chha.`);
  }
  return w;
}

// ---------- html helpers ----------
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const TYPE_SHORT: Record<QuestType, string> = { word: 'Word', quiz: 'Quiz', photo: 'Photo' };

function summary(q: Quest): string {
  if (q.type === 'word') return q.answer;
  if (q.type === 'photo') return `${q.emoji} ${q.answer}`;
  return clip(q.question, 46);
}

// ---------- render ----------
root.innerHTML = `
  <header id="top"></header>
  <div id="notes"></div>
  <div class="layout">
    <nav id="places" aria-label="Thau haru"></nav>
    <main>
      <section id="grid"></section>
      <section id="editor"></section>
    </main>
  </div>
  <div id="toast" role="status" aria-live="polite"></div>`;
const $ = (id: string): HTMLElement => document.getElementById(id)!;

function renderTop(): void {
  const total = Object.keys(draft.quests).length;
  const isDirty = dirty();
  $('top').innerHTML = `
    <div class="brand"><h1>Shabda Admin</h1><span>Thau ra level anusar quest</span></div>
    <div class="stat"><b>${total}</b> / ${TOTAL_LEVELS} level ma quest</div>
    <span class="state ${isDirty ? 'dirty' : 'ok'}">${isDirty ? 'Unsaved changes' : 'Saved'}</span>
    <div class="actions">
      ${CAN_SAVE ? `<button class="primary" data-act="save-project" ${isDirty ? '' : 'disabled'}>Save to project</button>` : ''}
      <button data-act="download">Download JSON</button>
      <button data-act="import">Import JSON</button>
      <button data-act="discard" ${isDirty ? '' : 'disabled'}>Discard changes</button>
      <input type="file" id="file" accept="application/json,.json" hidden />
    </div>`;
}

function renderNotes(): void {
  $('notes').innerHTML = importErrors.length
    ? `<div class="note" role="alert"><b>Import ma ${importErrors.length} galat entry skip bhayo:</b><ul>${importErrors
        .slice(0, 8)
        .map((m) => `<li>${esc(m)}</li>`)
        .join('')}</ul><button data-act="dismiss">Thik chha</button></div>`
    : !CAN_SAVE
      ? `<div class="note">Yo build ma "Save to project" chhaina. "Download JSON" garera <code>src/content/quests.json</code> ma rakhnus.</div>`
      : '';
}

function renderPlaces(): void {
  $('places').innerHTML = CHAPTERS.map(
    (ch, p) => `
    <button class="place ${p === place ? 'on' : ''}" data-act="place" data-i="${p}" style="--c:${ch.theme.accent}" ${p === place ? 'aria-current="true"' : ''}>
      <b>${p + 1}. ${esc(ch.place)}</b>
      <span>${altitudeText(ch.altitude)} · ${bandLabel(ch.band)}</span>
      <i>${countSet(p)}/${LEVELS_PER_CHAPTER}</i>
    </button>`,
  ).join('');
}

function renderGrid(): void {
  const ch = CHAPTERS[place]!;
  const [first, last] = [place * LEVELS_PER_CHAPTER + 1, (place + 1) * LEVELS_PER_CHAPTER];
  const cards = levelsOf(place)
    .map((l) => {
      const q = draft.quests[String(l)];
      const auto = autoLevelWord(l - 1);
      const body = q
        ? `<span class="type">${TYPE_SHORT[q.type]}</span><b>${esc(summary(q))}</b><small>${DIFFICULTY[q.difficulty].name}${q.timer ? ` · ${q.timer}s` : ''}</small>`
        : `<span class="type auto">Auto</span><b class="muted">${esc(auto.answer)}</b><small>${DIFFICULTY[auto.difficulty].name}</small>`;
      return `<button class="card ${l === level ? 'on' : ''} ${q ? 'set' : ''}" data-act="level" data-l="${l}" ${l === level ? 'aria-current="true"' : ''}><span class="n">Level ${l}</span>${body}</button>`;
    })
    .join('');
  $('grid').innerHTML = `
    <div class="phead" style="--c:${ch.theme.accent}">
      <h2>${esc(ch.place)}</h2>
      <p>${esc(ch.sub)}</p>
      <p class="meta">Level ${first}-${last} · ${altitudeText(ch.altitude)} · Difficulty ${bandLabel(ch.band)} · Hint: ${ch.hint}</p>
    </div>
    <div class="cards">${cards}</div>`;
}

const textField = (key: TextKey, label: string, value: string, extra = ''): string =>
  `<label class="fld"><span>${label}</span><input data-f="${key}" value="${esc(value)}" ${extra} /></label>`;

function renderEditor(): void {
  const ch = placeOf(level);
  const has = !!draft.quests[String(level)];
  const auto = autoLevelWord(level - 1);
  const f = form;
  const diff = ([1, 2, 3, 4] as Difficulty[])
    .map((d) => `<option value="${d}" ${f.difficulty === d ? 'selected' : ''}>${DIFFICULTY[d].name}${ch.band.includes(d) ? '' : ' (band bahira)'}</option>`)
    .join('');
  const types = QUEST_TYPES.map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${QUEST_LABEL[t]}</option>`).join('');

  const word = (hintLabel = 'Hint') =>
    textField('answer', 'Answer (a-z, 4-7 akshar)', f.answer, 'maxlength="7" autocomplete="off" autocapitalize="off" spellcheck="false" required') +
    textField('category', 'Category', f.category, 'maxlength="40"') +
    textField('hint', hintLabel, f.hint, 'maxlength="120"');
  let fields = '';
  if (f.type === 'word') fields = word();
  if (f.type === 'photo') {
    fields =
      textField('emoji', 'Emoji (1-3 ota)', f.emoji, 'maxlength="24" autocomplete="off" required') +
      textField('answer', 'Answer (a-z, 4-7 akshar)', f.answer, 'maxlength="7" autocomplete="off" autocapitalize="off" spellcheck="false" required') +
      textField('hint', 'Hint', f.hint, 'maxlength="120"');
  }
  if (f.type === 'quiz') {
    fields =
      `<label class="fld wide"><span>Prashna</span><textarea data-f="question" rows="2" maxlength="200" required>${esc(f.question)}</textarea></label>` +
      `<fieldset class="opts"><legend>Option haru (sahi ma ● thichnus)</legend>${f.options
        .map(
          (o, i) =>
            `<div class="opt"><input type="radio" name="correct" data-correct="${i}" aria-label="Option ${i + 1} sahi chha" ${f.correct === i ? 'checked' : ''} />` +
            `<input data-opt="${i}" value="${esc(o)}" placeholder="Option ${i + 1}" maxlength="80" aria-label="Option ${i + 1}" /></div>`,
        )
        .join('')}</fieldset>` +
      textField('category', 'Category', f.category, 'maxlength="40"');
  }

  const errs = errors.length ? `<ul class="errs" role="alert">${errors.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '';
  const warns = warningsFor();
  const warn = warns.length ? `<ul class="warns">${warns.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '';

  $('editor').innerHTML = `
    <h3>Level ${level} · ${esc(ch.place)} <span class="tag ${has ? 'set' : ''}">${has ? 'Quest set chha' : 'Auto'}</span></h3>
    <p class="muted">Quest set nagare player le "<b>${esc(auto.answer)}</b>" paucha (${DIFFICULTY[auto.difficulty].name}).</p>
    <div class="form">
      <label class="fld"><span>Type</span><select data-f="type">${types}</select></label>
      <label class="fld"><span>Difficulty</span><select data-f="difficulty">${diff}</select></label>
      <label class="fld"><span>Timer (second)</span><input data-f="timer" type="number" min="${TIMER_MIN}" max="${TIMER_MAX}" step="1" value="${esc(f.timer)}" placeholder="Auto: ${DEFAULT_TIMER[f.type]}" /></label>
      ${fields}
    </div>
    ${errs}${warn}
    <div class="row">
      <button class="primary" data-act="save-quest">Save quest</button>
      <button data-act="save-next">Save ra aarko level</button>
      <button data-act="clear-quest" ${has ? '' : 'disabled'}>Clear (auto ma farkaune)</button>
    </div>`;
}

function render(): void {
  renderTop();
  renderNotes();
  renderPlaces();
  renderGrid();
  renderEditor();
}

let toastTimer = 0;
function toast(message: string, bad = false): void {
  const el = $('toast');
  el.textContent = message;
  el.className = `show${bad ? ' bad' : ''}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ''), 3200);
}

// ---------- actions ----------
function selectLevel(l: number): void {
  level = Math.max(1, Math.min(TOTAL_LEVELS, l));
  place = chapterOf(level - 1);
  form = formFor(level);
  errors = [];
  render();
}

function saveQuest(): boolean {
  const obj = questFromForm(form);
  errors = validateQuest(obj);
  if (errors.length > 0) {
    renderEditor();
    return false;
  }
  draft.quests[String(level)] = obj as Quest;
  draft = parseQuestFile(serializeQuests(draft)).file; // normalize (field kram, khali field)
  persist();
  form = formFor(level);
  return true;
}

async function saveProject(): Promise<void> {
  try {
    sessionStorage.setItem(PENDING_KEY, '1'); // Vite le file badlepachhi page reload garna sakchha
  } catch {
    /* thik chha */
  }
  try {
    const r = await fetch('/__admin/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin': '1' },
      body: serializeQuests(draft),
    });
    const j = (await r.json().catch(() => ({ ok: false, message: 'Response padhna sakiyena' }))) as { ok: boolean; message: string };
    sessionStorage.removeItem(PENDING_KEY);
    if (!j.ok) return toast(`Save bhayena: ${j.message}`, true);
    savedText = serializeQuests(draft);
    persist();
    toast(`Project ma save bhayo: ${j.message}`);
    render();
  } catch {
    sessionStorage.removeItem(PENDING_KEY);
    toast('Dev server sanga connect bhayena. `npm run admin` chalaunus.', true);
  }
}

function download(): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serializeQuests(draft)], { type: 'application/json' }));
  a.download = 'quests.json';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importFile(file: File): Promise<void> {
  const { file: imported, errors: errs } = parseQuestFile(await file.text());
  const n = Object.keys(imported.quests).length;
  if (n === 0 && errs.length > 0) {
    importErrors = errs;
    return render();
  }
  const msg = `${n} quest import hunchha${errs.length ? `, ${errs.length} galat entry skip hunchha` : ''}. Ahile ko draft replace huncha. Jaari?`;
  if (!confirm(msg)) return;
  draft = imported;
  importErrors = errs;
  persist();
  form = formFor(level);
  render();
}

root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  switch (el.dataset.act) {
    case 'place':
      return selectLevel(Number(el.dataset.i) * LEVELS_PER_CHAPTER + 1);
    case 'level':
      return selectLevel(Number(el.dataset.l));
    case 'save-quest':
      if (saveQuest()) {
        toast(`Level ${level} ko quest save bhayo (draft)`);
        render();
      }
      return;
    case 'save-next':
      if (saveQuest()) {
        toast(`Level ${level} save bhayo`);
        selectLevel(level + 1);
      }
      return;
    case 'clear-quest':
      delete draft.quests[String(level)];
      persist();
      form = formFor(level);
      errors = [];
      toast(`Level ${level} auto ma farkiyo`);
      return render();
    case 'save-project':
      return void saveProject();
    case 'download':
      return download();
    case 'import':
      return void (document.getElementById('file') as HTMLInputElement).click();
    case 'discard':
      if (!confirm('Save nabhako sabai change hataune?')) return;
      draft = parseQuestFile(savedText).file;
      persist();
      form = formFor(level);
      errors = [];
      return render();
    case 'dismiss':
      importErrors = [];
      return renderNotes();
  }
});

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (el.dataset.opt !== undefined) form.options[Number(el.dataset.opt)] = el.value;
  else if (el.dataset.f && el.dataset.f !== 'type' && el.dataset.f !== 'difficulty') form[el.dataset.f as TextKey] = el.value;
});

root.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id === 'file') {
    const file = (el as HTMLInputElement).files?.[0];
    el.value = '';
    if (file) void importFile(file);
  } else if (el.dataset.correct !== undefined) {
    form.correct = Number(el.dataset.correct);
  } else if (el.dataset.f === 'type') {
    form.type = el.value as QuestType;
    errors = [];
    renderEditor();
  } else if (el.dataset.f === 'difficulty') {
    form.difficulty = Number(el.value) as Difficulty;
    renderEditor();
  }
});

// ---------- start ----------
persist(); // draft file jastai bhaye hataidinchha
try {
  if (sessionStorage.getItem(PENDING_KEY)) {
    sessionStorage.removeItem(PENDING_KEY);
    savedText = serializeQuests(parseQuestFile(JSON.stringify(savedJson)).file);
    persist();
    window.setTimeout(() => toast('Project ma save bhayo'), 0);
  }
} catch {
  /* thik chha */
}
render();

const dup = findDuplicateAnswers(draft);
if (dup.size > 0) {
  const [answer, levels] = [...dup.entries()][0]!;
  window.setTimeout(() => toast(`"${answer}" Level ${levels.join(', ')} ma dohoriyeko chha`, true), 600);
}
