create table if not exists public.game_history (
  id uuid primary key default gen_random_uuid(),
  spotify_id text not null,
  played_at timestamptz not null default now(),
  mode text not null check (mode in ('solo', 'party', 'online')),
  source_id text not null,
  source_name text not null check (char_length(source_name) between 1 and 160),
  score integer not null check (score >= 0),
  correct_answers integer not null check (correct_answers >= 0),
  total_rounds integer not null check (total_rounds > 0),
  accuracy integer not null check (accuracy between 0 and 100),
  details jsonb not null default '{}'::jsonb
);

alter table public.game_history enable row level security;
revoke all on public.game_history from anon, authenticated;
grant all on public.game_history to service_role;
create index if not exists game_history_owner_played_idx on public.game_history (spotify_id, played_at desc);
