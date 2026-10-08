-- Game session schema (Spike 1)

create table public.games (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id),
  join_code text not null unique,
  status text not null default 'LOBBY'
    check (status in ('LOBBY', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED')),
  current_turn_player_id uuid,
  turn_number integer not null default 0,
  phase text not null default 'LOBBY',
  state_version integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  role text not null default 'PLAYER'
    check (role in ('HOST', 'PLAYER', 'SPECTATOR')),
  display_name text not null,
  character_id text,
  seat integer,
  player_color text not null,
  joined_at timestamptz not null default now(),
  unique (game_id, user_id),
  unique (game_id, seat)
);

alter table public.games
  add constraint games_current_turn_player_fk
  foreign key (current_turn_player_id) references public.game_players (id);

create table public.player_state (
  game_player_id uuid primary key references public.game_players (id) on delete cascade,
  current_location_id uuid references public.locations (id),
  wealth_level_id uuid,
  story_points integer not null default 0,
  destiny_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  sequence integer not null,
  actor_player_id uuid references public.game_players (id),
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  reversible boolean not null default true,
  reverts_action_id uuid references public.game_actions (id),
  previous_state_version integer not null,
  resulting_state_version integer not null,
  created_at timestamptz not null default now(),
  unique (game_id, sequence)
);

create index game_actions_game_seq_idx on public.game_actions (game_id, sequence desc);
