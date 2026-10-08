-- Fix broadcast signature: realtime.send(payload, event, topic, private)

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
    payload,
    'GAME_UPDATED',
    'game:' || NEW.game_id::text,
    false
  );

  return NEW;
exception
  when others then
    raise warning 'realtime broadcast failed for game %: %', NEW.game_id, SQLERRM;
    return NEW;
end;
$$;
