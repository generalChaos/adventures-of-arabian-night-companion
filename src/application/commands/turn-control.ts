import { and, asc, eq } from "drizzle-orm";
import { gameActions, gamePlayers, games } from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type {
  EndTurnCommand,
  PauseGameCommand,
  ResumeGameCommand,
} from "@/domain/game/types/commands";
import type { GameId } from "@/domain/game/types/ids";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleEndTurn(
  ctx: CommandContext,
  command: EndTurnCommand,
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
    if (game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Game is not active");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");
    if (game.currentTurnPlayerId !== actor.id && actor.role !== "HOST") {
      throw new DomainError("INVALID_ACTION", "Not your turn");
    }

    const players = await tx
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, game.id))
      .orderBy(asc(gamePlayers.seat));

    const currentId = game.currentTurnPlayerId ?? actor.id;
    const idx = players.findIndex((p) => p.id === currentId);
    const next = players[(idx + 1) % players.length];
    if (!next) throw new DomainError("INVALID_ACTION", "No next player");

    const nextVersion = game.stateVersion + 1;
    const nextTurnNumber =
      idx + 1 >= players.length ? game.turnNumber + 1 : game.turnNumber;

    await tx
      .update(games)
      .set({
        currentTurnPlayerId: next.id,
        turnNumber: nextTurnNumber,
        phase: "TURN_START",
        stateVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "END_TURN",
      payload: {
        fromPlayerId: currentId,
        toPlayerId: next.id,
        turnNumber: nextTurnNumber,
      },
      changes: [
        {
          table: "games",
          key: { id: game.id },
          before: {
            current_turn_player_id: game.currentTurnPlayerId,
            turn_number: game.turnNumber,
          },
          after: {
            current_turn_player_id: next.id,
            turn_number: nextTurnNumber,
          },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}

export async function handlePauseGame(
  ctx: CommandContext,
  command: PauseGameCommand,
): Promise<CommandResult> {
  return setStatus(ctx, command, "ACTIVE", "PAUSED", "PAUSE_GAME");
}

export async function handleResumeGame(
  ctx: CommandContext,
  command: ResumeGameCommand,
): Promise<CommandResult> {
  return setStatus(ctx, command, "PAUSED", "ACTIVE", "RESUME_GAME");
}

async function setStatus(
  ctx: CommandContext,
  command: { gameId: GameId; expectedVersion: number },
  from: string,
  to: string,
  actionType: string,
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

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor || actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Only the host can change game status");
    }
    if (game.status !== from) {
      throw new DomainError("INVALID_ACTION", `Game must be ${from}`);
    }

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ status: to, stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType,
      payload: { from, to },
      changes: [
        {
          table: "games",
          key: { id: game.id },
          before: { status: from },
          after: { status: to },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
