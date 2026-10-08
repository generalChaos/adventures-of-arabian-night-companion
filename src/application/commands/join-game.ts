import { and, eq, sql } from "drizzle-orm";
import {
  gameActions,
  gamePlayers,
  games,
  locations,
  playerState,
} from "@/infrastructure/database/schema";
import { normalizeJoinCode } from "@/domain/game/rules/join-code";
import { colorForSeat } from "@/domain/game/rules/player-colors";
import { DomainError } from "@/domain/game/types/errors";
import type { JoinGameCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { resolveDefaultWealthLevelId } from "@/application/services/wealth";
import type { CommandContext, CommandResult } from "./types";

export async function handleJoinGame(
  ctx: CommandContext,
  command: JoinGameCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;
  const joinCode = normalizeJoinCode(command.joinCode);
  const displayName = command.displayName.trim();
  if (!displayName) throw new DomainError("INVALID_ACTION", "Display name required");

  const gameId = await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.joinCode, joinCode))
      .for("update")
      .limit(1);

    if (!game) throw new DomainError("NOT_FOUND", "Game not found");
    if (game.status !== "LOBBY") {
      throw new DomainError("INVALID_ACTION", "Game is not accepting players");
    }

    const existing = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);

    if (existing[0]) return game.id;

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, game.id));

    const seat = Number(count);
    if (seat >= 6) throw new DomainError("INVALID_ACTION", "Game is full");

    const [preferred] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.editionId, game.editionId), eq(locations.slug, "baghdad")),
      )
      .limit(1);

    const [startLocation] =
      preferred != null
        ? [preferred]
        : await tx
            .select({ id: locations.id })
            .from(locations)
            .where(eq(locations.editionId, game.editionId))
            .limit(1);

    const [player] = await tx
      .insert(gamePlayers)
      .values({
        gameId: game.id,
        userId,
        role: "PLAYER",
        displayName,
        seat,
        playerColor: colorForSeat(seat),
      })
      .returning();

    if (!player) throw new DomainError("INVALID_ACTION", "Failed to join");

    const wealthLevelId = await resolveDefaultWealthLevelId(tx, game.editionId);

    await tx.insert(playerState).values({
      gamePlayerId: player.id,
      currentLocationId: startLocation?.id ?? null,
      wealthLevelId,
    });

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: player.id,
      actionType: "JOIN_GAME",
      payload: { displayName },
      changes: [
        {
          table: "game_players",
          key: { id: player.id },
          before: null,
          after: { displayName, seat, role: "PLAYER" },
        },
      ],
      reversible: false,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });

    return game.id;
  });

  return { snapshot: await loadGameSnapshot(db, gameId, userId) };
}
