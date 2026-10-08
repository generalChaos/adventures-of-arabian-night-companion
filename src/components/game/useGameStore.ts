"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "@/domain/game/types/game";
import { createBrowserSupabaseClient } from "@/infrastructure/database/supabase/client";

export type PresenceEntry = {
  playerId: string;
  displayName: string;
  onlineAt: string;
};

export function useGameStore(initial: GameSnapshot) {
  const [snapshot, setSnapshot] = useState(initial);
  const [connection, setConnection] = useState<"connected" | "reconnecting" | "offline">(
    "connected",
  );
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const versionRef = useRef(initial.game.stateVersion);
  const gameId = initial.game.id;
  const meRef = useRef(initial.me);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) return;
    const data = (await res.json()) as GameSnapshot;
    versionRef.current = data.game.stateVersion;
    setSnapshot(data);
  }, [gameId]);

  useEffect(() => {
    meRef.current = snapshot.me;
  }, [snapshot.me]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`game:${gameId}`, {
      config: { presence: { key: meRef.current?.id ?? crypto.randomUUID() } },
    });

    const syncPresence = () => {
      const state = channel.presenceState<PresenceEntry>();
      const entries: PresenceEntry[] = [];
      for (const key of Object.keys(state)) {
        const metas = state[key] ?? [];
        const latest = metas[metas.length - 1];
        if (latest) entries.push(latest);
      }
      setPresence(entries);
    };

    channel
      .on("broadcast", { event: "GAME_UPDATED" }, () => {
        void refresh();
      })
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          const me = meRef.current;
          if (me) {
            await channel.track({
              playerId: me.id,
              displayName: me.displayName,
              onlineAt: new Date().toISOString(),
            });
          }
          void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting");
        } else if (status === "CLOSED") {
          setConnection("offline");
        }
      });

    const poll = window.setInterval(() => {
      void refresh();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [gameId, refresh]);

  return {
    snapshot,
    setSnapshot: (next: GameSnapshot) => {
      versionRef.current = next.game.stateVersion;
      setSnapshot(next);
    },
    connection,
    presence,
    refresh,
  };
}
