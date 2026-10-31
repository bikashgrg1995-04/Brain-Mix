-- Shabda: khelaadi ko server-side profile (coin, XP, badge, daily inam).
-- Sabai lekhne kaam Edge Function `game` le service role bata garchha. Client (anon/authenticated) le
-- yo table seedha padhna/lekhna sakdaina: RLS on chha ra kunai policy chhaina, tesaile coin edit garna milchhaina.

create table if not exists public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  profile     jsonb       not null,
  version     integer     not null default 1,          -- optimistic lock: ek-sathai duita request ma harauna
  xp          integer     not null default 0,          -- leaderboard ko lagi (profile.xp ko copy)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.players enable row level security;
-- (jaanabujhera kunai policy chhaina: service role RLS bypass garchha, baaki sabai band)

create index if not exists players_xp_idx on public.players (xp desc);
