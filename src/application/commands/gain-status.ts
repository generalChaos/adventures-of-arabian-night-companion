import { and, eq } from "drizzle-orm";
import {
  cards,
  gameActions,
  gamePlayers,
  games,
  playerStatuses,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { GainStatusCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { markEncounterResolving } from "./encounter-resolving";
import type { CommandContext, CommandResult } from "./types";

export async function handleGainStatus(
  ctx: CommandContext,
  command: GainStatusCommand,
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
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    // Host or the target player (or reader) may apply a result.
    const [target] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.id, command.playerId), eq(gamePlayers.gameId, game.id)),
      )
      .limit(1);
    if (!target) throw new DomainError("NOT_FOUND", "Target player not found");

    const [statusCard] = await tx
      .select()
      .from(cards)
      .where(
        and(eq(cards.id, command.statusCardId), eq(cards.cardType, "STATUS")),
      )
      .limit(1);
    if (!statusCard) throw new DomainError("NOT_FOUND", "Status card not found");

    const [status] = await tx
      .insert(playerStatuses)
      .values({
        gamePlayerId: target.id,
        statusCardId: statusCard.id,
        active: true,
      })
      .returning();

    if (!status) throw new DomainError("INVALID_ACTION", "Failed to grant status");

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
      actionType: "GAIN_STATUS",
      payload: {
        playerId: target.id,
        statusCardId: statusCard.id,
        title: statusCard.title,
      },
      changes: [
        {
          table: "player_statuses",
          key: { id: status.id },
          before: null,
          after: {
            game_player_id: target.id,
            status_card_id: statusCard.id,
            active: true,
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
