// Supabase Edge Function `game`: coin/XP/badge/inam ko server ko niyam.
// `game.js` yaha ko bundle ho: `npm run build:server` le server/game.ts bata banaucha (git ma chaidaina).
// Deploy: npm run build:server && supabase functions deploy game
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore bundle (generated)
import { handle } from './game.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const store = {
  async load(id: string) {
    const { data, error } = await admin.from('players').select('profile, version').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? { profile: data.profile, version: data.version } : null;
  },
  async save(id: string, profile: { xp: number }, version: number | null): Promise<boolean> {
    if (version === null) {
      const { error } = await admin.from('players').insert({ id, profile, version: 1, xp: profile.xp });
      if (error) {
        if (error.code === '23505') return false; // arko request le pahilai banayo
        throw error;
      }
      return true;
    }
    const { data, error } = await admin
      .from('players')
      .update({ profile, version: version + 1, xp: profile.xp, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('version', version)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) === 1;
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  if (!jwt) return json({ error: 'auth' }, 401);
  const { data, error } = await admin.auth.getUser(jwt); // anon key matra bhaye user chhaina => 401
  if (error || !data.user) return json({ error: 'auth' }, 401);
  if (Number(req.headers.get('content-length') ?? 0) > 20_000) return json({ ok: false, error: 'bad_request' }, 413);
  const body = await req.json().catch(() => null);
  try {
    return json(await handle(store, data.user.id, body, Date.now()));
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: 'server' }, 500);
  }
});
