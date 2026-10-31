import type { Action, Gained, Result, ServerProfile } from '../../server/game';
import type { Profile } from './profile';
import type { Remote } from './remote';

const OUTBOX_KEY = 'shabda_outbox_v1';
const MAX_OUTBOX = 200;

export interface SyncHooks {
  /** Server ko profile local ma lagyo. gained = tyo action bata aayeko (badge toast ko lagi). */
  onUpdate(gained?: Gained): void;
  onWarn(msg: string): void;
}

export interface SyncOptions {
  gapMs?: number; // action-action bichko antar (server ko rate limit)
  retryMs?: number; // network fail pachhi suru ko pratikshya (dugun hudai jancha)
  maxRetryMs?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

const FIELDS = ['xp', 'coins', 'streak', 'lastWin', 'levels', 'stats', 'badges', 'reward', 'daily'] as const;

/**
 * Local-first, server-authoritative. Khelaadi le tuntai khelchha (local ma turuntai dekhine),
 * har ghatana (level jit, power-up, inam) outbox ma jancha ra server ma pugchha. Internet nabhae
 * outbox ma basxa, feri aaepachhi order ma pathaunchha. Server ko jawaf (sahi coin/xp/badge) le local lai thik pardchha.
 */
export class Sync {
  private box: Action[];
  private busy = false;
  private wait: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private warned = false;
  private opt: Required<Omit<SyncOptions, 'storage'>> & { storage: SyncOptions['storage'] };
  private lastGained: Gained | undefined;

  constructor(private profile: Profile, private remote: Remote, private hooks: SyncHooks, opt: SyncOptions = {}) {
    this.opt = { gapMs: opt.gapMs ?? 2200, retryMs: opt.retryMs ?? 4000, maxRetryMs: opt.maxRetryMs ?? 60_000, storage: opt.storage === undefined ? safeStorage() : opt.storage };
    this.wait = this.opt.retryMs;
    this.box = this.read();
  }

  get pending(): number { return this.box.length; }

  /** App khulda: local profile server ma pahilo patak jodne (server ma chhaina bhane import), baaki outbox. */
  start(): void {
    const local = { xp: this.profile.xp, coins: this.profile.coins, levels: this.profile.levels };
    this.box = [{ a: 'sync', local }, ...this.box.filter((a) => a.a !== 'sync')];
    this.save();
    void this.drain();
  }

  push(a: Action): void {
    if (this.box.length >= MAX_OUTBOX) this.box.shift();
    this.box.push(a);
    this.save();
    void this.drain();
  }

  stop(): void { clearTimeout(this.timer); }

  private later(ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.drain(), ms);
  }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.box.length) {
        const head = this.box[0]!;
        let res: Result;
        try {
          res = await this.remote.call(head);
        } catch (e) {
          if (!this.warned) { this.warned = true; this.hooks.onWarn('Server sanga jodina sakiena. Khel chalchha, pachhi sync huncha.'); }
          void e;
          this.later(this.wait);
          this.wait = Math.min(this.wait * 2, this.opt.maxRetryMs);
          return;
        }
        this.wait = this.opt.retryMs;
        this.warned = false;
        if (!res.ok && (res.error === 'too_fast' || res.error === 'busy')) {
          this.later(this.opt.gapMs); // action rakhne, thorai pachhi feri
          return;
        }
        this.box.shift();
        this.save();
        if (res.ok) this.lastGained = res.gained;
        else if (res.error === 'no_coins') this.hooks.onWarn('Coin pugena (server).');
        const snapshot = res.profile;
        const gained = res.ok ? res.gained : undefined;
        if (snapshot && this.box.length === 0) this.apply(snapshot);
        this.hooks.onUpdate(gained);
        if (this.box.length) await new Promise<void>((r) => setTimeout(r, this.opt.gapMs));
      }
    } finally {
      this.busy = false;
    }
  }

  /** Server ko profile local object ma (object chai wahi, UI le reference rakheko chha). */
  private apply(sp: ServerProfile): void {
    const target = this.profile as unknown as Record<string, unknown>;
    for (const k of FIELDS) {
      if (sp[k] !== undefined) target[k] = structuredClone(sp[k]);
      else delete target[k];
    }
  }

  private read(): Action[] {
    try {
      const raw = this.opt.storage?.getItem(OUTBOX_KEY);
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v.filter((x) => typeof x === 'object' && x && typeof x.a === 'string') : [];
    } catch { return []; }
  }

  private save(): void {
    try { this.opt.storage?.setItem(OUTBOX_KEY, JSON.stringify(this.box)); } catch { /* storage chhaina */ }
  }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
