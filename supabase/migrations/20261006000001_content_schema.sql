-- Content schema (Spike 1 minimal)
create extension if not exists "pgcrypto";

create table public.game_editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  publisher_reference text,
  language text not null default 'en',
  version text not null default '1',
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  slug text not null,
  name text not null,
  region text,
  space_type text not null default 'CITY',
  is_port boolean not null default false,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  unique (edition_id, slug)
);

create table public.board_location_layout (
  location_id uuid primary key references public.locations (id) on delete cascade,
  layout_id text not null default 'default',
  x_normalized numeric(6, 5) not null check (x_normalized >= 0 and x_normalized <= 1),
  y_normalized numeric(6, 5) not null check (y_normalized >= 0 and y_normalized <= 1),
  token_offset_x numeric(6, 5) not null default 0,
  token_offset_y numeric(6, 5) not null default 0
);

create table public.board_edges (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  from_location_id uuid not null references public.locations (id) on delete cascade,
  to_location_id uuid not null references public.locations (id) on delete cascade,
  connection_type text not null check (connection_type in ('LAND', 'SEA')),
  metadata jsonb not null default '{}'::jsonb,
  check (from_location_id <> to_location_id)
);

create index board_edges_from_idx on public.board_edges (from_location_id);
create index board_edges_to_idx on public.board_edges (to_location_id);
