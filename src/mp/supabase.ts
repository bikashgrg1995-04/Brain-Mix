import type { Msg, Peer } from '../../shared/multiplayer';
import type { Handlers, Transport } from './session';

const SYNC_WAIT_MS = 8000;

/**
 * Supabase Realtime: kunai table chahidaina. Room = ek channel (`shabda:CODE`), message = broadcast, kaun chha = presence.
 * Supabase-js dynamic import: multiplayer nakhelne le download garnu pardaina.
 */
export function supabaseTransport(url: string, anonKey: string): Transport {
  let client: import('@supabase/supabase-js').SupabaseClient | null = null;
  let ch: import('@supabase/supabase-js').RealtimeChannel | null = null;
  let closed = false;

  return {
    async connect(room: string, me: Peer, h: Handlers): Promise<void> {
      const { createClient } = await import('@supabase/supabase-js');
      client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, realtime: { params: { eventsPerSecond: 10 } } });
      const channel = client.channel(`shabda:${room}`, { config: { broadcast: { self: true, ack: false }, presence: { key: me.id } } });
      ch = channel;
      let first = true;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Server le jawaf diena')), SYNC_WAIT_MS);
        channel
          .on('broadcast', { event: 'm' }, ({ payload }) => h.onMsg(payload as Msg))
          .on('presence', { event: 'sync' }, () => {
            const peers: Peer[] = Object.values(channel.presenceState<Peer>()).map((arr) => arr[0]!).filter(Boolean);
            h.onPresence(peers);
            if (first) { first = false; window.clearTimeout(timer); resolve(); }
          })
          .subscribe(async (status, err) => {
            if (status === 'SUBSCRIBED') {
              await channel.track(me);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              window.clearTimeout(timer);
              if (first) reject(new Error(err?.message ?? status));
              else if (!closed) h.onClose('Internet / server ko connection tutyo');
            }
          });
      });
    },
    send(m: Msg): void {
      void ch?.send({ type: 'broadcast', event: 'm', payload: m });
    },
    close(): void {
      closed = true;
      if (client && ch) void client.removeChannel(ch);
      ch = null;
    },
  };
}
