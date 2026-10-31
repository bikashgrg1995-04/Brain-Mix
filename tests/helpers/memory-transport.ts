import type { Msg, Peer } from '../../shared/multiplayer';
import type { Handlers, Transport } from '../../src/mp/session';

/** Test ko lagi: ek process bhitra Supabase Realtime jastai (broadcast self:true + presence). */
export class Hub {
  rooms = new Map<string, Set<MemoryTransport>>();
  queue: (() => void)[] = [];
  flush(): void {
    while (this.queue.length) this.queue.shift()!();
  }
}

export class MemoryTransport implements Transport {
  room = '';
  me!: Peer;
  h!: Handlers;
  open = false;
  constructor(private hub: Hub) {}

  async connect(room: string, me: Peer, h: Handlers): Promise<void> {
    this.room = room; this.me = me; this.h = h; this.open = true;
    const set = this.hub.rooms.get(room) ?? new Set();
    this.hub.rooms.set(room, set);
    set.add(this);
    h.onPresence([...set].map((t) => t.me)); // connect() pahilo presence sync pachhi matra resolve hunchha
    this.presence(room, this);
  }
  private presence(room: string, except?: MemoryTransport): void {
    const set = this.hub.rooms.get(room)!;
    const list = [...set].map((t) => t.me);
    for (const t of set) if (t !== except) this.hub.queue.push(() => t.open && t.h.onPresence(list));
  }
  send(m: Msg): void {
    for (const t of this.hub.rooms.get(this.room) ?? []) this.hub.queue.push(() => t.open && t.h.onMsg(structuredClone(m)));
  }
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.hub.rooms.get(this.room)?.delete(this);
    this.presence(this.room);
  }
}
