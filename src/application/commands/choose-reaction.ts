import { and, eq } from "drizzle-orm";
import {
  encounterChartEntries,
  gameActions,
  gameEncounters,
  gamePlayers,
  games,
  reactionMatrixCells,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { ChooseReactionCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleChooseReaction(
  ctx: CommandContext,
  command: ChooseReactionCommand,
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

    const [encounter] = await tx
      .select()
      .from(gameEncounters)
      .where(
        and(
          eq(gameEncounters.id, command.encounterId),
          eq(gameEncounters.gameId, game.id),
        ),
      )
      .for("update")
      .limit(1);

    if (!encounter) throw new DomainError("NOT_FOUND", "Encounter not found");
    if (encounter.state !== "DETERMINED") {
      throw new DomainError("INVALID_ACTION", "Encounter is not awaiting a reaction");
    }
    if (encounter.playerId !== actor.id) {
      throw new DomainError("FORBIDDEN", "Only the active player can choose a reaction");
    }
    if (!encounter.encounterChartEntryId) {
      throw new DomainError("INVALID_ACTION", "Encounter has no chart entry");
    }

    const [entry] = await tx
      .select()
      .from(encounterChartEntries)
      .where(eq(encounterChartEntries.id, encounter.encounterChartEntryId))
      .limit(1);

    if (!entry?.matrixId) {
      throw new DomainError("INVALID_ACTION", "No reaction matrix for this encounter");
    }

    const [cell] = await tx
      .select()
      .from(reactionMatrixCells)
      .where(
        and(
          eq(reactionMatrixCells.matrixId, entry.matrixId),
          eq(reactionMatrixCells.rowKey, entry.descriptor),
          eq(reactionMatrixCells.reaction, command.reaction.toUpperCase()),
        ),
      )
      .limit(1);

    if (!cell) {
      throw new DomainError("INVALID_ACTION", `Unknown reaction: ${command.reaction}`);
    }

    await tx
      .update(gameEncounters)
      .set({
        chosenReaction: cell.reaction,
        paragraphNumber: cell.paragraphNumber,
        state: "REACTION_CHOSEN",
      })
      .where(eq(gameEncounters.id, encounter.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "CHOOSE_REACTION",
      payload: {
        encounterId: encounter.id,
        reaction: cell.reaction,
        paragraphNumber: cell.paragraphNumber,
      },
      changes: [
        {
          table: "game_encounters",
          key: { id: encounter.id },
          before: {
            state: "DETERMINED",
            chosen_reaction: null,
            paragraph_number: null,
          },
          after: {
            state: "REACTION_CHOSEN",
            chosen_reaction: cell.reaction,
            paragraph_number: cell.paragraphNumber,
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
