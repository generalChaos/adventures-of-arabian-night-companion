import { and, eq } from "drizzle-orm";
import { gameEncounters } from "@/infrastructure/database/schema";
import type { Db } from "@/infrastructure/database/drizzle";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Move REACTION_CHOSEN → RESOLVING when the first result is applied. */
export async function markEncounterResolving(
  tx: Tx,
  gameId: string,
  playerId: string,
) {
  const [encounter] = await tx
    .select()
    .from(gameEncounters)
    .where(
      and(
        eq(gameEncounters.gameId, gameId),
        eq(gameEncounters.playerId, playerId),
        eq(gameEncounters.state, "REACTION_CHOSEN"),
      ),
    )
    .limit(1);
  if (!encounter) return;
  await tx
    .update(gameEncounters)
    .set({ state: "RESOLVING" })
    .where(eq(gameEncounters.id, encounter.id));
}
