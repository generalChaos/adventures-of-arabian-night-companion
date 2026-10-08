-- M4-2: edition component counts for library progress

create table public.edition_manifest (
  edition_id uuid primary key references public.game_editions (id) on delete cascade,
  encounter_cards integer not null default 0,
  treasure_cards integer not null default 0,
  quest_cards integer not null default 0,
  status_cards integer not null default 0,
  skills integer not null default 0,
  wealth_levels integer not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.edition_manifest enable row level security;

create policy "edition_manifest_select_authenticated"
  on public.edition_manifest for select
  to authenticated
  using (true);

-- Placeholder targets pending RV-6 verification
insert into public.edition_manifest (
  edition_id,
  encounter_cards,
  treasure_cards,
  quest_cards,
  status_cards,
  skills,
  wealth_levels,
  notes
) values (
  '11111111-1111-4111-8111-111111111111',
  120,
  40,
  30,
  26,
  12,
  6,
  'Unverified BGG-inspired targets; replace after RV-6'
);
