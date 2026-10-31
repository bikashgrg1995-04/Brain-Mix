import {
  GRACE_MS, MAX_PLAYERS, MIN_PLAYERS, MP_ROUNDS, REVEAL_MS, isMsg, isSubmission, makeCode, normalizeCode, scoreSubmission, toPublic, revealText,
  type Msg, type Peer, type PlayerInfo, type PublicRound, type SecretRound, type Submission,
} from '../../shared/multiplayer';

export interface Handlers {
  onMsg(m: Msg): void;
  onPresence(peers: Peer[]): void;
  onClose(why: string): void;
}

/** Network layer. Asal: Supabase Realtime (supabase.ts). Test: memory transport. */
export interface Transport {
  /** Room ma jodinchha; presence ko pahilo sync pachhi resolve. Fail bhaye throw. */
  connect(room: string, me: Peer, h: Handlers): Promise<void>;
  send(m: Msg): void;
  close(): void;
}

export interface Env {
  rng(): number;
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  /** Host le i-aun (0-based) round banauchha. */
  buildRound(i: number): SecretRound;
}

export type Phase = 'idle' | 'lobby' | 'round' | 'reveal' | 'final' | 'closed';

export interface View {
  phase: Phase;
  code: string;
  me: string;
  host: string;
  isHost: boolean;
  players: PlayerInfo[];
  started: boolean;
  i: number;
  total: number;
  duration: number;
  deadline: number; // local ghadi ma round sakine samay
  round?: PublicRound;
  submitted: boolean;
  reveal?: { answer: string; gains: Record<string, number>; last: boolean };
  error?: string;
}

const JOIN_WAIT_MS = 5000;

export class Session {
  private tp: Transport;
  private env: Env;
  private emit: (v: View) => void;
  private peers: Peer[] = [];
  private hostSeen = false;
  private joinTimer: unknown;

  v: View = { phase: 'idle', code: '', me: '', host: '', isHost: false, players: [], started: false, i: 0, total: MP_ROUNDS, duration: 0, deadline: 0, submitted: false };

  // host matra
  private roster = new Map<string, PlayerInfo>();
  private cur?: SecretRound;
  private roundStart = 0;
  private subs = new Map<string, { sub: Submission; used: number }>();
  private timer: unknown;
  private ending = false;

  constructor(tp: Transport, env: Env, emit: (v: View) => void) {
    this.tp = tp;
    this.env = env;
    this.emit = emit;
  }

  private set(p: Partial<View>): void {
    this.v = { ...this.v, ...p };
    this.emit(this.v);
  }

  private fail(error: string): void {
    this.clear();
    this.tp.close();
    this.set({ phase: 'closed', error });
  }

  private clear(): void {
    this.env.clearTimeout(this.timer);
    this.env.clearTimeout(this.joinTimer);
  }

  private handlers(): Handlers {
    return {
      onMsg: (m) => this.onMsg(m),
      onPresence: (list) => this.onPresence(list),
      onClose: (why) => { if (this.v.phase !== 'closed' && this.v.phase !== 'final') this.fail(why); },
    };
  }

  /** Naya room banaune. Code return garchha. */
  async create(id: string, name: string): Promise<string> {
    const code = makeCode(() => this.env.rng());
    const me: Peer = { id, name, host: true, at: this.env.now() };
    this.roster.set(id, { id, name, score: 0, here: true });
    this.set({ code, me: id, host: id, isHost: true, phase: 'lobby' });
    try { await this.tp.connect(code, me, this.handlers()); } catch (e) { this.fail(`Connect bhayena: ${msg(e)}`); throw e; }
    this.broadcastLobby();
    return code;
  }

  async join(id: string, name: string, rawCode: string): Promise<void> {
    const code = normalizeCode(rawCode);
    if (!code) { this.set({ error: 'Code 5 akshar ko hunuparchha' }); throw new Error('bad code'); }
    const me: Peer = { id, name, host: false, at: this.env.now() };
    this.set({ code, me: id, isHost: false, phase: 'lobby', error: undefined });
    try { await this.tp.connect(code, me, this.handlers()); } catch (e) { this.fail(`Connect bhayena: ${msg(e)}`); throw e; }
    if (!this.peers.some((p) => p.host)) { this.fail('Yo code ko room chhaina'); throw new Error('no room'); }
    // Host le lobby pathaunu parchha (roster ma pareko pushti)
    this.joinTimer = this.env.setTimeout(() => { if (!this.v.players.some((p) => p.id === id)) this.fail('Host le jawaf diena'); }, JOIN_WAIT_MS);
  }

  /** Host ko "Suru" button. */
  start(): void {
    if (!this.v.isHost || this.v.phase !== 'lobby' || this.v.started) return;
    if ([...this.roster.values()].filter((p) => p.here).length < MIN_PLAYERS) return;
    this.v.started = true;
    this.broadcastLobby();
    this.beginRound(0);
  }

  submit(sub: Submission): void {
    if (this.v.phase !== 'round' || this.v.submitted) return;
    this.set({ submitted: true });
    this.tp.send({ t: 'submit', from: this.v.me, i: this.v.i, sub });
  }

  leave(): void {
    this.clear();
    this.tp.close();
    this.set({ phase: 'closed', error: undefined });
  }

  // ---------- sabai ----------
  private onMsg(m: Msg): void {
    if (!isMsg(m) || this.v.phase === 'closed') return;
    switch (m.t) {
      case 'lobby':
        this.env.clearTimeout(this.joinTimer);
        this.set({ host: m.host, players: m.players, started: m.started, ...(this.v.phase === 'idle' || (this.v.phase === 'lobby' && !m.started) ? { phase: 'lobby' as Phase } : {}) });
        return;
      case 'reject':
        if (m.id === this.v.me) this.fail(m.why === 'full' ? 'Room bhari chha (max 5)' : 'Khel suru bhaisakyo');
        return;
      case 'round':
        this.set({ phase: 'round', i: m.i, total: m.total, duration: m.duration, deadline: this.env.now() + m.duration * 1000, round: m.view, submitted: false, reveal: undefined });
        return;
      case 'reveal':
        this.set({ phase: 'reveal', players: m.players, reveal: { answer: m.answer, gains: m.gains, last: m.last } });
        return;
      case 'final':
        this.clear();
        this.set({ phase: 'final', players: m.players });
        this.tp.close();
        return;
      case 'submit':
        if (this.v.isHost) this.onSubmit(m);
        return;
    }
  }

  private onPresence(list: Peer[]): void {
    this.peers = list;
    const host = list.find((p) => p.host);
    if (host) this.hostSeen = true;
    if (!this.v.isHost) {
      if (this.hostSeen && !host && this.v.phase !== 'final') this.fail('Host le room chhodyo');
      return;
    }
    const ids = new Set(list.map((p) => p.id));
    let changed = false;
    for (const p of [...list].sort((a, b) => a.at - b.at)) {
      if (this.roster.has(p.id)) continue;
      if (this.v.started) this.tp.send({ t: 'reject', id: p.id, why: 'started' });
      else if (this.roster.size >= MAX_PLAYERS) this.tp.send({ t: 'reject', id: p.id, why: 'full' });
      else { this.roster.set(p.id, { id: p.id, name: p.name, score: 0, here: true }); changed = true; }
    }
    for (const [id, info] of this.roster) {
      const here = ids.has(id);
      if (!here && !this.v.started) { this.roster.delete(id); changed = true; }
      else if (info.here !== here) { info.here = here; changed = true; }
    }
    if (changed) this.broadcastLobby();
    if (this.v.phase === 'round') this.maybeEnd();
  }

  // ---------- host ----------
  private players(): PlayerInfo[] { return [...this.roster.values()].map((p) => ({ ...p })); }

  private broadcastLobby(): void {
    this.tp.send({ t: 'lobby', host: this.v.me, players: this.players(), started: this.v.started });
  }

  private beginRound(i: number): void {
    this.cur = this.env.buildRound(i);
    this.roundStart = this.env.now();
    this.subs = new Map();
    this.ending = false;
    this.tp.send({ t: 'round', i, total: MP_ROUNDS, duration: this.cur.timer, view: toPublic(this.cur) });
    this.timer = this.env.setTimeout(() => this.endRound(), this.cur.timer * 1000 + GRACE_MS);
  }

  private onSubmit(m: Extract<Msg, { t: 'submit' }>): void {
    if (this.v.phase !== 'round' || m.i !== this.v.i || this.ending) return;
    if (!this.roster.has(m.from) || this.subs.has(m.from) || !isSubmission(m.sub)) return;
    this.subs.set(m.from, { sub: m.sub, used: this.env.now() - this.roundStart });
    this.maybeEnd();
  }

  private maybeEnd(): void {
    if (!this.v.isHost || this.ending || !this.cur) return;
    const waiting = [...this.roster.values()].filter((p) => p.here && !this.subs.has(p.id));
    if (waiting.length === 0) this.endRound();
  }

  private endRound(): void {
    if (this.ending || !this.cur) return;
    this.ending = true;
    this.env.clearTimeout(this.timer);
    const gains: Record<string, number> = {};
    for (const p of this.roster.values()) {
      const s = this.subs.get(p.id);
      const g = scoreSubmission(this.cur, s?.sub, s?.used ?? this.cur.timer * 1000);
      gains[p.id] = g;
      p.score += g;
    }
    const last = this.v.i + 1 >= MP_ROUNDS;
    this.tp.send({ t: 'reveal', i: this.v.i, answer: revealText(this.cur), gains, players: this.players(), last });
    this.timer = this.env.setTimeout(() => {
      if (last) this.tp.send({ t: 'final', players: this.players() });
      else this.beginRound(this.v.i + 1);
    }, REVEAL_MS);
  }
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
