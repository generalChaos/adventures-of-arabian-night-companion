-- MVP 2: skills content + player mastery

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  unique (edition_id, slug)
);

create table public.player_skills (
  id uuid primary key default gen_random_uuid(),
  game_player_id uuid not null references public.game_players (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  mastery_level integer not null default 1 check (mastery_level >= 0 and mastery_level <= 3),
  source text not null default 'manual',
  unique (game_player_id, skill_id)
);

alter table public.skills enable row level security;
alter table public.player_skills enable row level security;

create policy "skills_select_authenticated"
  on public.skills for select
  to authenticated
  using (true);

create policy "player_skills_select_member"
  on public.player_skills for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.id = game_player_id
        and public.is_game_member(gp.game_id)
    )
  );

insert into public.skills (id, edition_id, slug, name, description) values
  ('66666666-6666-4666-8666-666666666601', '11111111-1111-4111-8111-111111111111', 'weapon_use', 'Weapon Use', 'Unverified skill list seed'),
  ('66666666-6666-4666-8666-666666666602', '11111111-1111-4111-8111-111111111111', 'stealth', 'Stealth', 'Unverified skill list seed'),
  ('66666666-6666-4666-8666-666666666603', '11111111-1111-4111-8111-111111111111', 'courtly_graces', 'Courtly Graces', 'Unverified skill list seed'),
  ('66666666-6666-4666-8666-666666666604', '11111111-1111-4111-8111-111111111111', 'wisdom', 'Wisdom', 'Unverified skill list seed'),
  ('66666666-6666-4666-8666-666666666605', '11111111-1111-4111-8111-111111111111', 'storytelling', 'Storytelling', 'Unverified skill list seed');
