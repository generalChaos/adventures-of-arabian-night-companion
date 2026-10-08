import { and, asc, eq } from "drizzle-orm";
import { gameActions, gamePlayers, games } from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { StartGameCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { ensureGamePiles } from "./decks";
import type { CommandContext, CommandResult } from "./types";

export async function handleStartGame(
  ctx: CommandContext,
  command: StartGameCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, command.gameId))
      .for("update")
      .limit(1);

    if (!game) throw new DomainError("NOT_FOUND", "Game not found");
    assertExpectedVersion(game.stateVersion, command.expectedVersion);
    if (game.status !== "LOBBY") {
      throw new DomainError("INVALID_ACTION", "Game already started");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)),
      )
      .limit(1);

    if (!actor || actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Only the host can start the game");
    }

    const players = await tx
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, game.id))
      .orderBy(asc(gamePlayers.seat));

    if (players.length < 1) {
      throw new DomainError("INVALID_ACTION", "Need at least one player");
    }

    const first = players[0]!;
    const nextVersion = game.stateVersion + 1;

    await ensureGamePiles(tx, game.id, game.editionId);

    await tx
      .update(games)
      .set({
        status: "ACTIVE",
        phase: "TURN_START",
        turnNumber: 1,
        currentTurnPlayerId: first.id,
        startedAt: new Date(),
        stateVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "START_GAME",
      payload: { currentTurnPlayerId: first.id },
      changes: [
        {
          table: "games",
          key: { id: game.id },
          before: { status: "LOBBY", phase: "LOBBY" },
          after: { status: "ACTIVE", phase: "TURN_START", turnNumber: 1 },
        },
      ],
      reversible: false,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
