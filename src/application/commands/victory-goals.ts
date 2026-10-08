import { and, eq, inArray } from "drizzle-orm";
import {
  gameActions,
  gamePlayers,
  games,
  playerSecrets,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import {
  assertValidGoalSplit,
  VICTORY_POINT_TOTAL,
} from "@/domain/game/rules/victory-goals";
import { DomainError } from "@/domain/game/types/errors";
import type {
  RevealGoalsCommand,
  SetVictoryGoalsCommand,
} from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleSetVictoryGoals(
  ctx: CommandContext,
  command: SetVictoryGoalsCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  try {
    assertValidGoalSplit(command.storyGoal, command.destinyGoal);
  } catch (error) {
    throw new DomainError(
      "INVALID_ACTION",
      error instanceof Error ? error.message : "Invalid goals",
    );
  }

  await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, command.gameId))
      .for("update")
      .limit(1);

    if (!game) throw new DomainError("NOT_FOUND", "Game not found");
    assertExpectedVersion(game.stateVersion, command.expectedVersion);
    if (game.status !== "LOBBY" && game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Cannot set goals now");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)),
      )
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const [existing] = await tx
      .select()
      .from(playerSecrets)
      .where(eq(playerSecrets.gamePlayerId, actor.id))
      .limit(1);

    if (existing?.revealedAt) {
      throw new DomainError("INVALID_ACTION", "Goals already revealed");
    }

    if (existing) {
      await tx
        .update(playerSecrets)
        .set({
          storyGoal: command.storyGoal,
          destinyGoal: command.destinyGoal,
          chosenAt: new Date(),
        })
        .where(eq(playerSecrets.gamePlayerId, actor.id));
    } else {
      await tx.insert(playerSecrets).values({
        gamePlayerId: actor.id,
        storyGoal: command.storyGoal,
        destinyGoal: command.destinyGoal,
      });
    }

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "SET_VICTORY_GOALS",
      // Redacted public payload — never log the split
      payload: {
        playerId: actor.id,
        displayName: actor.displayName,
        total: VICTORY_POINT_TOTAL,
      },
      changes: [],
      reversible: false,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}

export async function handleRevealGoals(
  ctx: CommandContext,
  command: RevealGoalsCommand,
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
      .where(
        and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)),
      )
      .limit(1);
    if (!actor || actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Only the host can reveal goals");
    }

    const players = await tx
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, game.id));
    const playerIds = players.map((p) => p.id);
    if (playerIds.length === 0) {
      throw new DomainError("INVALID_ACTION", "No players");
    }

    const secrets = await tx
      .select()
      .from(playerSecrets)
      .where(inArray(playerSecrets.gamePlayerId, playerIds));

    if (secrets.length === 0) {
      throw new DomainError("INVALID_ACTION", "No goals to reveal");
    }

    const now = new Date();
    await tx
      .update(playerSecrets)
      .set({ revealedAt: now })
      .where(inArray(playerSecrets.gamePlayerId, playerIds));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({
        status: game.status === "ACTIVE" ? "COMPLETED" : game.status,
        finishedAt: game.status === "ACTIVE" ? now : game.finishedAt,
        stateVersion: nextVersion,
        updatedAt: now,
      })
      .where(eq(games.id, game.id));

    const revealed = secrets.map((s) => {
      const p = players.find((pl) => pl.id === s.gamePlayerId);
      return {
        playerId: s.gamePlayerId,
        displayName: p?.displayName ?? "Player",
        storyGoal: s.storyGoal,
        destinyGoal: s.destinyGoal,
      };
    });

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "REVEAL_GOALS",
      payload: { goals: revealed },
      changes: [],
      reversible: false,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
