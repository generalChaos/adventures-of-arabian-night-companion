import { and, eq } from "drizzle-orm";
import {
  gameActions,
  gamePlayers,
  games,
  playerState,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { AdjustPointsCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { markEncounterResolving } from "./encounter-resolving";
import type { CommandContext, CommandResult } from "./types";

export async function handleAdjustPoints(
  ctx: CommandContext,
  command: AdjustPointsCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  if (!command.storyDelta && !command.destinyDelta) {
    throw new DomainError("INVALID_ACTION", "No point change requested");
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
    if (game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Game is not active");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const [target] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.id, command.playerId), eq(gamePlayers.gameId, game.id)),
      )
      .limit(1);
    if (!target) throw new DomainError("NOT_FOUND", "Player not found");
    if (actor.id !== target.id && actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Can only adjust your own points");
    }

    const [state] = await tx
      .select()
      .from(playerState)
      .where(eq(playerState.gamePlayerId, target.id))
      .limit(1);
    if (!state) throw new DomainError("NOT_FOUND", "Player state missing");

    const storyPoints = Math.max(
      0,
      state.storyPoints + (command.storyDelta ?? 0),
    );
    const destinyPoints = Math.max(
      0,
      state.destinyPoints + (command.destinyDelta ?? 0),
    );

    await tx
      .update(playerState)
      .set({ storyPoints, destinyPoints, updatedAt: new Date() })
      .where(eq(playerState.gamePlayerId, target.id));

    await markEncounterResolving(tx, game.id, target.id);

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "ADJUST_POINTS",
      payload: {
        playerId: target.id,
        storyDelta: command.storyDelta ?? 0,
        destinyDelta: command.destinyDelta ?? 0,
        storyPoints,
        destinyPoints,
      },
      changes: [
        {
          table: "player_state",
          key: { game_player_id: target.id },
          before: {
            story_points: state.storyPoints,
            destiny_points: state.destinyPoints,
          },
          after: {
            story_points: storyPoints,
            destiny_points: destinyPoints,
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
