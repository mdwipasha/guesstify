-- Online Mode's private state lives in game_rooms. Clients never query these tables;
-- Vercel functions use the server-only Supabase secret key and publish safe snapshots.
create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  host_member_id uuid,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  spotify_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, spotify_id)
);

alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;

-- There are deliberately no anon/authenticated policies: browser clients cannot read or
-- mutate private room state. The server-only secret key bypasses RLS after it validates
-- Spotify session membership on every action.
revoke all on public.game_rooms, public.room_players from anon, authenticated;
grant all on public.game_rooms, public.room_players to service_role;

create index if not exists room_players_room_id_idx on public.room_players(room_id);
create index if not exists room_players_room_spotify_idx on public.room_players(room_id, spotify_id);
