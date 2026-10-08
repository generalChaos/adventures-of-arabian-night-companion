-- MVP 2: wealth levels content (names/allowances pending rulebook verify)

create table public.wealth_levels (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  ordinal integer not null,
  name text not null,
  land_movement integer not null default 1,
  sea_movement integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (edition_id, ordinal),
  unique (edition_id, name)
);

alter table public.player_state
  add constraint player_state_wealth_level_id_fkey
  foreign key (wealth_level_id) references public.wealth_levels (id);

alter table public.wealth_levels enable row level security;

create policy "wealth_levels_select_authenticated"
  on public.wealth_levels for select
  to authenticated
  using (true);

-- Fixed ids for default edition (verify movement values against rulebook)
insert into public.wealth_levels (
  id, edition_id, ordinal, name, land_movement, sea_movement, metadata
) values
  (
    '55555555-5555-4555-8555-555555555501',
    '11111111-1111-4111-8111-111111111111',
    0, 'Destitute', 1, 0,
    '{"unverified": true}'::jsonb
  ),
  (
    '55555555-5555-4555-8555-555555555502',
    '11111111-1111-4111-8111-111111111111',
    1, 'Poor', 2, 0,
    '{"unverified": true, "default_start": true}'::jsonb
  ),
  (
    '55555555-5555-4555-8555-555555555503',
    '11111111-1111-4111-8111-111111111111',
    2, 'Average', 3, 1,
    '{"unverified": true}'::jsonb
  ),
  (
    '55555555-5555-4555-8555-555555555504',
    '11111111-1111-4111-8111-111111111111',
    3, 'Prosperous', 3, 2,
    '{"unverified": true}'::jsonb
  ),
  (
    '55555555-5555-4555-8555-555555555505',
    '11111111-1111-4111-8111-111111111111',
    4, 'Rich', 4, 2,
    '{"unverified": true}'::jsonb
  ),
  (
    '55555555-5555-4555-8555-555555555506',
    '11111111-1111-4111-8111-111111111111',
    5, 'Fabulously Rich', 4, 3,
    '{"unverified": true}'::jsonb
  );
