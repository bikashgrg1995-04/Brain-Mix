import type { Action, Result } from '../../server/game';

/** Server sanga kura garne. Network/auth fail bhaye throw (caller le pachhi feri try garchha). Server ko jawaf (ok:false pani) return. */
export interface Remote {
  call(a: Action): Promise<Result>;
}

/**
 * Supabase: anonymous login (Dashboard > Authentication > Sign in/Providers > "Allow anonymous sign-ins" on garnus)
 * ra Edge Function `game`. Session localStorage ma: tyahi device ma sadhai same khelaadi.
 */
export function supabaseRemote(url: string, anonKey: string): Remote {
  let client: import('@supabase/supabase-js').SupabaseClient | null = null;

  async function ready(): Promise<import('@supabase/supabase-js').SupabaseClient> {
    if (!client) {
      const { createClient } = await import('@supabase/supabase-js');
      client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shabda-auth', detectSessionInUrl: false } });
    }
    const { data } = await client.auth.getSession();
    if (!data.session) {
      const { error } = await client.auth.signInAnonymously();
      if (error) throw new Error(`login: ${error.message}`);
    }
    return client;
  }

  return {
    async call(a: Action): Promise<Result> {
      const c = await ready();
      const { data, error } = await c.functions.invoke('game', { body: a });
      if (error) throw new Error(error.message);
      return data as Result;
    },
  };
}
