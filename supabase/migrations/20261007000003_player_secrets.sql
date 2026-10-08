-- MVP 2: owner-only victory goals

create table public.player_secrets (
  game_player_id uuid primary key
    references public.game_players (id) on delete cascade,
  story_goal integer not null check (story_goal >= 0),
  destiny_goal integer not null check (destiny_goal >= 0),
  chosen_at timestamptz not null default now(),
  revealed_at timestamptz
);

alter table public.player_secrets enable row level security;

-- OWNER only: not even other members / host can SELECT
create policy "player_secrets_select_owner"
  on public.player_secrets for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.id = game_player_id
        and gp.user_id = auth.uid()
    )
  );

-- No insert/update/delete policies for clients — mutations go through server commands.
