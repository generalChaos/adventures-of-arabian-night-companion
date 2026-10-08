import { and, asc, eq } from "drizzle-orm";
import {
  gameActions,
  gamePlayers,
  games,
  playerState,
  wealthLevels,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { stepWealthLevel } from "@/domain/game/rules/wealth";
import { DomainError } from "@/domain/game/types/errors";
import type { ChangeWealthCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { markEncounterResolving } from "./encounter-resolving";
import type { CommandContext, CommandResult } from "./types";

export async function handleChangeWealth(
  ctx: CommandContext,
  command: ChangeWealthCommand,
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
      .where(
        and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)),
      )
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const isSelf = actor.id === command.playerId;
    const isHost = actor.role === "HOST";
    if (!isSelf && !isHost) {
      throw new DomainError("FORBIDDEN", "Can only change your own wealth");
    }

    const [target] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.id, command.playerId), eq(gamePlayers.gameId, game.id)),
      )
      .limit(1);
    if (!target) throw new DomainError("NOT_FOUND", "Player not found");

    const [state] = await tx
      .select()
      .from(playerState)
      .where(eq(playerState.gamePlayerId, target.id))
      .limit(1);
    if (!state) throw new DomainError("NOT_FOUND", "Player state missing");

    const levels = await tx
      .select()
      .from(wealthLevels)
      .where(eq(wealthLevels.editionId, game.editionId))
      .orderBy(asc(wealthLevels.ordinal));

    const next = stepWealthLevel(
      levels.map((l) => ({
        id: l.id,
        ordinal: l.ordinal,
        name: l.name,
        landMovement: l.landMovement,
        seaMovement: l.seaMovement,
      })),
      state.wealthLevelId,
      command.direction,
    );

    if (next.id === state.wealthLevelId) {
      throw new DomainError(
        "INVALID_ACTION",
        command.direction === "UP"
          ? "Already at maximum wealth"
          : "Already at minimum wealth",
      );
    }

    await markEncounterResolving(tx, game.id, target.id);

    const nextVersion = game.stateVersion + 1;

    await tx
      .update(playerState)
      .set({
        wealthLevelId: next.id,
        updatedAt: new Date(),
      })
      .where(eq(playerState.gamePlayerId, target.id));

    await tx
      .update(games)
      .set({
        stateVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "CHANGE_WEALTH",
      payload: {
        playerId: target.id,
        direction: command.direction,
        wealthName: next.name,
      },
      changes: [
        {
          table: "player_state",
          key: { game_player_id: target.id },
          before: { wealth_level_id: state.wealthLevelId },
          after: { wealth_level_id: next.id },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
