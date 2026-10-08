import { and, eq } from "drizzle-orm";
import {
  gameActions,
  gamePlayers,
  games,
  locations,
  playerState,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { isValidCharacterId } from "@/domain/game/rules/characters";
import { DomainError } from "@/domain/game/types/errors";
import type {
  AdminCorrectionCommand,
  SelectCharacterCommand,
} from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleSelectCharacter(
  ctx: CommandContext,
  command: SelectCharacterCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  if (!isValidCharacterId(command.characterId)) {
    throw new DomainError("INVALID_ACTION", "Unknown character");
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
    if (game.status !== "LOBBY") {
      throw new DomainError("INVALID_ACTION", "Characters can only be chosen in lobby");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const taken = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(
          eq(gamePlayers.gameId, game.id),
          eq(gamePlayers.characterId, command.characterId),
        ),
      )
      .limit(1);
    if (taken[0] && taken[0].id !== actor.id) {
      throw new DomainError("INVALID_ACTION", "Character already taken");
    }

    const previous = actor.characterId;
    await tx
      .update(gamePlayers)
      .set({ characterId: command.characterId })
      .where(eq(gamePlayers.id, actor.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "SELECT_CHARACTER",
      payload: { characterId: command.characterId },
      changes: [
        {
          table: "game_players",
          key: { id: actor.id },
          before: { character_id: previous },
          after: { character_id: command.characterId },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}

export async function handleAdminCorrection(
  ctx: CommandContext,
  command: AdminCorrectionCommand,
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
      throw new DomainError("FORBIDDEN", "Only the host can correct state");
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
    if (!state) throw new DomainError("NOT_FOUND", "Player state not found");

    if (command.locationId) {
      const [loc] = await tx
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.id, command.locationId),
            eq(locations.editionId, game.editionId),
          ),
        )
        .limit(1);
      if (!loc) throw new DomainError("INVALID_ACTION", "Location not found");
    }

    const before = {
      current_location_id: state.currentLocationId,
      story_points: state.storyPoints,
      destiny_points: state.destinyPoints,
    };
    const after = {
      current_location_id: command.locationId ?? state.currentLocationId,
      story_points: command.storyPoints ?? state.storyPoints,
      destiny_points: command.destinyPoints ?? state.destinyPoints,
    };

    await tx
      .update(playerState)
      .set({
        currentLocationId: after.current_location_id,
        storyPoints: after.story_points,
        destinyPoints: after.destiny_points,
        updatedAt: new Date(),
      })
      .where(eq(playerState.gamePlayerId, target.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "ADMIN_CORRECTION",
      payload: {
        playerId: target.id,
        note: command.note ?? null,
        ...after,
      },
      changes: [
        {
          table: "player_state",
          key: { game_player_id: target.id },
          before,
          after,
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
