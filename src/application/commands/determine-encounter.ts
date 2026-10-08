import { and, eq } from "drizzle-orm";
import {
  encounterChartEntries,
  gameActions,
  gameEncounters,
  gamePlayers,
  games,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { rollDie } from "@/domain/game/rules/dice";
import { DomainError } from "@/domain/game/types/errors";
import type { DetermineEncounterCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleDetermineEncounter(
  ctx: CommandContext,
  command: DetermineEncounterCommand,
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
    if (encounter.state !== "DRAWN") {
      throw new DomainError("INVALID_ACTION", "Encounter is not awaiting determination");
    }
    if (encounter.playerId !== actor.id) {
      throw new DomainError("FORBIDDEN", "Only the active player can determine the encounter");
    }

    const dieRoll = rollDie(6);
    const entries = await tx
      .select()
      .from(encounterChartEntries)
      .where(eq(encounterChartEntries.editionId, game.editionId));

    const entry = entries.find((e) => dieRoll >= e.rollMin && dieRoll <= e.rollMax);
    if (!entry) {
      throw new DomainError("INVALID_ACTION", `No chart entry for roll ${dieRoll}`);
    }

    await tx
      .update(gameEncounters)
      .set({
        dieRoll,
        encounterChartEntryId: entry.id,
        state: "DETERMINED",
        // paragraph stays null / SERVER_ONLY
        paragraphNumber: null,
      })
      .where(eq(gameEncounters.id, encounter.id));

    // Also log the irreversible roll as part of this action payload.
    // Rolls themselves are not separately undoable (action is reversible as a unit
    // that restores DRAWN and clears the roll).

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "DETERMINE_ENCOUNTER",
      payload: {
        encounterId: encounter.id,
        dieRoll,
        descriptor: entry.descriptor,
        // paragraph intentionally omitted from public payload
      },
      changes: [
        {
          table: "game_encounters",
          key: { id: encounter.id },
          before: {
            state: "DRAWN",
            die_roll: null,
            encounter_chart_entry_id: null,
          },
          after: {
            state: "DETERMINED",
            die_roll: dieRoll,
            encounter_chart_entry_id: entry.id,
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
