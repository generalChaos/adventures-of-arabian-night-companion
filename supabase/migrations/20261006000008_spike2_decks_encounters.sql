-- Spike 2: cards, piles, statuses, encounters, matrices (minimal)

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  card_type text not null
    check (card_type in ('QUEST', 'TREASURE', 'ENCOUNTER', 'STATUS', 'REFERENCE', 'OTHER')),
  card_number integer,
  title text not null,
  source_image_id text,
  status text not null default 'PUBLISHED'
    check (status in ('MISSING', 'DRAFT', 'REVIEWED', 'PUBLISHED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_content (
  card_id uuid primary key references public.cards (id) on delete cascade,
  schema_version integer not null default 1,
  content_json jsonb not null default '{}'::jsonb
);

create table public.game_piles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  pile_type text not null
    check (pile_type in (
      'ENCOUNTER_DECK',
      'ENCOUNTER_DISCARD',
      'TREASURE_DECK',
      'TREASURE_DISCARD',
      'QUEST_DECK',
      'STATUS_SUPPLY',
      'REMOVED'
    )),
  owner_player_id uuid references public.game_players (id) on delete cascade
);

create unique index game_piles_shared_unique
  on public.game_piles (game_id, pile_type)
  where owner_player_id is null;

create table public.game_pile_cards (
  pile_id uuid not null references public.game_piles (id) on delete cascade,
  card_id uuid not null references public.cards (id),
  position integer not null,
  primary key (pile_id, card_id)
);

create table public.player_statuses (
  id uuid primary key default gen_random_uuid(),
  game_player_id uuid not null references public.game_players (id) on delete cascade,
  status_card_id uuid not null references public.cards (id),
  active boolean not null default true,
  acquired_at timestamptz not null default now(),
  removed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.reaction_matrices (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  matrix_number integer not null,
  unique (edition_id, matrix_number)
);

create table public.reaction_matrix_cells (
  matrix_id uuid not null references public.reaction_matrices (id) on delete cascade,
  row_key text not null,
  reaction text not null,
  paragraph_number integer not null,
  primary key (matrix_id, row_key, reaction)
);

create table public.encounter_chart_entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  encounter_key text not null,
  roll_min integer not null,
  roll_max integer not null,
  descriptor text not null,
  matrix_id uuid references public.reaction_matrices (id)
);

create table public.game_encounters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.game_players (id),
  location_id uuid references public.locations (id),
  encounter_card_id uuid references public.cards (id),
  die_roll integer,
  encounter_chart_entry_id uuid references public.encounter_chart_entries (id),
  reader_player_id uuid references public.game_players (id),
  chosen_reaction text,
  paragraph_number integer,
  state text not null default 'DRAWN'
    check (state in (
      'DRAWN',
      'DETERMINED',
      'REACTION_CHOSEN',
      'RESOLVING',
      'COMPLETE',
      'CANCELLED'
    )),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.cards enable row level security;
alter table public.card_content enable row level security;
alter table public.game_piles enable row level security;
alter table public.game_pile_cards enable row level security;
alter table public.player_statuses enable row level security;
alter table public.reaction_matrices enable row level security;
alter table public.reaction_matrix_cells enable row level security;
alter table public.encounter_chart_entries enable row level security;
alter table public.game_encounters enable row level security;

create policy "cards_select_authenticated"
  on public.cards for select to authenticated using (true);

create policy "card_content_select_authenticated"
  on public.card_content for select to authenticated using (true);

create policy "matrices_select_authenticated"
  on public.reaction_matrices for select to authenticated using (true);

create policy "matrix_cells_select_authenticated"
  on public.reaction_matrix_cells for select to authenticated using (true);

create policy "chart_select_authenticated"
  on public.encounter_chart_entries for select to authenticated using (true);

create policy "game_piles_select_member"
  on public.game_piles for select to authenticated
  using (public.is_game_member(game_id));

-- No SELECT on game_pile_cards for clients (SERVER_ONLY deck order)
revoke all on public.game_pile_cards from anon, authenticated;

create policy "player_statuses_select_member"
  on public.player_statuses for select to authenticated
  using (
    exists (
      select 1 from public.game_players gp
      where gp.id = game_player_id and public.is_game_member(gp.game_id)
    )
  );

-- Encounters: members can read, but paragraph_number only after reaction chosen
create or replace function public.list_public_encounters(p_game_id uuid)
returns table (
  id uuid,
  game_id uuid,
  player_id uuid,
  location_id uuid,
  encounter_card_id uuid,
  die_roll integer,
  encounter_chart_entry_id uuid,
  reader_player_id uuid,
  chosen_reaction text,
  paragraph_number integer,
  state text,
  started_at timestamptz,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.game_id,
    e.player_id,
    e.location_id,
    e.encounter_card_id,
    e.die_roll,
    e.encounter_chart_entry_id,
    e.reader_player_id,
    e.chosen_reaction,
    case
      when e.state in ('REACTION_CHOSEN', 'RESOLVING', 'COMPLETE') then e.paragraph_number
      else null
    end as paragraph_number,
    e.state,
    e.started_at,
    e.completed_at
  from public.game_encounters e
  where e.game_id = p_game_id
    and public.is_game_member(p_game_id);
$$;

grant execute on function public.list_public_encounters(uuid) to authenticated;

create or replace function public.pile_sizes(p_game_id uuid)
returns table (pile_type text, card_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select gp.pile_type, count(gpc.card_id)::int
  from public.game_piles gp
  left join public.game_pile_cards gpc on gpc.pile_id = gp.id
  where gp.game_id = p_game_id
    and public.is_game_member(p_game_id)
  group by gp.pile_type;
$$;

grant execute on function public.pile_sizes(uuid) to authenticated;
