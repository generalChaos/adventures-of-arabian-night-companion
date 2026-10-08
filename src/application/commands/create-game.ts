import { and, eq } from "drizzle-orm";
import {
  gameActions,
  gameEditions,
  gamePlayers,
  games,
  locations,
  playerState,
} from "@/infrastructure/database/schema";
import { generateJoinCode } from "@/domain/game/rules/join-code";
import { colorForSeat } from "@/domain/game/rules/player-colors";
import { DomainError } from "@/domain/game/types/errors";
import type { CreateGameCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { resolveDefaultWealthLevelId } from "@/application/services/wealth";
import type { CommandContext, CommandResult } from "./types";

const DEFAULT_START_SLUG = "baghdad";

export async function handleCreateGame(
  ctx: CommandContext,
  command: CreateGameCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  const [edition] = await db
    .select()
    .from(gameEditions)
    .where(eq(gameEditions.id, command.editionId))
    .limit(1);

  if (!edition) throw new DomainError("NOT_FOUND", "Edition not found");

  const [preferred] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.editionId, command.editionId),
        eq(locations.slug, DEFAULT_START_SLUG),
      ),
    )
    .limit(1);

  const [fallback] = preferred
    ? [preferred]
    : await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.editionId, command.editionId))
        .limit(1);

  const startLocation = preferred ?? fallback;

  if (!startLocation) {
    throw new DomainError("INVALID_ACTION", "Edition has no locations");
  }

  const joinCode = generateJoinCode();
  const displayName = command.displayName.trim();
  if (!displayName) throw new DomainError("INVALID_ACTION", "Display name required");

  const result = await db.transaction(async (tx) => {
    const [game] = await tx
      .insert(games)
      .values({
        editionId: command.editionId,
        joinCode,
        status: "LOBBY",
        phase: "LOBBY",
        stateVersion: 1,
      })
      .returning();

    if (!game) throw new DomainError("INVALID_ACTION", "Failed to create game");

    const [player] = await tx
      .insert(gamePlayers)
      .values({
        gameId: game.id,
        userId,
        role: "HOST",
        displayName,
        seat: 0,
        playerColor: colorForSeat(0),
      })
      .returning();

    if (!player) throw new DomainError("INVALID_ACTION", "Failed to create host");

    const wealthLevelId = await resolveDefaultWealthLevelId(tx, command.editionId);

    await tx.insert(playerState).values({
      gamePlayerId: player.id,
      currentLocationId: startLocation.id,
      wealthLevelId,
    });

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: 1,
      actorPlayerId: player.id,
      actionType: "CREATE_GAME",
      payload: { editionId: command.editionId, joinCode },
      changes: [
        {
          table: "games",
          key: { id: game.id },
          before: null,
          after: { status: "LOBBY", joinCode },
        },
      ],
      reversible: false,
      previousStateVersion: 0,
      resultingStateVersion: 1,
    });

    return game.id;
  });

  return { snapshot: await loadGameSnapshot(db, result, userId) };
}
