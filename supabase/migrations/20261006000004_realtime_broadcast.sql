-- Broadcast public game events from the database after each committed action.
-- Requires Supabase Realtime (realtime.send available on hosted / local Supabase).

create or replace function public.broadcast_game_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', 'GAME_UPDATED',
    'gameId', NEW.game_id,
    'actionType', NEW.action_type,
    'sequence', NEW.sequence,
    'resultingStateVersion', NEW.resulting_state_version,
    'actorPlayerId', NEW.actor_player_id,
    'payload', NEW.payload
  );

  perform realtime.send(
    jsonb_build_object('topic', 'game:' || NEW.game_id::text, 'event', 'GAME_UPDATED', 'payload', payload, 'private', true)
  );

  return NEW;
exception
  when undefined_function then
    -- Local/dev environments without realtime.send still accept actions.
    raise warning 'realtime.send unavailable; skipping broadcast for game %', NEW.game_id;
    return NEW;
  when others then
    raise warning 'realtime broadcast failed for game %: %', NEW.game_id, SQLERRM;
    return NEW;
end;
$$;

create trigger game_actions_broadcast
  after insert on public.game_actions
  for each row
  execute function public.broadcast_game_action();
