-- RLS: members can read their game's public tables; non-members see nothing.
-- Clients never read game_actions.changes — only game_action_log.

alter table public.game_editions enable row level security;
alter table public.locations enable row level security;
alter table public.board_location_layout enable row level security;
alter table public.board_edges enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.player_state enable row level security;
alter table public.game_actions enable row level security;

revoke all on public.game_actions from anon, authenticated;
revoke all on public.game_actions from public;

-- Content is readable by any authenticated user (needed before joining)
create policy "editions_select_authenticated"
  on public.game_editions for select
  to authenticated
  using (true);

create policy "locations_select_authenticated"
  on public.locations for select
  to authenticated
  using (true);

create policy "layout_select_authenticated"
  on public.board_location_layout for select
  to authenticated
  using (true);

create policy "edges_select_authenticated"
  on public.board_edges for select
  to authenticated
  using (true);

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = auth.uid()
  );
$$;

create policy "games_select_member"
  on public.games for select
  to authenticated
  using (public.is_game_member(id));

-- Allow reading a lobby game before membership (join flow)
create policy "games_select_lobby"
  on public.games for select
  to authenticated
  using (status = 'LOBBY');

create policy "game_players_select_member"
  on public.game_players for select
  to authenticated
  using (public.is_game_member(game_id));

create policy "game_players_select_lobby"
  on public.game_players for select
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and g.status = 'LOBBY'
    )
  );

create policy "player_state_select_member"
  on public.player_state for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.id = game_player_id
        and public.is_game_member(gp.game_id)
    )
  );

-- No SELECT policy on game_actions for authenticated → table denied.
-- Public log via security-definer function that strips `changes`.

drop view if exists public.game_action_log;

create or replace function public.list_game_action_log(p_game_id uuid)
returns table (
  id uuid,
  game_id uuid,
  sequence integer,
  actor_player_id uuid,
  action_type text,
  payload jsonb,
  reversible boolean,
  reverts_action_id uuid,
  previous_state_version integer,
  resulting_state_version integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ga.id,
    ga.game_id,
    ga.sequence,
    ga.actor_player_id,
    ga.action_type,
    ga.payload,
    ga.reversible,
    ga.reverts_action_id,
    ga.previous_state_version,
    ga.resulting_state_version,
    ga.created_at
  from public.game_actions ga
  where ga.game_id = p_game_id
    and public.is_game_member(p_game_id)
  order by ga.sequence;
$$;

grant execute on function public.list_game_action_log(uuid) to authenticated;
