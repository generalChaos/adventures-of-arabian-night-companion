-- MVP 2: player treasures + a few seed cards

create table public.player_treasures (
  id uuid primary key default gen_random_uuid(),
  game_player_id uuid not null references public.game_players (id) on delete cascade,
  treasure_card_id uuid not null references public.cards (id),
  state text not null default 'HELD'
    check (state in ('HELD', 'LOST', 'SPENT')),
  acquired_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index player_treasures_player_idx on public.player_treasures (game_player_id);

alter table public.player_treasures enable row level security;

create policy "player_treasures_select_member"
  on public.player_treasures for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.id = game_player_id
        and public.is_game_member(gp.game_id)
    )
  );

insert into public.cards (id, edition_id, card_type, card_number, title, status)
values
  ('33333333-3333-4333-8333-333333333305', '11111111-1111-4111-8111-111111111111', 'TREASURE', 1, 'Magic Carpet', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333306', '11111111-1111-4111-8111-111111111111', 'TREASURE', 2, 'Diamond Ring', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333307', '11111111-1111-4111-8111-111111111111', 'TREASURE', 3, 'Enchanted Lamp', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333308', '11111111-1111-4111-8111-111111111111', 'STATUS', 2, 'Blessed', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333309', '11111111-1111-4111-8111-111111111111', 'STATUS', 3, 'Cursed', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333310', '11111111-1111-4111-8111-111111111111', 'QUEST', 1, 'Find the Lost City', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111111', 'QUEST', 2, 'Deliver the Message', 'PUBLISHED');
