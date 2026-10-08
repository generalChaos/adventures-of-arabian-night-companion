import { and, eq } from "drizzle-orm";
import {
  boardEdges,
  gameActions,
  gamePlayers,
  games,
  locations,
  playerState,
  wealthLevels,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import {
  isAdjacentMove,
  isWithinMovementAllowance,
} from "@/domain/game/rules/movement";
import { DomainError } from "@/domain/game/types/errors";
import type { MovePlayerCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleMovePlayer(
  ctx: CommandContext,
  command: MovePlayerCommand,
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
    if (actor.id !== command.playerId) {
      throw new DomainError("FORBIDDEN", "Can only move your own player");
    }
    if (game.currentTurnPlayerId && game.currentTurnPlayerId !== actor.id) {
      throw new DomainError("INVALID_ACTION", "Not your turn");
    }

    const [state] = await tx
      .select()
      .from(playerState)
      .where(eq(playerState.gamePlayerId, actor.id))
      .limit(1);

    if (!state?.currentLocationId) {
      throw new DomainError("INVALID_ACTION", "Player has no location");
    }

    const [destination] = await tx
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, command.destinationId),
          eq(locations.editionId, game.editionId),
        ),
      )
      .limit(1);

    if (!destination) {
      throw new DomainError("INVALID_ACTION", "Destination not found");
    }

    const edges = await tx
      .select()
      .from(boardEdges)
      .where(eq(boardEdges.editionId, game.editionId));

    const edgeViews = edges.map((e) => ({
      id: e.id,
      fromLocationId: e.fromLocationId,
      toLocationId: e.toLocationId,
      connectionType: e.connectionType as "LAND" | "SEA",
    }));

    const locationRows = await tx
      .select()
      .from(locations)
      .where(eq(locations.editionId, game.editionId));
    const locationViews = locationRows.map((l) => ({
      id: l.id,
      slug: l.slug,
      name: l.name,
      spaceType: l.spaceType,
      isPort: l.isPort,
      x: 0,
      y: 0,
    }));

    let landMovement = 1;
    let seaMovement = 0;
    if (state.wealthLevelId) {
      const [wealth] = await tx
        .select()
        .from(wealthLevels)
        .where(eq(wealthLevels.id, state.wealthLevelId))
        .limit(1);
      if (wealth) {
        landMovement = wealth.landMovement;
        seaMovement = wealth.seaMovement;
      }
    }

    const adjacent = isAdjacentMove(
      state.currentLocationId,
      command.destinationId,
      edgeViews,
    );
    const withinAllowance = isWithinMovementAllowance(
      state.currentLocationId,
      command.destinationId,
      edgeViews,
      locationViews,
      { landMovement, seaMovement },
    );

    const previousLocationId = state.currentLocationId;
    const nextVersion = game.stateVersion + 1;

    await tx
      .update(playerState)
      .set({
        currentLocationId: command.destinationId,
        updatedAt: new Date(),
      })
      .where(eq(playerState.gamePlayerId, actor.id));

    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "MOVE_PLAYER",
      payload: {
        destinationId: command.destinationId,
        destinationSlug: destination.slug,
        adjacent,
        withinAllowance,
        offRule: !withinAllowance,
      },
      changes: [
        {
          table: "player_state",
          key: { game_player_id: actor.id },
          before: { current_location_id: previousLocationId },
          after: { current_location_id: command.destinationId },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
