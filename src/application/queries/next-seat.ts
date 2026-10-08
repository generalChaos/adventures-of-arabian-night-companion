import { asc, eq } from "drizzle-orm";
import { gamePlayers } from "@/infrastructure/database/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = { select: (...args: any[]) => any };

export async function nextSeatPlayerId(
  db: DbLike,
  gameId: string,
  currentPlayerId: string,
): Promise<string | null> {
  const players = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId))
    .orderBy(asc(gamePlayers.seat));
  if (players.length === 0) return null;
  const idx = players.findIndex((p: { id: string }) => p.id === currentPlayerId);
  if (idx < 0) return players[0]?.id ?? null;
  const next = players[(idx + 1) % players.length];
  return next?.id ?? null;
}
